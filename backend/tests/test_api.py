import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.simulation.scenarios import build_scenario_topology

client = TestClient(app)


def test_api_scenarios_catalog():
    resp = client.get("/api/v1/scenarios")
    assert resp.status_code == 200
    scenarios = resp.json()
    assert len(scenarios) >= 7
    ids = [s["id"] for s in scenarios]
    assert "scenario_1_flow_vs_congestion" in ids
    assert "scenario_5_tahoe_vs_reno" in ids


def test_api_scenario_detail():
    resp = client.get("/api/v1/scenarios/scenario_7_rerouting_demo")
    assert resp.status_code == 200
    data = resp.json()
    assert "meta" in data
    assert "topology" in data
    assert len(data["topology"]["nodes"]) == 4


def test_api_create_and_run_simulation():
    topo = build_scenario_topology("scenario_1_flow_vs_congestion")
    # 1. Create
    resp = client.post("/api/v1/simulations", json={
        "topology": topo.model_dump(),
        "seed": 42,
        "auto_reroute": False,
    })
    assert resp.status_code == 200
    sim_data = resp.json()
    sim_id = sim_data["sim_id"]
    assert sim_data["status"] == "ready"

    # 2. Run
    run_resp = client.post(f"/api/v1/simulations/{sim_id}/run", json={"duration_s": 1.0})
    assert run_resp.status_code == 200
    assert run_resp.json()["events_processed"] > 0
    assert run_resp.json()["sim_time"] > 0.8

    # 3. Metrics
    met_resp = client.get(f"/api/v1/simulations/{sim_id}/metrics")
    assert met_resp.status_code == 200
    metrics = met_resp.json()
    assert len(metrics["snapshots"]) > 0
    assert "summary" in metrics

    # 4. Events
    evt_resp = client.get(f"/api/v1/simulations/{sim_id}/events")
    assert evt_resp.status_code == 200
    assert "events" in evt_resp.json()


def test_api_compare_experiment():
    resp = client.post("/api/v1/experiments/compare", json={"duration_s": 2.0, "seed": 42})
    assert resp.status_code == 200
    data = resp.json()
    assert "comparison" in data
    assert "tahoe" in data["comparison"]
    assert "reno" in data["comparison"]
    assert "cubic" in data["comparison"]


def test_api_help_desk():
    resp = client.get("/api/v1/help?q=reno")
    assert resp.status_code == 200
    items = resp.json()
    assert len(items) > 0

    ctx_resp = client.get("/api/v1/help/context?key=cwnd")
    assert ctx_resp.status_code == 200
    ctx_data = ctx_resp.json()
    assert "table" in ctx_data


def test_api_node_and_link_updates():
    topo = build_scenario_topology("scenario_1_flow_vs_congestion")
    resp = client.post("/api/v1/simulations", json={
        "topology": topo.model_dump(),
        "seed": 42,
        "auto_reroute": False,
    })
    sim_id = resp.json()["sim_id"]

    # 1. Update Router Buffer Capacity and ECN threshold
    router_resp = client.patch(
        f"/api/v1/simulations/{sim_id}/nodes/Router1",
        json={"updates": {"buffer_capacity": 30, "ecn_threshold": 0.85}},
    )
    assert router_resp.status_code == 200
    assert router_resp.json()["node"]["buffer_capacity"] == 30

    # 2. Update Sender Application Rate
    sender_resp = client.patch(
        f"/api/v1/simulations/{sim_id}/nodes/S1",
        json={"updates": {"app_rate_bps": 5_000_000.0, "traffic_burst_size": 2}},
    )
    assert sender_resp.status_code == 200
    assert sender_resp.json()["node"]["app_rate_bps"] == 5_000_000.0

    # 3. Update Link Bandwidth and Delay
    link_resp = client.patch(
        f"/api/v1/simulations/{sim_id}/links/L1",
        json={"updates": {"bandwidth_bps": 20_000_000.0, "propagation_delay_s": 0.01}},
    )
    assert link_resp.status_code == 200
    assert link_resp.json()["link"]["bandwidth_bps"] == 20_000_000.0


def test_api_cut_link_and_override_cwnd():
    topo = build_scenario_topology("scenario_7_rerouting_demo")
    resp = client.post("/api/v1/simulations", json={
        "topology": topo.model_dump(),
        "seed": 42,
        "auto_reroute": True,
    })
    sim_id = resp.json()["sim_id"]

    # Run for 0.5s to generate packets and initialize flow
    client.post(f"/api/v1/simulations/{sim_id}/run", json={"duration_s": 0.5})

    # Override live cwnd
    cwnd_resp = client.post(
        f"/api/v1/simulations/{sim_id}/override_cwnd",
        json={"flow_id": "flow_Source", "new_cwnd": 12.0},
    )
    assert cwnd_resp.status_code == 200
    assert cwnd_resp.json()["new_cwnd"] == 12.0

    # Cut bottleneck cable L_Src_Prim
    cut_resp = client.delete(f"/api/v1/simulations/{sim_id}/links/L_Src_Prim")
    assert cut_resp.status_code == 200
    assert cut_resp.json()["cut_link_id"] == "L_Src_Prim"

    # Step simulation after cable cut -> should divert traffic or process remaining
    step_resp = client.post(f"/api/v1/simulations/{sim_id}/step", json={"step_type": "event"})
    assert step_resp.status_code == 200


def test_api_sdn_status_and_mode_toggle():
    """Verify SDN status endpoint, mode toggle, and flow table retrieval."""
    topo = build_scenario_topology("scenario_27_sdn_udp_reroute")
    resp = client.post("/api/v1/simulations", json={
        "topology": topo.model_dump(),
        "seed": 42,
        "auto_reroute": True,
    })
    sim_id = resp.json()["sim_id"]

    # 1. Fetch SDN Status
    sdn_resp = client.get(f"/api/v1/simulations/{sim_id}/sdn")
    assert sdn_resp.status_code == 200
    sdn_data = sdn_resp.json()
    assert "flow_table" in sdn_data
    assert "thresholds" in sdn_data
    assert sdn_data["routing_mode"] == "adaptive"

    # 2. Toggle Mode to Static
    mode_resp = client.post(f"/api/v1/simulations/{sim_id}/sdn/mode", json={"mode": "static"})
    assert mode_resp.status_code == 200
    assert mode_resp.json()["routing_mode"] == "static"
    assert mode_resp.json()["auto_reroute"] is False


def test_api_sdn_thresholds_and_controlled_congestion():
    """Verify threshold updates and injection of controlled congestion."""
    topo = build_scenario_topology("scenario_27_sdn_udp_reroute")
    resp = client.post("/api/v1/simulations", json={
        "topology": topo.model_dump(),
        "seed": 42,
    })
    sim_id = resp.json()["sim_id"]

    # Update thresholds
    thresh_resp = client.post(f"/api/v1/simulations/{sim_id}/sdn/thresholds", json={
        "queue_threshold": 0.65,
        "drop_rate_threshold": 0.04,
    })
    assert thresh_resp.status_code == 200
    assert thresh_resp.json()["thresholds"]["queue_threshold"] == 65.0

    # Inject controlled congestion
    inject_resp = client.post(f"/api/v1/simulations/{sim_id}/sdn/inject_congestion", json={
        "burst_rate_mbps": 30.0,
        "duration_s": 2.0,
    })
    assert inject_resp.status_code == 200
    assert inject_resp.json()["burst_rate_mbps"] == 30.0


def test_api_sdn_compare():
    """Verify head-to-head comparison between Static and Adaptive routing."""
    resp = client.post("/api/v1/sdn/compare", json={"duration_s": 2.5, "seed": 42})
    assert resp.status_code == 200
    data = resp.json()
    assert "static" in data
    assert "adaptive" in data
    assert data["static"]["routing_mode"] == "STATIC"
    assert "ADAPTIVE" in data["adaptive"]["routing_mode"]
    assert data["static"]["reroutes_count"] == 0
    assert data["adaptive"]["reroutes_count"] > 0

