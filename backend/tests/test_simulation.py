import pytest
from app.network.model import NodeConfig, LinkConfig, NodeType, TopologyData
from app.simulation.engine import NetworkSimulation
from app.simulation.scenarios import build_scenario_topology


def test_finite_buffer_overflow_drop():
    # Setup sender, small buffer router, receiver
    nodes = [
        NodeConfig(id="S", label="Sender", type=NodeType.SENDER, protocol="reno", mss=1000, initial_cwnd=2.0, initial_ssthresh=32.0, dest_id="D"),
        NodeConfig(id="R", label="Router", type=NodeType.ROUTER, buffer_capacity=5),  # small buffer of 5 packets
        NodeConfig(id="D", label="Receiver", type=NodeType.RECEIVER),
    ]
    links = [
        LinkConfig(id="L1", source="S", target="R", bandwidth_bps=10_000_000.0, propagation_delay_s=0.01),
        LinkConfig(id="L2", source="R", target="D", bandwidth_bps=2_000_000.0, propagation_delay_s=0.02, is_bottleneck=True),
    ]
    topo = TopologyData(nodes=nodes, links=links)
    sim = NetworkSimulation(topology=topo, seed=42)

    # Run for 2 seconds
    sim.run_until(2.0)

    # Verify packets were delivered and drops occurred due to small 5-packet queue
    summary = sim.get_summary_metrics()
    flow_metrics = summary["flows"]["flow_S"]
    assert flow_metrics["useful_bytes_delivered"] > 0
    assert flow_metrics["total_drops_overflow"] > 0
    assert flow_metrics["total_retransmissions"] > 0


def test_infinite_buffer_zero_drops():
    topo = build_scenario_topology("scenario_2_infinite_buffer")
    sim = NetworkSimulation(topology=topo, seed=42)
    sim.run_until(2.0)

    summary = sim.get_summary_metrics()
    # In infinite buffer scenario, drops must be 0
    for flow in summary["flows"].values():
        assert flow["total_drops_overflow"] == 0


def test_simulation_determinism():
    topo = build_scenario_topology("scenario_3_finite_buffer")
    
    sim1 = NetworkSimulation(topology=topo, seed=123)
    sim1.run_until(1.5)
    m1 = sim1.get_summary_metrics()

    sim2 = NetworkSimulation(topology=topo, seed=123)
    sim2.run_until(1.5)
    m2 = sim2.get_summary_metrics()

    # Fixed seed must produce identical results
    assert m1["flows"]["flow_HostA"]["useful_bytes_delivered"] == m2["flows"]["flow_HostA"]["useful_bytes_delivered"]
    assert m1["flows"]["flow_HostA"]["total_drops_overflow"] == m2["flows"]["flow_HostA"]["total_drops_overflow"]


def test_traffic_rerouting_execution():
    topo = build_scenario_topology("scenario_7_rerouting_demo")
    sim = NetworkSimulation(topology=topo, seed=42, auto_reroute=True)

    # Initially on primary route
    assert sim.flow_paths["flow_Source"] == ["Source", "R_Primary", "Dest"]

    # Run simulation: primary link congests and automatic reroute triggers!
    sim.run_until(3.0)

    # Check reroute history
    assert len(sim.reroute_history) > 0
    last_reroute = sim.reroute_history[-1]
    assert last_reroute["new_path"] == ["Source", "R_Backup", "Dest"]
    assert sim.flow_paths["flow_Source"] == ["Source", "R_Backup", "Dest"]


def test_reno_vs_cubic_distinct_dynamics():
    """Verify Reno and CUBIC exhibit distinct, textbook transport characteristics."""
    topo = build_scenario_topology("scenario_6_reno_vs_cubic")
    sim = NetworkSimulation(topology=topo, seed=42)
    sim.run_until(3.0)

    summary = sim.get_summary_metrics()
    reno = summary["flows"]["flow_RenoSender"]
    cubic = summary["flows"]["flow_CubicSender"]

    # Both must deliver substantial data and recover from congestion
    assert reno["useful_bytes_delivered"] > 200_000
    assert cubic["useful_bytes_delivered"] > 100_000

    # Reno and CUBIC must trigger Fast Retransmit on 3 duplicate ACKs
    assert reno["fast_retransmissions"] > 0
    assert cubic["fast_retransmissions"] > 0

    # Reno must be growing in Congestion Avoidance with high window (> 10 MSS), not stalled at 1.0 MSS
    assert reno["final_cwnd"] > 10.0
    assert cubic["final_cwnd"] > 5.0


def test_tahoe_vs_reno_comparison():
    """Verify Tahoe resets to 1 MSS on loss while Reno enters Fast Recovery."""
    topo = build_scenario_topology("scenario_5_tahoe_vs_reno")
    sim = NetworkSimulation(topology=topo, seed=42)
    sim.run_until(3.0)

    summary = sim.get_summary_metrics()
    tahoe = summary["flows"]["flow_TahoeSender"]
    reno = summary["flows"]["flow_RenoSender"]

    # Both must deliver data
    assert tahoe["useful_bytes_delivered"] > 300_000
    assert reno["useful_bytes_delivered"] > 300_000

    # Reno maintains higher cwnd through Fast Recovery than Tahoe
    assert reno["fast_retransmissions"] > 0
    assert reno["final_cwnd"] > tahoe["final_cwnd"]


def test_router_queue_drains_dynamically():
    """Verify router queue occupancy drains properly and does not remain stuck at buffer capacity."""
    topo = build_scenario_topology("scenario_6_reno_vs_cubic")
    sim = NetworkSimulation(topology=topo, seed=42)
    sim.run_until(3.0)

    # Inspect snapshots after congestion events
    # Queue occupancy must fluctuate and reach 0 or near-0 rather than staying pinned at 40/40
    queue_occupancies = [
        snap["routers"]["HighBDP"]["queue_occupancy_pkts"]
        for snap in sim.snapshots
    ]
    min_occupancy = min(queue_occupancies[20:])  # after initial fill
    assert min_occupancy < 5, f"Queue never drained: min occupancy was {min_occupancy}"


def test_udp_traffic_generation():
    """Verify UDP constant bit rate traffic generation without TCP window/ACK constraints."""
    nodes = [
        NodeConfig(id="UDP_Src", label="UDP Sender", type=NodeType.SENDER, protocol="udp", udp_rate_mbps=10.0, mss=1000, dest_id="UDP_Dst"),
        NodeConfig(id="R1", label="Router", type=NodeType.ROUTER, buffer_capacity=50),
        NodeConfig(id="UDP_Dst", label="UDP Receiver", type=NodeType.RECEIVER),
    ]
    links = [
        LinkConfig(id="L1", source="UDP_Src", target="R1", bandwidth_bps=20_000_000.0, propagation_delay_s=0.005),
        LinkConfig(id="L2", source="R1", target="UDP_Dst", bandwidth_bps=20_000_000.0, propagation_delay_s=0.005),
    ]
    topo = TopologyData(nodes=nodes, links=links)
    sim = NetworkSimulation(topology=topo, seed=42)
    sim.run_until(1.0)

    summary = sim.get_summary_metrics()
    flow = summary["flows"]["flow_UDP_Src"]
    assert flow["useful_bytes_delivered"] > 500_000  # Delivered ~1MB in 1s at 10 Mbps
    assert flow["total_retransmissions"] == 0         # Pure UDP: zero retransmission overhead
    assert flow["unneeded_duplicates"] == 0          # No duplicate ACKs


def test_sdn_controller_congestion_detection_and_reroute():
    """Verify SDN controller detects overloaded path, triggers FLOW_MOD reroute, and measures recovery."""
    topo = build_scenario_topology("scenario_27_sdn_udp_reroute")
    sim = NetworkSimulation(topology=topo, seed=42, auto_reroute=True, routing_mode="adaptive")

    # Initial flow path must use primary core router
    assert sim.flow_paths["flow_UDP_Source"] == ["UDP_Source", "Switch_Ingress", "R_Primary", "Switch_Egress", "UDP_Dest"]

    # Run simulation: controlled cross-traffic injects and saturates R_Primary
    sim.run_until(3.0)

    # SDN Controller must detect overload and reroute to R_Alternate
    assert len(sim.reroute_history) > 0
    assert sim.flow_paths["flow_UDP_Source"] == ["UDP_Source", "Switch_Ingress", "R_Alternate", "Switch_Egress", "UDP_Dest"]

    # Verify SDN Controller flow table telemetry
    flow_table = sim.sdn_controller.flow_table
    assert "flow_UDP_Source" in flow_table
    assert flow_table["flow_UDP_Source"]["protocol"] == "UDP"
    assert flow_table["flow_UDP_Source"]["rx_bytes"] > 0

    # Verify recovery measurement record
    assert len(sim.sdn_controller.recovery_records) > 0
    rec = sim.sdn_controller.recovery_records[0]
    assert rec["recovery_time_ms"] > 0
    assert rec["post_throughput_mbps"] > 0


def test_static_vs_adaptive_routing_comparison():
    """Verify that static routing sustains high loss on congestion while adaptive routing recovers."""
    topo = build_scenario_topology("scenario_28_static_vs_adaptive")

    # 1. Static Mode
    sim_static = NetworkSimulation(topology=topo, seed=42, auto_reroute=False, routing_mode="static")
    sim_static.run_until(3.0)
    static_summary = sim_static.get_summary_metrics()
    static_drops = static_summary["flows"]["flow_UDP_Source"]["total_drops_overflow"]
    assert len(sim_static.reroute_history) == 0  # Static mode never reroutes
    assert static_drops > 0                       # Sustained packet drops

    # 2. Adaptive Mode
    sim_adaptive = NetworkSimulation(topology=topo, seed=42, auto_reroute=True, routing_mode="adaptive")
    sim_adaptive.run_until(3.0)
    adaptive_summary = sim_adaptive.get_summary_metrics()

    # Adaptive mode must execute dynamic rerouting and deliver higher useful goodput
    assert len(sim_adaptive.reroute_history) > 0
    assert sim_adaptive.flow_paths["flow_UDP_Source"] == ["UDP_Source", "Switch_Ingress", "R_Alternate", "Switch_Egress", "UDP_Dest"]
    assert adaptive_summary["flows"]["flow_UDP_Source"]["useful_bytes_delivered"] > static_summary["flows"]["flow_UDP_Source"]["useful_bytes_delivered"]

