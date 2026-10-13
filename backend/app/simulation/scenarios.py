import json
from typing import Dict, Any, List
from ..network.model import NodeConfig, LinkConfig, NodeType, TopologyData


def get_scenario_catalog() -> List[Dict[str, Any]]:
    return [
        {
            "id": "scenario_1_flow_vs_congestion",
            "title": "Scenario 1: Congestion vs Flow Control",
            "subtitle": "rwnd vs cwnd limits on transmission",
            "category": "Fundamentals",
            "description": "Demonstrates the distinct roles of receiver advertised window (rwnd) and congestion window (cwnd). Effective transmission is strictly bounded by min(cwnd, rwnd).",
            "slides_reference": "Slide 4, 5, 18",
            "guided_steps": [
                "1. Observe initial slow start: cwnd grows exponentially from 1 MSS.",
                "2. When cwnd approaches rwnd (e.g. 16 MSS), bytes in flight plateau at rwnd.",
                "3. Try increasing rwnd in node properties to see the sender utilize the link fully until network congestion occurs.",
            ],
        },
        {
            "id": "scenario_2_infinite_buffer",
            "title": "Scenario 2: Infinite-Buffer Idealization",
            "subtitle": "Throughput caps at R/2, queueing delay explodes",
            "category": "Queueing Theory",
            "description": "Two senders sharing a single router with an idealized infinite buffer. Zero packets are dropped, but queue occupancy climbs indefinitely, causing massive queueing delay.",
            "slides_reference": "Slide 6",
            "guided_steps": [
                "1. Start simulation: two senders send through a shared router.",
                "2. Notice that zero packets are lost because the buffer never overflows.",
                "3. Inspect the RTT chart: queueing delay rises sharply as arrival rate approaches capacity.",
            ],
        },
        {
            "id": "scenario_3_finite_buffer",
            "title": "Scenario 3: Finite Buffers & Retransmission Waste",
            "subtitle": "Buffer drops, premature timeouts, and goodput collapse",
            "category": "Congestion Dynamics",
            "description": "Shared bottleneck with a finite 10-packet queue. Packets drop, timeouts trigger retransmissions, and premature timeouts cause unneeded duplicates that waste link capacity.",
            "slides_reference": "Slides 7, 8, 9",
            "guided_steps": [
                "1. Run simulation: router buffer fills to 10 packets and overflows.",
                "2. Senders detect loss via 3 duplicate ACKs or RTO timeouts.",
                "3. Observe useful delivered goodput fall below total transmitted throughput due to duplicate and retransmitted data.",
            ],
        },
        {
            "id": "scenario_4_multi_hop",
            "title": "Scenario 4: Multi-Hop Congestion Collapse",
            "subtitle": "Upstream capacity wasted by downstream drops",
            "category": "Multi-Hop Networks",
            "description": "Four senders across multiple router hops. Cross-traffic congests downstream links, dropping packets whose upstream transmission capacity was completely wasted.",
            "slides_reference": "Slides 10, 11, 12",
            "guided_steps": [
                "1. Flow A travels across two hops; competing Flow B joins at the second router.",
                "2. When the second router drops Flow A packets, all bandwidth used by Hop 1 is wasted.",
                "3. Inspect the drop logs to see where packets are discarded.",
            ],
        },
        {
            "id": "scenario_5_tahoe_vs_reno",
            "title": "Scenario 5: TCP Tahoe vs TCP Reno",
            "subtitle": "Fast Recovery vs Slow-Start Reset",
            "category": "Protocol Mechanics",
            "description": "Identical network conditions triggering a triple duplicate ACK event. Tahoe resets cwnd to 1 MSS, while Reno halves cwnd and uses Fast Recovery to maintain higher pipeline utilization.",
            "slides_reference": "Slides 21, 23, 24, 26",
            "guided_steps": [
                "1. Both protocols start in Slow Start and ramp up until bottleneck buffer fills.",
                "2. On 3 duplicate ACKs, watch Tahoe drop to 1 MSS and re-climb.",
                "3. Watch Reno enter Fast Recovery (ssthresh + 3) and resume linear increase, avoiding Tahoe's throughput penalty.",
            ],
        },
        {
            "id": "scenario_6_reno_vs_cubic",
            "title": "Scenario 6: TCP Reno vs TCP CUBIC",
            "subtitle": "Additive Increase vs Time-Based Cubic Growth",
            "category": "Modern Transport",
            "description": "High-bandwidth high-latency pipe (100 Mbps, 50 ms delay). Demonstrates Reno's glacial 1 MSS/RTT growth versus CUBIC's rapid return to W_max and plateau behavior.",
            "slides_reference": "Slides 28, 29, 30",
            "guided_steps": [
                "1. Run on high BDP link: Reno takes many RTT rounds to recover from loss.",
                "2. CUBIC cuts to 0.70 * W_max and quickly climbs back along its cubic curve.",
                "3. Notice CUBIC's inflection plateau at W_max before probing higher.",
            ],
        },
        {
            "id": "scenario_7_rerouting_demo",
            "title": "Scenario 7: Congestion Detection & Traffic Rerouting",
            "subtitle": "Dynamic traffic diversion around congested links",
            "category": "Traffic Engineering",
            "description": "A network with primary and secondary routes. When heavy traffic causes queue buildup on the primary link, the congestion detector activates and reroutes traffic over the alternative path.",
            "slides_reference": "Unit 3 Overview & Lab Specification",
            "guided_steps": [
                "1. Primary path is low-latency (10 ms) but limited to 5 Mbps.",
                "2. As traffic ramps up, primary router queue exceeds 70% threshold.",
                "3. Automatic rerouting triggers: traffic switches to secondary 20 Mbps path.",
                "4. Compare before-and-after throughput and packet drops.",
            ],
        },
    ]


def build_scenario_topology(scenario_id: str) -> TopologyData:
    if scenario_id == "scenario_1_flow_vs_congestion":
        nodes = [
            NodeConfig(id="S1", label="Sender 1", type=NodeType.SENDER, x=100, y=200, protocol="reno", mss=1000, initial_cwnd=1.0, initial_ssthresh=32.0, rwnd=16.0, dest_id="Rcv1"),
            NodeConfig(id="Router1", label="Edge Router", type=NodeType.ROUTER, x=350, y=200, buffer_capacity=20),
            NodeConfig(id="Rcv1", label="Receiver 1", type=NodeType.RECEIVER, x=600, y=200, receiver_rwnd=16.0),
        ]
        links = [
            LinkConfig(id="L1", source="S1", target="Router1", bandwidth_bps=10_000_000.0, propagation_delay_s=0.01),
            LinkConfig(id="L2", source="Router1", target="Rcv1", bandwidth_bps=10_000_000.0, propagation_delay_s=0.01),
        ]
        return TopologyData(nodes=nodes, links=links)

    elif scenario_id == "scenario_2_infinite_buffer":
        nodes = [
            NodeConfig(id="HostA", label="Host A", type=NodeType.SENDER, x=100, y=120, protocol="reno", mss=1000, initial_cwnd=2.0, initial_ssthresh=32.0, rwnd=64.0, dest_id="Rcv1"),
            NodeConfig(id="HostB", label="Host B", type=NodeType.SENDER, x=100, y=280, protocol="reno", mss=1000, initial_cwnd=2.0, initial_ssthresh=32.0, rwnd=64.0, dest_id="Rcv1"),
            NodeConfig(id="Router1", label="Infinite Router", type=NodeType.ROUTER, x=380, y=200, buffer_capacity=-1),  # infinite buffer
            NodeConfig(id="Rcv1", label="Shared Receiver", type=NodeType.RECEIVER, x=650, y=200),
        ]
        links = [
            LinkConfig(id="L1", source="HostA", target="Router1", bandwidth_bps=10_000_000.0, propagation_delay_s=0.01),
            LinkConfig(id="L2", source="HostB", target="Router1", bandwidth_bps=10_000_000.0, propagation_delay_s=0.01),
            LinkConfig(id="L3", source="Router1", target="Rcv1", bandwidth_bps=10_000_000.0, propagation_delay_s=0.01, is_bottleneck=True),
        ]
        return TopologyData(nodes=nodes, links=links)

    elif scenario_id == "scenario_3_finite_buffer":
        nodes = [
            NodeConfig(id="HostA", label="Sender A", type=NodeType.SENDER, x=100, y=120, protocol="reno", mss=1000, initial_cwnd=2.0, initial_ssthresh=16.0, rwnd=64.0, dest_id="Rcv1"),
            NodeConfig(id="HostB", label="Sender B", type=NodeType.SENDER, x=100, y=280, protocol="reno", mss=1000, initial_cwnd=2.0, initial_ssthresh=16.0, rwnd=64.0, dest_id="Rcv1"),
            NodeConfig(id="Router1", label="Finite Bottleneck Router", type=NodeType.ROUTER, x=380, y=200, buffer_capacity=10),
            NodeConfig(id="Rcv1", label="Receiver", type=NodeType.RECEIVER, x=650, y=200),
        ]
        links = [
            LinkConfig(id="L1", source="HostA", target="Router1", bandwidth_bps=10_000_000.0, propagation_delay_s=0.01),
            LinkConfig(id="L2", source="HostB", target="Router1", bandwidth_bps=10_000_000.0, propagation_delay_s=0.01),
            LinkConfig(id="L3", source="Router1", target="Rcv1", bandwidth_bps=5_000_000.0, propagation_delay_s=0.02, is_bottleneck=True),
        ]
        return TopologyData(nodes=nodes, links=links)

    elif scenario_id == "scenario_4_multi_hop":
        nodes = [
            NodeConfig(id="HostA", label="Sender A (Blue)", type=NodeType.SENDER, x=80, y=100, protocol="reno", mss=1000, dest_id="RcvA"),
            NodeConfig(id="HostB", label="Sender B (Red)", type=NodeType.SENDER, x=80, y=280, protocol="reno", mss=1000, dest_id="RcvB"),
            NodeConfig(id="R1", label="Router 1", type=NodeType.ROUTER, x=300, y=100, buffer_capacity=15),
            NodeConfig(id="R2", label="Router 2 (Bottleneck)", type=NodeType.ROUTER, x=520, y=190, buffer_capacity=8),
            NodeConfig(id="RcvA", label="Receiver A", type=NodeType.RECEIVER, x=750, y=100),
            NodeConfig(id="RcvB", label="Receiver B", type=NodeType.RECEIVER, x=750, y=280),
        ]
        links = [
            LinkConfig(id="L1", source="HostA", target="R1", bandwidth_bps=10_000_000.0, propagation_delay_s=0.01),
            LinkConfig(id="L2", source="HostB", target="R2", bandwidth_bps=10_000_000.0, propagation_delay_s=0.01),
            LinkConfig(id="L3", source="R1", target="R2", bandwidth_bps=8_000_000.0, propagation_delay_s=0.015),
            LinkConfig(id="L4", source="R2", target="RcvA", bandwidth_bps=5_000_000.0, propagation_delay_s=0.01, is_bottleneck=True),
            LinkConfig(id="L5", source="R2", target="RcvB", bandwidth_bps=5_000_000.0, propagation_delay_s=0.01),
        ]
        return TopologyData(nodes=nodes, links=links)

    elif scenario_id == "scenario_5_tahoe_vs_reno":
        nodes = [
            NodeConfig(id="TahoeSender", label="TCP Tahoe", type=NodeType.SENDER, x=100, y=120, protocol="tahoe", mss=1000, initial_cwnd=1.0, initial_ssthresh=16.0, dest_id="Rcv1"),
            NodeConfig(id="RenoSender", label="TCP Reno", type=NodeType.SENDER, x=100, y=280, protocol="reno", mss=1000, initial_cwnd=1.0, initial_ssthresh=16.0, dest_id="Rcv1"),
            NodeConfig(id="BottleneckRouter", label="Shared Bottleneck", type=NodeType.ROUTER, x=380, y=200, buffer_capacity=12),
            NodeConfig(id="Rcv1", label="Destination", type=NodeType.RECEIVER, x=650, y=200),
        ]
        links = [
            LinkConfig(id="L1", source="TahoeSender", target="BottleneckRouter", bandwidth_bps=10_000_000.0, propagation_delay_s=0.01),
            LinkConfig(id="L2", source="RenoSender", target="BottleneckRouter", bandwidth_bps=10_000_000.0, propagation_delay_s=0.01),
            LinkConfig(id="L3", source="BottleneckRouter", target="Rcv1", bandwidth_bps=6_000_000.0, propagation_delay_s=0.02, is_bottleneck=True),
        ]
        return TopologyData(nodes=nodes, links=links)

    elif scenario_id == "scenario_6_reno_vs_cubic":
        nodes = [
            NodeConfig(id="RenoSender", label="TCP Reno", type=NodeType.SENDER, x=100, y=120, protocol="reno", mss=1400, initial_cwnd=4.0, initial_ssthresh=64.0, dest_id="Rcv1"),
            NodeConfig(id="CubicSender", label="TCP CUBIC", type=NodeType.SENDER, x=100, y=280, protocol="cubic", mss=1400, initial_cwnd=4.0, initial_ssthresh=64.0, dest_id="Rcv1"),
            NodeConfig(id="HighBDP", label="High-BDP Core Router", type=NodeType.ROUTER, x=400, y=200, buffer_capacity=40),
            NodeConfig(id="Rcv1", label="Fat Pipe Receiver", type=NodeType.RECEIVER, x=700, y=200),
        ]
        links = [
            LinkConfig(id="L1", source="RenoSender", target="HighBDP", bandwidth_bps=50_000_000.0, propagation_delay_s=0.02),
            LinkConfig(id="L2", source="CubicSender", target="HighBDP", bandwidth_bps=50_000_000.0, propagation_delay_s=0.02),
            LinkConfig(id="L3", source="HighBDP", target="Rcv1", bandwidth_bps=30_000_000.0, propagation_delay_s=0.04, is_bottleneck=True),
        ]
        return TopologyData(nodes=nodes, links=links)

    elif scenario_id == "scenario_7_rerouting_demo":
        nodes = [
            NodeConfig(id="Source", label="Traffic Source", type=NodeType.SENDER, x=80, y=200, protocol="reno", mss=1000, initial_cwnd=2.0, initial_ssthresh=32.0, dest_id="Dest"),
            NodeConfig(id="R_Primary", label="Router Primary (Low Cap)", type=NodeType.ROUTER, x=340, y=100, buffer_capacity=8),
            NodeConfig(id="R_Backup", label="Router Backup (High Cap)", type=NodeType.ROUTER, x=340, y=300, buffer_capacity=30),
            NodeConfig(id="Dest", label="Traffic Destination", type=NodeType.RECEIVER, x=620, y=200),
        ]
        links = [
            # Primary path: 5 Mbps, 10 ms delay, low capacity
            LinkConfig(id="L_Src_Prim", source="Source", target="R_Primary", bandwidth_bps=5_000_000.0, propagation_delay_s=0.01, cost=1.0, is_bottleneck=True),
            LinkConfig(id="L_Prim_Dst", source="R_Primary", target="Dest", bandwidth_bps=5_000_000.0, propagation_delay_s=0.01, cost=1.0),
            # Backup path: 20 Mbps, 30 ms delay, higher capacity
            LinkConfig(id="L_Src_Back", source="Source", target="R_Backup", bandwidth_bps=20_000_000.0, propagation_delay_s=0.03, cost=5.0),
            LinkConfig(id="L_Back_Dst", source="R_Backup", target="Dest", bandwidth_bps=20_000_000.0, propagation_delay_s=0.03, cost=5.0),
        ]
        return TopologyData(nodes=nodes, links=links)

    else:
        # Default simple topology
        return build_scenario_topology("scenario_1_flow_vs_congestion")
