import heapq
import random
import time
from typing import Dict, List, Optional, Set, Tuple, Any
from collections import deque

from ..network.model import NodeConfig, LinkConfig, Packet, NodeType, DropPolicy, TopologyData
from ..protocols import create_protocol, TCPBaseProtocol
from ..routing.router import RoutingEngine, CongestionPolicy, SDNController
from .events import SimulationEvent, EventType


class NetworkSimulation:
    def __init__(
        self,
        topology: TopologyData,
        seed: int = 42,
        auto_reroute: bool = False,
        congestion_policy: Optional[CongestionPolicy] = None,
        routing_mode: Optional[str] = None,
    ):
        self.random = random.Random(seed)
        self.nodes: Dict[str, NodeConfig] = {n.id: n for n in topology.nodes}
        self.links: Dict[str, LinkConfig] = {l.id: l for l in topology.links}
        self.auto_reroute = auto_reroute
        self.congestion_policy = congestion_policy or CongestionPolicy()

        # Routing engine
        self.router = RoutingEngine(self.nodes, self.links)

        # Centralized SDN Controller
        mode = routing_mode if routing_mode else ("adaptive" if auto_reroute else "static")
        self.sdn_controller = SDNController(
            routing_engine=self.router,
            queue_threshold=self.congestion_policy.queue_ratio_threshold,
            utilization_threshold=self.congestion_policy.utilization_threshold,
            drop_rate_threshold=self.congestion_policy.drop_rate_threshold,
            latency_inflation_threshold=self.congestion_policy.rtt_inflation_factor,
            routing_mode=mode,
        )

        # Simulation clock and state
        self.sim_time: float = 0.0
        self.event_queue: List[SimulationEvent] = []
        self.packet_counter: int = 0
        self.is_running: bool = False
        self.is_completed: bool = False
        self.max_time: float = 30.0  # max 30s sim time

        # Active TCP protocols per sender
        self.protocols: Dict[str, TCPBaseProtocol] = {}
        # Flow paths: flow_id -> list[node_id]
        self.flow_paths: Dict[str, List[str]] = {}
        # Sender state
        self.next_seq_num: Dict[str, int] = {}
        self.unacked_packets: Dict[str, Dict[int, Tuple[Packet, float, float]]] = {}  # seq -> (pkt, send_time, rto)
        
        # Receiver state: flow_id -> {expected_seq, out_of_order_buf}
        self.expected_seq: Dict[str, int] = {}
        self.receiver_buffers: Dict[str, Dict[int, Packet]] = {}
        
        # Router queues: per-egress-interface output queue (router_id, out_link_id) -> deque of (Packet, next_node_id, link_id)
        self.router_egress_queues: Dict[Tuple[str, str], deque] = {}
        for n in self.nodes.values():
            if n.type == NodeType.ROUTER:
                for l in self.links.values():
                    if l.source == n.id or l.target == n.id:
                        self.router_egress_queues[(n.id, l.id)] = deque()

        # Legacy router queues view for backwards compatibility
        self.router_queues: Dict[str, deque] = {n.id: deque() for n in self.nodes.values() if n.type == NodeType.ROUTER}
        # Full-duplex transmitter serialization busy status: (link_id, tx_node_id) -> busy_until_time
        self.link_tx_busy: Dict[Tuple[str, str], float] = {}
        # Aggregate link serialization busy status: link_id -> busy_until_time
        self.link_busy_until: Dict[str, float] = {l.id: 0.0 for l in self.links.values()}

        # Metrics and counters
        self.total_app_bytes_offered: Dict[str, int] = {}
        self.total_bytes_transmitted: Dict[str, int] = {}
        self.total_bytes_delivered: Dict[str, int] = {}
        self.total_packets_dropped_overflow: Dict[str, int] = {}
        self.total_packets_dropped_random: Dict[str, int] = {}
        self.unneeded_duplicates: Dict[str, int] = {}
        self.total_app_packets_generated: Dict[str, int] = {}
        self.baseline_rtt: Dict[str, float] = {}
        
        # Sliding window for instantaneous metrics
        self.window_delivered_bytes: Dict[str, int] = {}
        self.window_transmitted_bytes: Dict[str, int] = {}
        self.last_metric_window_time: float = 0.0

        # Rerouting history
        self.reroute_history: List[Dict[str, Any]] = []

        # Event log (bounded)
        self.event_log: List[Dict[str, Any]] = []
        self.max_log_entries = 1000

        # Time-series metrics snapshots
        self.snapshots: List[Dict[str, Any]] = []
        self.last_snapshot_time: float = -0.05
        self.snapshot_interval: float = 0.05  # every 50ms

        self._initialize_flows()
        # Schedule periodic checks
        self._schedule_event(0.05, EventType.CONGESTION_CHECK, "system")

    def _initialize_flows(self) -> None:
        senders = [n for n in self.nodes.values() if n.type == NodeType.SENDER]
        receivers = [n for n in self.nodes.values() if n.type == NodeType.RECEIVER]
        default_receiver = receivers[0].id if receivers else None

        for sender in senders:
            flow_id = f"flow_{sender.id}"
            dst_id = sender.dest_id if sender.dest_id in self.nodes else default_receiver
            if not dst_id:
                continue

            # Create protocol (supports UDP, Tahoe, Reno, CUBIC)
            rate_mbps = getattr(sender, "udp_rate_mbps", 10.0)
            self.protocols[flow_id] = create_protocol(
                name=sender.protocol,
                mss=sender.mss,
                initial_cwnd=sender.initial_cwnd,
                initial_ssthresh=sender.initial_ssthresh,
                max_cwnd=sender.max_cwnd,
                rate_mbps=rate_mbps,
            )

            # Discover path
            path = self.router.find_shortest_path(sender.id, dst_id)
            if not path:
                # Disconnected topology
                continue
            self.flow_paths[flow_id] = path

            # Register flow in centralized SDN Controller OpenFlow flow table
            eff_rate = rate_mbps if "udp" in sender.protocol.lower() else (sender.app_rate_bps / 1_000_000.0 if sender.app_rate_bps > 0 else 10.0)
            self.sdn_controller.install_flow_rule(
                flow_id=flow_id,
                src=sender.id,
                dst=dst_id,
                protocol=sender.protocol,
                path=path,
                rate_mbps=eff_rate,
            )

            # Initialize tracking
            self.next_seq_num[flow_id] = 1
            self.unacked_packets[flow_id] = {}
            self.expected_seq[flow_id] = 1
            self.receiver_buffers[flow_id] = {}
            self.total_app_bytes_offered[flow_id] = 0
            self.total_bytes_transmitted[flow_id] = 0
            self.total_bytes_delivered[flow_id] = 0
            self.total_packets_dropped_overflow[flow_id] = 0
            self.total_packets_dropped_random[flow_id] = 0
            self.unneeded_duplicates[flow_id] = 0
            self.total_app_packets_generated[flow_id] = 0
            self.window_delivered_bytes[flow_id] = 0
            self.window_transmitted_bytes[flow_id] = 0

            # Calculate baseline RTT (propagation delay * 2)
            path_cost = self.router.calculate_path_cost(path)
            self.baseline_rtt[flow_id] = max(0.01, (path_cost["total_delay_ms"] * 2.0) / 1000.0)

            # Schedule start
            start_t = max(0.0, sender.start_time)
            self._schedule_event(start_t, EventType.PACKET_GENERATE, flow_id)

    def _schedule_event(
        self,
        time: float,
        event_type: EventType,
        flow_id: str,
        packet: Optional[Packet] = None,
        node_id: Optional[str] = None,
        link_id: Optional[str] = None,
        data: Optional[Dict[str, Any]] = None,
    ) -> SimulationEvent:
        evt = SimulationEvent(
            time=time,
            event_type=event_type,
            flow_id=flow_id,
            packet=packet,
            node_id=node_id,
            link_id=link_id,
            data=data,
        )
        heapq.heappush(self.event_queue, evt)
        return evt

    def _find_link(self, u: str, v: str) -> Optional[LinkConfig]:
        for link in self.links.values():
            if link.is_active:
                if (link.source == u and link.target == v) or (link.source == v and link.target == u):
                    return link
        return None

    def _log_event(self, evt: SimulationEvent, description: str, **kwargs) -> None:
        if len(self.event_log) >= self.max_log_entries:
            self.event_log.pop(0)
        entry = evt.to_dict()
        entry["description"] = description
        entry.update(kwargs)
        self.event_log.append(entry)

    def step(self) -> Optional[Dict[str, Any]]:
        """Process exactly one discrete simulation event."""
        if not self.event_queue:
            self.is_completed = True
            return None

        event = heapq.heappop(self.event_queue)
        self.sim_time = event.time

        # Handle event according to type
        if event.event_type == EventType.PACKET_GENERATE:
            self._handle_packet_generate(event)
        elif event.event_type == EventType.PACKET_DEPART_SENDER:
            self._handle_packet_depart_sender(event)
        elif event.event_type == EventType.ROUTER_ARRIVAL:
            self._handle_router_arrival(event)
        elif event.event_type == EventType.ROUTER_DEPART:
            self._handle_router_depart(event)
        elif event.event_type == EventType.RECEIVER_ARRIVAL:
            self._handle_receiver_arrival(event)
        elif event.event_type == EventType.ACK_ARRIVAL:
            self._handle_ack_arrival(event)
        elif event.event_type == EventType.RETRANSMISSION_TIMEOUT:
            self._handle_timeout(event)
        elif event.event_type == EventType.CONGESTION_CHECK:
            self._handle_congestion_check(event)

        # Snapshot recording
        if self.sim_time - self.last_snapshot_time >= self.snapshot_interval:
            self._record_snapshot()
            self.last_snapshot_time = self.sim_time

        return event.to_dict()

    def run_until(self, target_time: float, max_events: int = 50000) -> int:
        """Run simulation until target_time or max_events reached."""
        count = 0
        while self.event_queue and count < max_events:
            if self.event_queue[0].time > target_time:
                break
            self.step()
            count += 1
        return count

    def _dispatch_new_packet(self, flow_id: str, proto: TCPBaseProtocol, sender_id: str) -> bool:
        path = list(self.flow_paths.get(flow_id, []))
        if len(path) < 2:
            return False

        seq = self.next_seq_num[flow_id]
        self.next_seq_num[flow_id] += 1
        self.packet_counter += 1

        packet = Packet(
            packet_id=self.packet_counter,
            flow_id=flow_id,
            source_id=sender_id,
            dest_id=path[-1],
            seq_num=seq,
            size_bytes=proto.mss,
            created_time=self.sim_time,
            is_ack=False,
            path=path,
            current_hop=0,
        )

        self.total_app_bytes_offered[flow_id] += proto.mss
        self.total_bytes_transmitted[flow_id] += proto.mss
        self.window_transmitted_bytes[flow_id] += proto.mss
        self.unacked_packets[flow_id][seq] = (packet, self.sim_time, proto.rto)
        self.total_app_packets_generated[flow_id] = self.total_app_packets_generated.get(flow_id, 0) + 1

        # Schedule retransmission timeout timer
        timeout_time = self.sim_time + proto.rto
        self._schedule_event(
            timeout_time,
            EventType.RETRANSMISSION_TIMEOUT,
            flow_id,
            packet=packet,
            data={"seq_num": seq, "rto": proto.rto},
        )

        # Transmit onto first link
        self._send_packet_on_path(packet, self.sim_time)
        return True

    def _handle_packet_generate(self, event: SimulationEvent) -> None:
        flow_id = event.flow_id
        if flow_id not in self.protocols:
            return

        proto = self.protocols[flow_id]
        sender_id = flow_id.replace("flow_", "")
        sender_node = self.nodes.get(sender_id)
        if not sender_node:
            return

        if self.sim_time < sender_node.start_time:
            return

        if sender_node.app_stop_time > 0 and self.sim_time >= sender_node.app_stop_time:
            return

        # Handle UDP Traffic Generation (CBR / Burst / Multi-Path)
        if "udp" in sender_node.protocol.lower():
            path = list(self.flow_paths.get(flow_id, []))
            if len(path) < 2:
                return

            active_rate = getattr(sender_node, "udp_rate_mbps", 10.0)
            if getattr(sender_node, "udp_burst_enabled", False):
                burst_start = getattr(sender_node, "udp_burst_start_s", 2.0)
                burst_dur = getattr(sender_node, "udp_burst_duration_s", 1.0)
                if burst_start <= self.sim_time <= burst_start + burst_dur:
                    active_rate = getattr(sender_node, "udp_burst_rate_mbps", 25.0)

            inter_pkt_time = max(0.0001, (proto.mss * 8.0) / max(100_000.0, active_rate * 1_000_000.0))

            seq = self.next_seq_num[flow_id]
            self.next_seq_num[flow_id] += 1
            self.packet_counter += 1

            packet = Packet(
                packet_id=self.packet_counter,
                flow_id=flow_id,
                source_id=sender_id,
                dest_id=path[-1],
                seq_num=seq,
                size_bytes=proto.mss,
                created_time=self.sim_time,
                protocol="udp",
                is_ack=False,
                path=path,
                current_hop=0,
            )

            self.total_app_bytes_offered[flow_id] += proto.mss
            self.total_bytes_transmitted[flow_id] += proto.mss
            self.window_transmitted_bytes[flow_id] += proto.mss
            self.total_app_packets_generated[flow_id] = self.total_app_packets_generated.get(flow_id, 0) + 1
            if hasattr(proto, "packets_sent"):
                proto.packets_sent += 1
                proto.bytes_sent += proto.mss

            self._send_packet_on_path(packet, self.sim_time)

            next_gen_time = self.sim_time + inter_pkt_time
            if self.sim_time < self.max_time:
                if sender_node.app_stop_time == 0 or next_gen_time < sender_node.app_stop_time:
                    self._schedule_event(next_gen_time, EventType.PACKET_GENERATE, flow_id)
            return

        # Effective window = min(cwnd, rwnd) (TCP)
        rwnd = getattr(sender_node, "rwnd", 64.0)
        effective_window = max(1.0, min(proto.cwnd, rwnd))
        in_flight = len(self.unacked_packets[flow_id])

        if sender_node.app_rate_bps > 0:
            # Metered sending rate
            inter_pkt_time = max(0.0001, (proto.mss * 8.0) / sender_node.app_rate_bps)
            burst = max(1, getattr(sender_node, "traffic_burst_size", 1) or 1)
            for _ in range(burst):
                if in_flight < int(effective_window):
                    if self._dispatch_new_packet(flow_id, proto, sender_id):
                        in_flight += 1

            next_gen_time = self.sim_time + inter_pkt_time
            if self.sim_time < self.max_time:
                if sender_node.app_stop_time == 0 or next_gen_time < sender_node.app_stop_time:
                    self._schedule_event(next_gen_time, EventType.PACKET_GENERATE, flow_id)
        else:
            # Greedy / continuous backlog
            while in_flight < int(effective_window):
                dispatched = self._dispatch_new_packet(flow_id, proto, sender_id)
                if not dispatched:
                    break
                in_flight += 1

    def _send_packet_on_path(self, packet: Packet, current_time: float) -> None:
        u = packet.path[packet.current_hop]
        v = packet.path[packet.current_hop + 1]
        link = self._find_link(u, v)
        if not link or not link.is_active:
            return

        tx_key = (link.id, u)
        ser_delay = (packet.size_bytes * 8.0) / link.bandwidth_bps
        start_tx_time = max(current_time, self.link_tx_busy.get(tx_key, 0.0))
        finish_tx_time = start_tx_time + ser_delay
        self.link_tx_busy[tx_key] = finish_tx_time
        self.link_busy_until[link.id] = finish_tx_time

        arrival_time = finish_tx_time + link.propagation_delay_s
        next_node = self.nodes.get(v)
        if not next_node:
            return

        if next_node.type == NodeType.ROUTER:
            self._schedule_event(
                arrival_time,
                EventType.ROUTER_ARRIVAL,
                packet.flow_id,
                packet=packet,
                node_id=v,
                link_id=link.id,
            )
        elif next_node.type == NodeType.RECEIVER:
            self._schedule_event(
                arrival_time,
                EventType.RECEIVER_ARRIVAL,
                packet.flow_id,
                packet=packet,
                node_id=v,
                link_id=link.id,
            )
        elif next_node.type == NodeType.SENDER and packet.is_ack:
            self._schedule_event(
                arrival_time,
                EventType.ACK_ARRIVAL,
                packet.flow_id,
                packet=packet,
                node_id=v,
                link_id=link.id,
            )

    def _handle_router_arrival(self, event: SimulationEvent) -> None:
        packet = event.packet
        router_id = event.node_id
        router_node = self.nodes.get(router_id)
        if not packet or not router_node:
            return

        packet.current_hop += 1
        if packet.current_hop >= len(packet.path) - 1:
            return

        next_hop = packet.path[packet.current_hop + 1]
        out_link = self._find_link(router_id, next_hop)
        if not out_link or not out_link.is_active:
            return

        tx_key = (out_link.id, router_id)
        queue = self.router_egress_queues.setdefault((router_id, out_link.id), deque())
        buf_cap = router_node.buffer_capacity

        # Check random link drop
        if self.random.random() < out_link.loss_rate:
            self.total_packets_dropped_random[packet.flow_id] = (
                self.total_packets_dropped_random.get(packet.flow_id, 0) + 1
            )
            self._log_event(
                event,
                f"Packet seq {packet.seq_num} dropped at router {router_id} due to random link loss ({out_link.loss_rate*100:.1f}%)",
                category="DROP_RANDOM_LOSS",
            )
            return

        # Check if router's transmitter on out_link is currently transmitting
        is_link_transmitting = self.link_tx_busy.get(tx_key, 0.0) > self.sim_time

        if not is_link_transmitting and len(queue) == 0:
            # Transmitter is idle and no queue: start transmitting immediately
            ser_delay = (packet.size_bytes * 8.0) / out_link.bandwidth_bps
            finish_tx_time = self.sim_time + ser_delay
            self.link_tx_busy[tx_key] = finish_tx_time
            self.link_busy_until[out_link.id] = finish_tx_time

            # Schedule router depart when transmission finishes
            self._schedule_event(
                finish_tx_time,
                EventType.ROUTER_DEPART,
                packet.flow_id,
                packet=packet,
                node_id=router_id,
                link_id=out_link.id,
            )
        else:
            # Buffer capacity check: drop non-ACK data packets when interface buffer is full
            # (40-byte return ACKs on reverse links are never dropped due to forward data bottleneck)
            if not packet.is_ack and buf_cap != -1 and len(queue) >= buf_cap:
                self.total_packets_dropped_overflow[packet.flow_id] = (
                    self.total_packets_dropped_overflow.get(packet.flow_id, 0) + 1
                )
                proto = self.protocols.get(packet.flow_id)
                if proto and hasattr(proto, "packets_dropped"):
                    proto.packets_dropped += 1
                self._log_event(
                    event,
                    f"Buffer overflow at router {router_id} [{out_link.id}] ({len(queue)}/{buf_cap} pkts). Packet seq {packet.seq_num} DROPPED!",
                    category="DROP_BUFFER_FULL",
                )
                return

            # ECN marking check
            if router_node.drop_policy == DropPolicy.ECN and buf_cap > 0:
                occupancy_ratio = len(queue) / float(buf_cap)
                if occupancy_ratio >= router_node.ecn_threshold:
                    packet.ecn_marked = True
                    self._log_event(
                        event,
                        f"Router {router_id} queue high ({occupancy_ratio*100:.0f}%). Marked ECN CE bit on packet {packet.seq_num}.",
                        category="ECN_MARKED",
                    )

            # Enqueue packet in this interface's output queue
            queue.append((packet, next_hop, out_link.id))

    def _handle_router_depart(self, event: SimulationEvent) -> None:
        packet = event.packet
        router_id = event.node_id
        link_id = event.link_id
        if not router_id or not packet or not link_id:
            return

        out_link = self.links.get(link_id)
        if not out_link:
            return

        # Packet finishes serialization: propagates to next hop
        next_hop = packet.path[packet.current_hop + 1]
        arrival_time = self.sim_time + out_link.propagation_delay_s
        next_node = self.nodes.get(next_hop)
        if next_node:
            if next_node.type == NodeType.ROUTER:
                self._schedule_event(
                    arrival_time,
                    EventType.ROUTER_ARRIVAL,
                    packet.flow_id,
                    packet=packet,
                    node_id=next_hop,
                    link_id=out_link.id,
                )
            elif next_node.type == NodeType.RECEIVER:
                self._schedule_event(
                    arrival_time,
                    EventType.RECEIVER_ARRIVAL,
                    packet.flow_id,
                    packet=packet,
                    node_id=next_hop,
                    link_id=out_link.id,
                )
            elif next_node.type == NodeType.SENDER and packet.is_ack:
                self._schedule_event(
                    arrival_time,
                    EventType.ACK_ARRIVAL,
                    packet.flow_id,
                    packet=packet,
                    node_id=next_hop,
                    link_id=out_link.id,
                )

        # Port transmitter for this egress interface is now free: check this interface's queue
        tx_key = (link_id, router_id)
        queue = self.router_egress_queues.get((router_id, link_id))
        if queue and len(queue) > 0:
            next_pkt, next_next_hop, next_link_id = queue.popleft()
            ser_delay = (next_pkt.size_bytes * 8.0) / out_link.bandwidth_bps
            finish_tx_time = self.sim_time + ser_delay
            self.link_tx_busy[tx_key] = finish_tx_time
            self.link_busy_until[link_id] = finish_tx_time

            self._schedule_event(
                finish_tx_time,
                EventType.ROUTER_DEPART,
                next_pkt.flow_id,
                packet=next_pkt,
                node_id=router_id,
                link_id=link_id,
            )

    def _handle_receiver_arrival(self, event: SimulationEvent) -> None:
        packet = event.packet
        if not packet:
            return

        flow_id = packet.flow_id

        # UDP Reception: record delivery and latency, no return ACK
        if getattr(packet, "protocol", "tcp") == "udp":
            self.total_bytes_delivered[flow_id] = self.total_bytes_delivered.get(flow_id, 0) + packet.size_bytes
            self.window_delivered_bytes[flow_id] = self.window_delivered_bytes.get(flow_id, 0) + packet.size_bytes
            proto = self.protocols.get(flow_id)
            if proto and hasattr(proto, "packets_delivered"):
                proto.packets_delivered += 1
                proto.bytes_delivered += packet.size_bytes
                proto.current_rtt_ms = round((self.sim_time - packet.created_time) * 1000.0, 2)
            self._log_event(
                event,
                f"UDP Datagram #{packet.seq_num} received at {packet.dest_id}. One-way delay: {round((self.sim_time - packet.created_time)*1000.0, 2)} ms",
                category="PACKET_DELIVERED",
            )
            return

        expected = self.expected_seq.get(flow_id, 1)
        reorder_buf = self.receiver_buffers[flow_id]

        is_dup_ack = False
        ack_seq = expected - 1

        if packet.seq_num == expected:
            # In-order arrival: deliver to application
            self.total_bytes_delivered[flow_id] += packet.size_bytes
            self.window_delivered_bytes[flow_id] += packet.size_bytes
            expected += 1

            # Drain contiguous buffered packets
            while expected in reorder_buf:
                buf_pkt = reorder_buf.pop(expected)
                self.total_bytes_delivered[flow_id] += buf_pkt.size_bytes
                self.window_delivered_bytes[flow_id] += buf_pkt.size_bytes
                expected += 1

            self.expected_seq[flow_id] = expected
            ack_seq = expected - 1
            is_dup_ack = False
        elif packet.seq_num > expected:
            # Out-of-order packet: queue in reorder buffer, generate duplicate ACK
            reorder_buf[packet.seq_num] = packet
            is_dup_ack = True
            ack_seq = expected - 1
        else:
            # packet.seq_num < expected: unneeded duplicate from premature retransmission!
            self.unneeded_duplicates[flow_id] += 1
            is_dup_ack = True
            ack_seq = expected - 1

        # Generate ACK packet back to sender
        reverse_path = list(reversed(packet.path))
        self.packet_counter += 1
        ack_pkt = Packet(
            packet_id=self.packet_counter,
            flow_id=flow_id,
            source_id=packet.dest_id,
            dest_id=packet.source_id,
            seq_num=0,
            size_bytes=40,  # TCP ACK header
            created_time=self.sim_time,
            is_ack=True,
            ack_num=ack_seq,
            is_dup_ack=is_dup_ack,
            ecn_echo=packet.ecn_marked,  # Set ECE flag if router set CE bit
            path=reverse_path,
            current_hop=0,
        )

        self._send_packet_on_path(ack_pkt, self.sim_time)

    def _handle_ack_arrival(self, event: SimulationEvent) -> None:
        ack_pkt = event.packet
        if not ack_pkt:
            return

        flow_id = ack_pkt.flow_id
        if flow_id not in self.protocols:
            return

        proto = self.protocols[flow_id]
        ack_num = ack_pkt.ack_num

        if ack_pkt.is_dup_ack:
            # Duplicate ACK
            triggered_fast_rexmit = proto.on_dup_ack(ack_num, self.sim_time)
            if triggered_fast_rexmit:
                # Fast Retransmit: immediately retransmit missing packet (ack_num + 1)
                missing_seq = ack_num + 1
                self._log_event(
                    event,
                    f"Triple duplicate ACK detected for seq {ack_num}! Fast Retransmit triggered for packet {missing_seq}. Protocol: {proto.__class__.__name__}, cwnd -> {proto.cwnd:.2f}, ssthresh -> {proto.ssthresh:.2f}",
                    category="FAST_RETRANSMIT",
                )
                self._retransmit_packet(flow_id, missing_seq, reason="fast_retransmit")
            elif proto.state == "FastRecovery":
                # In Fast Recovery: window inflates per duplicate ACK, dispatch newly permitted packets
                self._handle_packet_generate(event)
        else:
            # New cumulative ACK acknowledging up to ack_num
            # Find RTT sample from oldest acked packet
            rtt_sample = None
            acked_seqs = [s for s in self.unacked_packets[flow_id].keys() if s <= ack_num]
            for s in acked_seqs:
                pkt_info = self.unacked_packets[flow_id].pop(s, None)
                if pkt_info:
                    _, sent_t, _ = pkt_info
                    rtt_sample = self.sim_time - sent_t

            # Ensure sender sequence number advances past acknowledged packets
            self.next_seq_num[flow_id] = max(self.next_seq_num[flow_id], ack_num + 1)

            proto.on_new_ack(
                ack_num,
                self.sim_time,
                rtt_sample=rtt_sample,
                ecn_echo=ack_pkt.ecn_echo,
            )

            # Trigger generation of newly permitted packets
            self._handle_packet_generate(event)

    def _handle_timeout(self, event: SimulationEvent) -> None:
        flow_id = event.flow_id
        seq = event.data.get("seq_num")
        if flow_id not in self.unacked_packets or seq not in self.unacked_packets[flow_id]:
            # Packet was already ACKed, ignore stale timer
            return

        proto = self.protocols[flow_id]
        proto.on_timeout(self.sim_time)

        self._log_event(
            event,
            f"RTO Timeout fired for packet {seq}! cwnd -> 1.0 MSS, ssthresh -> {proto.ssthresh:.2f}. Restarting Slow Start. Retransmitting packet.",
            category="TIMEOUT",
        )

        # On timeout, reset pipe: restart transmission starting from seq
        self.next_seq_num[flow_id] = seq + 1
        to_remove = [s for s in self.unacked_packets[flow_id].keys() if s > seq]
        for s in to_remove:
            del self.unacked_packets[flow_id][s]

        # Retransmit packet
        self._retransmit_packet(flow_id, seq, reason="timeout")

    def _retransmit_packet(self, flow_id: str, seq: int, reason: str) -> None:
        if flow_id not in self.unacked_packets or seq not in self.unacked_packets[flow_id]:
            return

        orig_pkt, _, _ = self.unacked_packets[flow_id][seq]
        proto = self.protocols[flow_id]

        path = list(self.flow_paths.get(flow_id, []))
        self.packet_counter += 1
        rexmit_pkt = Packet(
            packet_id=self.packet_counter,
            flow_id=flow_id,
            source_id=orig_pkt.source_id,
            dest_id=orig_pkt.dest_id,
            seq_num=seq,
            size_bytes=orig_pkt.size_bytes,
            created_time=self.sim_time,
            is_ack=False,
            is_retransmit=True,
            retransmit_reason=reason,
            path=path,
            current_hop=0,
        )

        self.total_bytes_transmitted[flow_id] += rexmit_pkt.size_bytes
        self.window_transmitted_bytes[flow_id] += rexmit_pkt.size_bytes
        self.unacked_packets[flow_id][seq] = (rexmit_pkt, self.sim_time, proto.rto)

        # Reschedule timeout
        self._schedule_event(
            self.sim_time + proto.rto,
            EventType.RETRANSMISSION_TIMEOUT,
            flow_id,
            packet=rexmit_pkt,
            data={"seq_num": seq, "rto": proto.rto},
        )

        self._send_packet_on_path(rexmit_pkt, self.sim_time)

    def _handle_congestion_check(self, event: SimulationEvent) -> None:
        """Periodic congestion check, flow stats polling, and dynamic SDN rerouting."""
        link_stats: Dict[str, Dict[str, float]] = {}
        for link in self.links.values():
            q_ratio = 0.0
            if link.source in self.nodes and self.nodes[link.source].type == NodeType.ROUTER:
                router = self.nodes[link.source]
                if router.buffer_capacity > 0:
                    q_len = len(self.router_egress_queues.get((link.source, link.id), deque()))
                    q_ratio = q_len / float(router.buffer_capacity)

            is_busy = 1.0 if self.link_busy_until[link.id] > self.sim_time else 0.0
            link_stats[link.id] = {
                "queue_ratio": q_ratio,
                "utilization": is_busy,
                "drop_rate": 0.0,
            }

        scores = self.get_congestion_scores()

        # Update flow stats in SDN Controller
        for flow_id, path in self.flow_paths.items():
            tx = self.total_app_packets_generated.get(flow_id, 0)
            rx = self.total_bytes_delivered.get(flow_id, 0) // max(1, getattr(self.protocols.get(flow_id), "mss", 1000))
            drops = self.total_packets_dropped_overflow.get(flow_id, 0)
            tx_b = self.total_bytes_transmitted.get(flow_id, 0)
            rx_b = self.total_bytes_delivered.get(flow_id, 0)
            goodput = (rx_b * 8.0) / (max(0.001, self.sim_time) * 1_000_000.0)
            loss_pct = (drops / max(1, tx)) * 100.0
            avg_delay = getattr(self.protocols.get(flow_id), "current_rtt_ms", 20.0)

            self.sdn_controller.update_flow_stats(
                flow_id=flow_id,
                tx_packets=tx,
                rx_packets=rx,
                dropped_packets=drops,
                tx_bytes=tx_b,
                rx_bytes=rx_b,
                goodput_mbps=goodput,
                avg_delay_ms=avg_delay,
                sim_time=self.sim_time,
            )

            # Check if any flow has finished recovery
            rec = self.sdn_controller.check_recovery_status(
                flow_id=flow_id,
                sim_time=self.sim_time,
                current_goodput=goodput,
                current_loss_rate=loss_pct,
            )
            if rec:
                self._log_event(
                    SimulationEvent(self.sim_time, EventType.REROUTE_EVENT, flow_id),
                    f"SDN Controller: Performance RECOVERED for {flow_id}! Recovery Time: {rec['recovery_time_ms']} ms, Throughput: {rec['post_throughput_mbps']} Mbps ({rec['throughput_recovery_pct']}%)",
                    category="RECOVERY_COMPLETED",
                    data=rec,
                )

        # Detect overloaded paths via SDN Controller thresholds
        newly_congested = self.sdn_controller.detect_overloaded_paths(link_stats, self.sim_time)
        for item in newly_congested:
            f_id = item["flow_id"]
            self._log_event(
                SimulationEvent(self.sim_time, EventType.CONGESTION_CHECK, f_id),
                f"SDN Controller: OVERLOADED PATH detected on {f_id}! {'; '.join(item['reasons'])}",
                category="CONGESTION_DETECTED",
                data=item,
            )

        # Dynamic SDN Rerouting (Active when adaptive mode or auto_reroute is set)
        if self.auto_reroute or self.sdn_controller.routing_mode == "adaptive":
            for flow_id in list(self.flow_paths.keys()):
                if flow_id in self.sdn_controller.overloaded_flows:
                    alt_path = self.sdn_controller.compute_dynamic_reroute(flow_id, scores)
                    if alt_path and alt_path != self.flow_paths[flow_id]:
                        reason = f"SDN Controller Dynamic Reroute: Shift from congested path {' -> '.join(self.flow_paths[flow_id])} to less-loaded path {' -> '.join(alt_path)}"
                        self.reroute_flow(flow_id, alt_path, reason=reason)
                        self.sdn_controller.notify_reroute_executed(flow_id, alt_path, self.sim_time, reason)

        # Reschedule check in 0.1s
        if self.sim_time < self.max_time:
            self._schedule_event(self.sim_time + 0.1, EventType.CONGESTION_CHECK, "system")

    def get_congestion_scores(self) -> Dict[str, float]:
        """Compute congestion score (0.0 to 1.0) for each link."""
        scores: Dict[str, float] = {}
        for link in self.links.values():
            if not link.is_active:
                scores[link.id] = 1.0
                continue

            # Queue occupancy of source router interface
            q_ratio = 0.0
            if link.source in self.nodes and self.nodes[link.source].type == NodeType.ROUTER:
                router = self.nodes[link.source]
                if router.buffer_capacity > 0:
                    q_len = len(self.router_egress_queues.get((link.source, link.id), deque()))
                    q_ratio = q_len / float(router.buffer_capacity)

            # Link busy ratio
            is_busy = 1.0 if self.link_busy_until[link.id] > self.sim_time else 0.0

            scores[link.id] = min(1.0, 0.7 * q_ratio + 0.3 * is_busy)
        return scores

    def reroute_flow(self, flow_id: str, new_path: List[str], reason: str = "Manual Reroute") -> bool:
        if flow_id not in self.flow_paths:
            return False

        old_path = list(self.flow_paths[flow_id])
        if old_path == new_path:
            return False

        self.flow_paths[flow_id] = list(new_path)
        
        record = {
            "time": round(self.sim_time, 4),
            "flow_id": flow_id,
            "old_path": old_path,
            "new_path": new_path,
            "reason": reason,
        }
        self.reroute_history.append(record)

        self._log_event(
            SimulationEvent(self.sim_time, EventType.REROUTE_EVENT, flow_id),
            f"Traffic for {flow_id} REROUTED from {' -> '.join(old_path)} to {' -> '.join(new_path)}. Reason: {reason}",
            category="TRAFFIC_REROUTE",
            data=record,
        )
        return True

    def _record_snapshot(self) -> None:
        dt = max(0.01, self.sim_time - self.last_metric_window_time)
        self.last_metric_window_time = self.sim_time

        snapshot = {
            "time": round(self.sim_time, 3),
            "flows": {},
            "routers": {},
            "links": {},
        }

        for flow_id, proto in self.protocols.items():
            goodput_bps = (self.window_delivered_bytes[flow_id] * 8.0) / dt
            tx_bps = (self.window_transmitted_bytes[flow_id] * 8.0) / dt
            self.window_delivered_bytes[flow_id] = 0
            self.window_transmitted_bytes[flow_id] = 0

            snapshot["flows"][flow_id] = {
                "cwnd": round(proto.cwnd, 2),
                "ssthresh": round(proto.ssthresh, 2),
                "state": proto.state,
                "rtt_ms": round(proto.rtt * 1000.0, 1),
                "srtt_ms": round(proto.srtt * 1000.0, 1),
                "rto_ms": round(proto.rto * 1000.0, 1),
                "goodput_mbps": round(goodput_bps / 1_000_000.0, 3),
                "tx_throughput_mbps": round(tx_bps / 1_000_000.0, 3),
                "bytes_in_flight": len(self.unacked_packets.get(flow_id, {})),
                "total_delivered_bytes": self.total_bytes_delivered.get(flow_id, 0),
                "total_transmitted_bytes": self.total_bytes_transmitted.get(flow_id, 0),
                "total_drops_overflow": self.total_packets_dropped_overflow.get(flow_id, 0),
                "total_drops_random": self.total_packets_dropped_random.get(flow_id, 0),
                "unneeded_duplicates": self.unneeded_duplicates.get(flow_id, 0),
                "fast_retransmissions": proto.fast_retransmissions,
                "timeout_retransmissions": proto.timeout_retransmissions,
                "active_path": self.flow_paths.get(flow_id, []),
            }

        for router_id in [n.id for n in self.nodes.values() if n.type == NodeType.ROUTER]:
            router_node = self.nodes[router_id]
            tot_q = sum(len(q) for (r, l), q in self.router_egress_queues.items() if r == router_id)
            snapshot["routers"][router_id] = {
                "queue_occupancy_pkts": tot_q,
                "buffer_capacity": router_node.buffer_capacity,
                "utilization_pct": round((tot_q / float(router_node.buffer_capacity) * 100.0) if router_node.buffer_capacity > 0 else 0.0, 1),
            }

        scores = self.get_congestion_scores()
        for link_id, link in self.links.items():
            snapshot["links"][link_id] = {
                "congestion_score": round(scores.get(link_id, 0.0), 3),
                "is_active": link.is_active,
            }

        # Centralized SDN Controller Snapshot
        snapshot["sdn"] = {
            "routing_mode": self.sdn_controller.routing_mode,
            "thresholds": {
                "queue_threshold": round(self.sdn_controller.queue_threshold * 100.0, 1),
                "utilization_threshold": round(self.sdn_controller.utilization_threshold * 100.0, 1),
                "drop_rate_threshold": round(self.sdn_controller.drop_rate_threshold * 100.0, 1),
            },
            "overloaded_count": len(self.sdn_controller.overloaded_flows),
            "overloaded_flows": list(self.sdn_controller.overloaded_flows.values()),
            "total_reroutes": len(self.reroute_history),
            "flow_table": self.sdn_controller.flow_table,
            "recovery_records": self.sdn_controller.recovery_records,
            "latest_recovery": self.sdn_controller.recovery_records[-1] if self.sdn_controller.recovery_records else None,
        }

        self.snapshots.append(snapshot)
        if len(self.snapshots) > 1000:
            self.snapshots.pop(0)

    def get_summary_metrics(self) -> Dict[str, Any]:
        """Calculates final summary metrics for all flows."""
        duration = max(0.001, self.sim_time)
        metrics: Dict[str, Any] = {
            "simulation_duration_s": round(duration, 3),
            "flows": {},
            "jains_fairness_index": 1.0,
            "total_reroutes": len(self.reroute_history),
            "sdn_telemetry": {
                "routing_mode": self.sdn_controller.routing_mode,
                "thresholds": {
                    "queue_threshold": self.sdn_controller.queue_threshold,
                    "utilization_threshold": self.sdn_controller.utilization_threshold,
                    "drop_rate_threshold": self.sdn_controller.drop_rate_threshold,
                },
                "flow_table": self.sdn_controller.flow_table,
                "overloaded_flows": list(self.sdn_controller.overloaded_flows.values()),
                "recovery_records": self.sdn_controller.recovery_records,
                "total_reroutes": len(self.reroute_history),
            },
        }

        goodputs = []
        for flow_id, proto in self.protocols.items():
            total_delivered = self.total_bytes_delivered.get(flow_id, 0)
            avg_goodput_mbps = (total_delivered * 8.0) / (duration * 1_000_000.0)
            goodputs.append(avg_goodput_mbps)

            metrics["flows"][flow_id] = {
                "protocol": proto.__class__.__name__,
                "useful_bytes_delivered": total_delivered,
                "total_bytes_transmitted": self.total_bytes_transmitted.get(flow_id, 0),
                "avg_goodput_mbps": round(avg_goodput_mbps, 3),
                "total_drops_overflow": self.total_packets_dropped_overflow.get(flow_id, 0),
                "total_drops_random": self.total_packets_dropped_random.get(flow_id, 0),
                "total_retransmissions": proto.total_retransmissions,
                "fast_retransmissions": proto.fast_retransmissions,
                "timeout_retransmissions": proto.timeout_retransmissions,
                "unneeded_duplicates": self.unneeded_duplicates.get(flow_id, 0),
                "final_cwnd": round(proto.cwnd, 2),
                "final_ssthresh": round(proto.ssthresh, 2),
                "avg_rtt_ms": round(proto.srtt * 1000.0, 1),
            }

        # Calculate Jain's fairness index: (sum(x_i))^2 / (n * sum(x_i^2))
        if len(goodputs) > 1 and sum(goodputs) > 0:
            sum_g = sum(goodputs)
            sum_sq = sum(g ** 2 for g in goodputs)
            metrics["jains_fairness_index"] = round((sum_g ** 2) / (len(goodputs) * sum_sq), 3)

        return metrics

    def update_node(self, node_id: str, updates: Dict[str, Any]) -> bool:
        """Update node parameters dynamically at runtime."""
        if node_id not in self.nodes:
            return False

        node = self.nodes[node_id]
        for k, v in updates.items():
            if hasattr(node, k):
                setattr(node, k, v)

        flow_id = f"flow_{node_id}"
        if node.type == NodeType.SENDER and flow_id in self.protocols:
            proto = self.protocols[flow_id]
            if "protocol" in updates and updates["protocol"].lower() != proto.__class__.__name__.lower().replace("tcp", ""):
                # Safely reconfigure protocol
                self.protocols[flow_id] = create_protocol(
                    name=updates["protocol"],
                    mss=node.mss,
                    initial_cwnd=proto.cwnd,
                    initial_ssthresh=proto.ssthresh,
                    max_cwnd=node.max_cwnd,
                )
            if "initial_cwnd" in updates and self.sim_time == 0:
                self.protocols[flow_id].cwnd = float(updates["initial_cwnd"])
            if "initial_ssthresh" in updates and self.sim_time == 0:
                self.protocols[flow_id].ssthresh = float(updates["initial_ssthresh"])

        if node.type == NodeType.ROUTER:
            if "buffer_capacity" in updates:
                cap = int(updates["buffer_capacity"])
                node.buffer_capacity = cap
                if cap > 0:
                    dropped_count = 0
                    for (r_id, l_id), queue in self.router_egress_queues.items():
                        if r_id == node_id and len(queue) > cap:
                            while len(queue) > cap:
                                dropped_pkt, _, _ = queue.pop()
                                dropped_count += 1
                                self.total_packets_dropped_overflow[dropped_pkt.flow_id] = (
                                    self.total_packets_dropped_overflow.get(dropped_pkt.flow_id, 0) + 1
                                )
                    if dropped_count > 0:
                        self._log_event(
                            SimulationEvent(self.sim_time, EventType.LINK_STATUS_CHANGE, "system"),
                            f"Router {node_id} buffer capacity reduced to {cap}. Dropped {dropped_count} excess packets.",
                            category="DROP_BUFFER_FULL",
                        )

        if node.type == NodeType.RECEIVER:
            if "receiver_rwnd" in updates:
                node.receiver_rwnd = float(updates["receiver_rwnd"])

        return True

    def override_cwnd(self, flow_id: str, new_cwnd: float) -> bool:
        """Override live cwnd of an active flow."""
        if flow_id in self.protocols:
            self.protocols[flow_id].cwnd = max(1.0, float(new_cwnd))
            self._log_event(
                SimulationEvent(self.sim_time, EventType.LINK_STATUS_CHANGE, flow_id),
                f"Live cwnd overridden to {new_cwnd:.2f} MSS for {flow_id}.",
                category="MANUAL_OVERRIDE",
            )
            return True
        return False

    def update_link(self, link_id: str, updates: Dict[str, Any]) -> bool:
        """Update link parameters dynamically."""
        if link_id not in self.links:
            return False
        link = self.links[link_id]
        for k, v in updates.items():
            if hasattr(link, k):
                setattr(link, k, v)
        self.router.update_topology(self.nodes, self.links)
        return True

    def cut_link(self, link_id: str) -> bool:
        """Cut connection: physically remove link from simulation and recalculate routes."""
        if link_id not in self.links:
            return False
        link = self.links[link_id]
        link.is_active = False

        del self.links[link_id]
        if link_id in self.link_busy_until:
            del self.link_busy_until[link_id]
        keys_to_del = [k for k in self.link_tx_busy.keys() if k[0] == link_id]
        for k in keys_to_del:
            del self.link_tx_busy[k]
        q_keys_to_del = [k for k in self.router_egress_queues.keys() if k[1] == link_id]
        for k in q_keys_to_del:
            del self.router_egress_queues[k]

        self.router.update_topology(self.nodes, self.links)

        # Recalculate routes for any flows that used this link
        for flow_id, path in list(self.flow_paths.items()):
            affected = False
            for i in range(len(path) - 1):
                u, v = path[i], path[i + 1]
                if (link.source == u and link.target == v) or (link.source == v and link.target == u):
                    affected = True
                    break

            if affected:
                src, dst = path[0], path[-1]
                alt_path = self.router.find_shortest_path(src, dst)
                if alt_path:
                    self.reroute_flow(flow_id, alt_path, reason=f"Cable cut on link {link_id}")
                else:
                    self.flow_paths[flow_id] = []
                    self._log_event(
                        SimulationEvent(self.sim_time, EventType.LINK_STATUS_CHANGE, flow_id),
                        f"Cable cut on {link_id}! No alternate path available from {src} to {dst}. Flow disconnected.",
                        category="LINK_FAILURE",
                    )
        return True

    def add_link(self, link_config: LinkConfig) -> bool:
        """Add a new connection to the active simulation."""
        self.links[link_config.id] = link_config
        self.link_busy_until[link_config.id] = 0.0
        self.link_tx_busy[(link_config.id, link_config.source)] = 0.0
        self.link_tx_busy[(link_config.id, link_config.target)] = 0.0
        for n_id in (link_config.source, link_config.target):
            if n_id in self.nodes and self.nodes[n_id].type == NodeType.ROUTER:
                self.router_egress_queues[(n_id, link_config.id)] = deque()
        self.router.update_topology(self.nodes, self.links)

        # Re-check disconnected flows to restore paths
        for flow_id, path in list(self.flow_paths.items()):
            if not path or len(path) < 2:
                sender_id = flow_id.replace("flow_", "")
                sender_node = self.nodes.get(sender_id)
                dst = sender_node.dest_id if sender_node else None
                if dst:
                    restored_path = self.router.find_shortest_path(sender_id, dst)
                    if restored_path:
                        self.flow_paths[flow_id] = restored_path
                        self._log_event(
                            SimulationEvent(self.sim_time, EventType.LINK_STATUS_CHANGE, flow_id),
                            f"New connection {link_config.id} restored path for {flow_id}: {' ➔ '.join(restored_path)}",
                            category="PATH_RESTORED",
                        )
        return True

