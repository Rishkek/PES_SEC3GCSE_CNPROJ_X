from typing import Dict, List, Optional, Tuple, Any
import heapq
from ..network.model import NodeConfig, LinkConfig, NodeType


class CongestionPolicy:
    def __init__(
        self,
        queue_ratio_threshold: float = 0.70,     # 70% queue occupancy
        drop_rate_threshold: float = 0.05,        # 5% drops
        rtt_inflation_factor: float = 1.80,       # 1.8x baseline RTT
        utilization_threshold: float = 0.90,      # 90% link utilization
        sustained_window_s: float = 0.2,          # Hysteresis window
    ):
        self.queue_ratio_threshold = queue_ratio_threshold
        self.drop_rate_threshold = drop_rate_threshold
        self.rtt_inflation_factor = rtt_inflation_factor
        self.utilization_threshold = utilization_threshold
        self.sustained_window_s = sustained_window_s


class RoutingEngine:
    def __init__(self, nodes: Dict[str, NodeConfig], links: Dict[str, LinkConfig]):
        self.nodes = nodes
        self.links = links
        self.adjacency: Dict[str, List[Tuple[str, LinkConfig]]] = {}
        self._build_graph()

    def _build_graph(self) -> None:
        self.adjacency = {nid: [] for nid in self.nodes}
        for link in self.links.values():
            if link.is_active:
                if link.source in self.adjacency:
                    self.adjacency[link.source].append((link.target, link))
                # For network simulation, if links are bidirectional:
                if link.target in self.adjacency:
                    self.adjacency[link.target].append((link.source, link))

    def update_topology(self, nodes: Dict[str, NodeConfig], links: Dict[str, LinkConfig]) -> None:
        self.nodes = nodes
        self.links = links
        self._build_graph()

    def find_all_paths(self, src: str, dst: str, max_depth: int = 8) -> List[List[str]]:
        """Find all simple paths from src to dst."""
        results: List[List[str]] = []

        def dfs(current: str, path: List[str], visited: set):
            if current == dst:
                results.append(list(path))
                return
            if len(path) >= max_depth:
                return
            for neighbor, link in self.adjacency.get(current, []):
                if link.is_active and neighbor not in visited:
                    visited.add(neighbor)
                    path.append(neighbor)
                    dfs(neighbor, path, visited)
                    path.pop()
                    visited.remove(neighbor)

        dfs(src, [src], {src})
        return results

    def find_shortest_path(
        self,
        src: str,
        dst: str,
        congestion_scores: Optional[Dict[str, float]] = None,
        congestion_aware: bool = False,
    ) -> Optional[List[str]]:
        """
        Dijkstra shortest path.
        If congestion_aware=True, link cost = base_cost + 10 * delay + 50 * congestion_score
        """
        if src not in self.nodes or dst not in self.nodes:
            return None

        distances: Dict[str, float] = {nid: float("inf") for nid in self.nodes}
        previous: Dict[str, Optional[str]] = {nid: None for nid in self.nodes}
        distances[src] = 0.0

        pq = [(0.0, src)]

        while pq:
            curr_dist, curr_node = heapq.heappop(pq)
            if curr_dist > distances[curr_node]:
                continue
            if curr_node == dst:
                break

            for neighbor, link in self.adjacency.get(curr_node, []):
                if not link.is_active:
                    continue

                # Base cost is propagation delay in ms + configured cost
                edge_cost = link.cost + (link.propagation_delay_s * 1000.0)

                if congestion_aware and congestion_scores:
                    c_score = congestion_scores.get(link.id, 0.0)
                    edge_cost += c_score * 100.0  # heavily penalize congested links

                new_dist = curr_dist + edge_cost
                if new_dist < distances[neighbor]:
                    distances[neighbor] = new_dist
                    previous[neighbor] = curr_node
                    heapq.heappush(pq, (new_dist, neighbor))

        if distances[dst] == float("inf"):
            return None

        # Reconstruct path
        path = []
        curr: Optional[str] = dst
        while curr is not None:
            path.append(curr)
            curr = previous[curr]
        path.reverse()
        return path

    def calculate_path_cost(
        self,
        path: List[str],
        congestion_scores: Optional[Dict[str, float]] = None,
    ) -> Dict[str, float]:
        """Calculates total delay, bottleneck capacity, and congestion score for a path."""
        total_delay = 0.0
        min_capacity = float("inf")
        total_congestion = 0.0

        for i in range(len(path) - 1):
            u, v = path[i], path[i + 1]
            # Find link between u and v
            for nbr, link in self.adjacency.get(u, []):
                if nbr == v and link.is_active:
                    total_delay += link.propagation_delay_s
                    min_capacity = min(min_capacity, link.bandwidth_bps)
                    if congestion_scores:
                        total_congestion += congestion_scores.get(link.id, 0.0)
                    break

        return {
            "total_delay_ms": round(total_delay * 1000.0, 2),
            "bottleneck_capacity_mbps": round(min_capacity / 1_000_000.0, 2) if min_capacity != float("inf") else 0.0,
            "total_congestion_score": round(total_congestion, 3),
        }


class SDNController:
    """
    Centralized Software-Defined Network (SDN) Controller.
    
    Implements:
    1. Flow Statistics Monitoring: OpenFlow flow table with packet, byte, rate, and delay counters.
    2. Programmable Congestion Thresholds: Queue %, link utilization %, and packet drop rate %.
    3. Overloaded Path Detection: Proactive link inspection across assigned flow routes.
    4. Dynamic Rerouting Engine: FLOW_MOD rule injection to shift traffic to least-loaded paths.
    5. Performance & Recovery Measurement: Precise timing and throughput restoration metrics.
    6. Dual Routing Modes: Static (fixed routing) vs Adaptive (SDN dynamic rerouting).
    """

    def __init__(
        self,
        routing_engine: RoutingEngine,
        queue_threshold: float = 0.70,
        utilization_threshold: float = 0.85,
        drop_rate_threshold: float = 0.03,
        latency_inflation_threshold: float = 1.80,
        routing_mode: str = "adaptive",
    ):
        self.routing_engine = routing_engine
        self.queue_threshold = queue_threshold
        self.utilization_threshold = utilization_threshold
        self.drop_rate_threshold = drop_rate_threshold
        self.latency_inflation_threshold = latency_inflation_threshold
        self.routing_mode = routing_mode  # "adaptive" | "static"

        # OpenFlow-like Flow Table: flow_id -> rule dict
        self.flow_table: Dict[str, Dict[str, Any]] = {}

        # Overloaded paths tracking: flow_id -> overload details
        self.overloaded_flows: Dict[str, Dict[str, Any]] = {}

        # Completed recovery records
        self.recovery_records: List[Dict[str, Any]] = []

        # Pending recovery timers: flow_id -> data
        self.pending_recoveries: Dict[str, Dict[str, Any]] = {}

    def install_flow_rule(
        self,
        flow_id: str,
        src: str,
        dst: str,
        protocol: str,
        path: List[str],
        rate_mbps: float = 10.0,
    ) -> None:
        """Installs or updates an OpenFlow-style forwarding rule."""
        self.flow_table[flow_id] = {
            "flow_id": flow_id,
            "src": src,
            "dst": dst,
            "protocol": protocol.upper(),
            "path": list(path),
            "rate_mbps": rate_mbps,
            "tx_packets": 0,
            "rx_packets": 0,
            "dropped_packets": 0,
            "tx_bytes": 0,
            "rx_bytes": 0,
            "goodput_mbps": 0.0,
            "loss_rate_pct": 0.0,
            "avg_delay_ms": 20.0,
            "health_status": "OPTIMAL",
            "last_updated": 0.0,
        }

    def update_flow_stats(
        self,
        flow_id: str,
        tx_packets: int,
        rx_packets: int,
        dropped_packets: int,
        tx_bytes: int,
        rx_bytes: int,
        goodput_mbps: float,
        avg_delay_ms: float,
        sim_time: float,
    ) -> None:
        """Updates live flow statistics collected from OpenFlow port/flow counters."""
        if flow_id not in self.flow_table:
            return
        rule = self.flow_table[flow_id]
        rule["tx_packets"] = tx_packets
        rule["rx_packets"] = rx_packets
        rule["dropped_packets"] = dropped_packets
        rule["tx_bytes"] = tx_bytes
        rule["rx_bytes"] = rx_bytes
        rule["goodput_mbps"] = round(goodput_mbps, 2)
        rule["avg_delay_ms"] = round(avg_delay_ms, 2)
        total_attempts = tx_packets + dropped_packets
        rule["loss_rate_pct"] = round((dropped_packets / max(1, total_attempts)) * 100.0, 2)
        rule["last_updated"] = round(sim_time, 4)

    def detect_overloaded_paths(
        self,
        link_stats: Dict[str, Dict[str, float]],
        sim_time: float,
    ) -> List[Dict[str, Any]]:
        """
        Inspects all active flow paths against programmable congestion thresholds.
        Returns list of newly detected overloaded flows with breach evidence.
        """
        newly_congested = []
        for flow_id, rule in list(self.flow_table.items()):
            path = rule["path"]
            is_overloaded = False
            breach_reasons = []

            for i in range(len(path) - 1):
                u, v = path[i], path[i + 1]
                # Identify link
                for nbr, link in self.routing_engine.adjacency.get(u, []):
                    if nbr == v and link.is_active:
                        stats = link_stats.get(link.id, {})
                        q_ratio = stats.get("queue_ratio", 0.0)
                        util = stats.get("utilization", 0.0)
                        drop_rate = stats.get("drop_rate", 0.0)

                        if q_ratio >= self.queue_threshold:
                            is_overloaded = True
                            breach_reasons.append(
                                f"Queue occupancy {round(q_ratio * 100, 1)}% >= threshold {round(self.queue_threshold * 100, 1)}% on link {link.id}"
                            )
                        if util >= self.utilization_threshold:
                            is_overloaded = True
                            breach_reasons.append(
                                f"Utilization {round(util * 100, 1)}% >= threshold {round(self.utilization_threshold * 100, 1)}% on link {link.id}"
                            )
                        if drop_rate >= self.drop_rate_threshold:
                            is_overloaded = True
                            breach_reasons.append(
                                f"Drop rate {round(drop_rate * 100, 1)}% >= threshold {round(self.drop_rate_threshold * 100, 1)}% on link {link.id}"
                            )

            if is_overloaded:
                rule["health_status"] = "CONGESTED"
                if flow_id not in self.overloaded_flows:
                    self.overloaded_flows[flow_id] = {
                        "flow_id": flow_id,
                        "detected_time": round(sim_time, 4),
                        "path": list(path),
                        "reasons": breach_reasons,
                    }
                    if flow_id not in self.pending_recoveries:
                        self.pending_recoveries[flow_id] = {
                            "flow_id": flow_id,
                            "t_congestion": sim_time,
                            "pre_goodput": max(0.5, rule["goodput_mbps"]),
                            "t_reroute": None,
                            "old_path": list(path),
                        }
                    newly_congested.append(self.overloaded_flows[flow_id])
            else:
                if rule["health_status"] == "CONGESTED":
                    rule["health_status"] = "OPTIMAL"
                if flow_id in self.overloaded_flows:
                    del self.overloaded_flows[flow_id]

        return newly_congested

    def compute_dynamic_reroute(
        self,
        flow_id: str,
        link_congestion_scores: Dict[str, float],
    ) -> Optional[List[str]]:
        """
        Calculates an optimal, less-loaded path through the SDN network.
        If routing_mode is 'static', rerouting is disabled.
        """
        if self.routing_mode == "static":
            return None

        if flow_id not in self.flow_table:
            return None

        rule = self.flow_table[flow_id]
        src, dst = rule["src"], rule["dst"]
        current_path = rule["path"]

        all_paths = self.routing_engine.find_all_paths(src, dst)
        if not all_paths:
            return None

        current_cost = self.routing_engine.calculate_path_cost(current_path, link_congestion_scores)

        best_path = None
        lowest_congestion = current_cost["total_congestion_score"]

        for alt_path in all_paths:
            if alt_path == current_path:
                continue
            alt_cost = self.routing_engine.calculate_path_cost(alt_path, link_congestion_scores)
            if alt_cost["total_congestion_score"] < lowest_congestion:
                lowest_congestion = alt_cost["total_congestion_score"]
                best_path = alt_path

        return best_path

    def notify_reroute_executed(
        self,
        flow_id: str,
        new_path: List[str],
        sim_time: float,
        reason: str,
    ) -> None:
        """Records FLOW_MOD execution in SDN controller state."""
        if flow_id in self.flow_table:
            self.flow_table[flow_id]["path"] = list(new_path)
            self.flow_table[flow_id]["health_status"] = "REROUTED"

        if flow_id in self.pending_recoveries:
            self.pending_recoveries[flow_id]["t_reroute"] = sim_time
            self.pending_recoveries[flow_id]["new_path"] = list(new_path)
            self.pending_recoveries[flow_id]["reason"] = reason

    def check_recovery_status(
        self,
        flow_id: str,
        sim_time: float,
        current_goodput: float,
        current_loss_rate: float,
    ) -> Optional[Dict[str, Any]]:
        """
        Evaluates whether throughput has recovered following dynamic rerouting.
        Returns recovery metrics record when recovery threshold is achieved.
        """
        if flow_id not in self.pending_recoveries:
            return None

        rec = self.pending_recoveries[flow_id]
        t_reroute = rec.get("t_reroute")

        # Must have completed reroute and allowed settling time
        if t_reroute is not None and sim_time >= t_reroute + 0.10:
            pre_goodput = rec.get("pre_goodput", 1.0)
            if current_goodput >= 0.70 * pre_goodput and current_loss_rate <= 2.0:
                recovery_time_ms = round((sim_time - rec["t_congestion"]) * 1000.0, 1)
                recovery_record = {
                    "flow_id": flow_id,
                    "t_congestion": round(rec["t_congestion"], 3),
                    "t_reroute": round(t_reroute, 3),
                    "t_recovered": round(sim_time, 3),
                    "recovery_time_ms": recovery_time_ms,
                    "pre_throughput_mbps": round(pre_goodput, 2),
                    "post_throughput_mbps": round(current_goodput, 2),
                    "throughput_recovery_pct": round((current_goodput / max(0.1, pre_goodput)) * 100.0, 1),
                    "old_path": rec["old_path"],
                    "new_path": rec.get("new_path", []),
                    "routing_mode": self.routing_mode,
                }
                self.recovery_records.append(recovery_record)
                del self.pending_recoveries[flow_id]
                return recovery_record

        return None

