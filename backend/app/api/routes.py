import uuid
from typing import Dict, Any, Optional
from fastapi import APIRouter, HTTPException, Query

from ..network.model import TopologyData, NodeConfig, LinkConfig, NodeType
from ..simulation.engine import NetworkSimulation
from ..simulation.scenarios import get_scenario_catalog, build_scenario_topology
from ..analytics.help_desk import search_help_desk, get_contextual_explanation
from .models import (
    CreateSimulationRequest,
    RunSimulationRequest,
    StepSimulationRequest,
    RerouteRequest,
    CompareExperimentRequest,
    UpdateNodeRequest,
    UpdateLinkRequest,
    OverrideCwndRequest,
    AddLinkRequest,
    UpdateTopologyRequest,
)

router = APIRouter()

# In-memory simulation registry
simulations: Dict[str, NetworkSimulation] = {}
simulation_configs: Dict[str, Dict[str, Any]] = {}


@router.post("/simulations")
def create_simulation(req: CreateSimulationRequest):
    sim_id = str(uuid.uuid4())[:8]
    sim = NetworkSimulation(
        topology=req.topology,
        seed=req.seed,
        auto_reroute=req.auto_reroute,
    )
    simulations[sim_id] = sim
    simulation_configs[sim_id] = {
        "topology": req.topology,
        "seed": req.seed,
        "auto_reroute": req.auto_reroute,
    }
    return {
        "sim_id": sim_id,
        "status": "ready",
        "sim_time": sim.sim_time,
        "topology": req.topology,
    }


@router.get("/simulations/{sim_id}")
def get_simulation(sim_id: str):
    sim = simulations.get(sim_id)
    if not sim:
        raise HTTPException(status_code=404, detail="Simulation not found")
    
    return {
        "sim_id": sim_id,
        "sim_time": round(sim.sim_time, 4),
        "is_completed": sim.is_completed,
        "active_events": len(sim.event_queue),
        "protocols": {fid: proto.get_state() for fid, proto in sim.protocols.items()},
        "flow_paths": sim.flow_paths,
        "congestion_scores": sim.get_congestion_scores(),
        "summary": sim.get_summary_metrics(),
    }


@router.post("/simulations/{sim_id}/run")
def run_simulation(sim_id: str, req: RunSimulationRequest):
    sim = simulations.get(sim_id)
    if not sim:
        raise HTTPException(status_code=404, detail="Simulation not found")

    target_time = sim.sim_time + req.duration_s
    events_processed = sim.run_until(target_time=target_time, max_events=req.max_events)

    return {
        "sim_id": sim_id,
        "sim_time": round(sim.sim_time, 4),
        "events_processed": events_processed,
        "is_completed": sim.is_completed,
        "latest_snapshot": sim.snapshots[-1] if sim.snapshots else None,
    }


@router.post("/simulations/{sim_id}/step")
def step_simulation(sim_id: str, req: StepSimulationRequest):
    sim = simulations.get(sim_id)
    if not sim:
        raise HTTPException(status_code=404, detail="Simulation not found")

    if req.step_type == "rtt":
        # Step approximately one average RTT (e.g. 100ms or until next batch of ACKs)
        target = sim.sim_time + 0.08
        count = sim.run_until(target_time=target, max_events=500)
        return {
            "sim_id": sim_id,
            "sim_time": round(sim.sim_time, 4),
            "step_type": "rtt",
            "events_processed": count,
            "latest_snapshot": sim.snapshots[-1] if sim.snapshots else None,
        }
    else:
        # Step single discrete event
        evt = sim.step()
        return {
            "sim_id": sim_id,
            "sim_time": round(sim.sim_time, 4),
            "step_type": "event",
            "event": evt,
            "latest_snapshot": sim.snapshots[-1] if sim.snapshots else None,
        }


@router.post("/simulations/{sim_id}/reset")
def reset_simulation(sim_id: str):
    config = simulation_configs.get(sim_id)
    if not config:
        raise HTTPException(status_code=404, detail="Simulation not found")

    sim = NetworkSimulation(
        topology=config["topology"],
        seed=config["seed"],
        auto_reroute=config["auto_reroute"],
    )
    simulations[sim_id] = sim

    return {
        "sim_id": sim_id,
        "status": "reset",
        "sim_time": 0.0,
    }


@router.get("/simulations/{sim_id}/metrics")
def get_metrics(sim_id: str):
    sim = simulations.get(sim_id)
    if not sim:
        raise HTTPException(status_code=404, detail="Simulation not found")

    return {
        "sim_id": sim_id,
        "sim_time": round(sim.sim_time, 4),
        "snapshots": sim.snapshots,
        "summary": sim.get_summary_metrics(),
        "reroute_history": sim.reroute_history,
    }


@router.get("/simulations/{sim_id}/events")
def get_events(
    sim_id: str,
    category: Optional[str] = Query(None),
    limit: int = Query(200, ge=1, le=1000),
):
    sim = simulations.get(sim_id)
    if not sim:
        raise HTTPException(status_code=404, detail="Simulation not found")

    events = sim.event_log
    if category:
        events = [e for e in events if e.get("category") == category]

    return {
        "sim_id": sim_id,
        "total_logged": len(sim.event_log),
        "events": events[-limit:],
    }


@router.post("/simulations/{sim_id}/reroute")
def reroute_traffic(sim_id: str, req: RerouteRequest):
    sim = simulations.get(sim_id)
    if not sim:
        raise HTTPException(status_code=404, detail="Simulation not found")

    success = sim.reroute_flow(req.flow_id, req.new_path, reason=req.reason)
    if not success:
        raise HTTPException(status_code=400, detail="Invalid flow or destination mismatch in new path")

    return {
        "sim_id": sim_id,
        "success": True,
        "flow_id": req.flow_id,
        "active_path": sim.flow_paths.get(req.flow_id),
        "reroute_history": sim.reroute_history,
    }


@router.patch("/simulations/{sim_id}/nodes/{node_id}")
def update_node(sim_id: str, node_id: str, req: UpdateNodeRequest):
    sim = simulations.get(sim_id)
    if not sim:
        raise HTTPException(status_code=404, detail="Simulation not found")

    success = sim.update_node(node_id, req.updates)
    if not success:
        raise HTTPException(status_code=404, detail=f"Node {node_id} not found in simulation")

    return {
        "sim_id": sim_id,
        "node_id": node_id,
        "success": True,
        "node": sim.nodes[node_id].model_dump(),
    }


@router.patch("/simulations/{sim_id}/links/{link_id}")
def update_link(sim_id: str, link_id: str, req: UpdateLinkRequest):
    sim = simulations.get(sim_id)
    if not sim:
        raise HTTPException(status_code=404, detail="Simulation not found")

    success = sim.update_link(link_id, req.updates)
    if not success:
        raise HTTPException(status_code=404, detail=f"Link {link_id} not found in simulation")

    return {
        "sim_id": sim_id,
        "link_id": link_id,
        "success": True,
        "link": sim.links[link_id].model_dump(),
    }


@router.delete("/simulations/{sim_id}/links/{link_id}")
def cut_link(sim_id: str, link_id: str):
    sim = simulations.get(sim_id)
    if not sim:
        raise HTTPException(status_code=404, detail="Simulation not found")

    success = sim.cut_link(link_id)
    if not success:
        raise HTTPException(status_code=404, detail=f"Link {link_id} not found to cut")

    return {
        "sim_id": sim_id,
        "link_id": link_id,
        "cut_link_id": link_id,
        "success": True,
        "active_links": [l.id for l in sim.links.values()],
        "flow_paths": sim.flow_paths,
    }


@router.post("/simulations/{sim_id}/links")
def add_link(sim_id: str, req: AddLinkRequest):
    sim = simulations.get(sim_id)
    if not sim:
        raise HTTPException(status_code=404, detail="Simulation not found")

    link_data = req.link if isinstance(req.link, LinkConfig) else LinkConfig(**req.link)
    sim.add_link(link_data)

    return {
        "sim_id": sim_id,
        "link_id": link_data.id,
        "success": True,
        "flow_paths": sim.flow_paths,
    }


@router.post("/simulations/{sim_id}/override_cwnd")
def override_cwnd(sim_id: str, req: OverrideCwndRequest):
    sim = simulations.get(sim_id)
    if not sim:
        raise HTTPException(status_code=404, detail="Simulation not found")

    target_cwnd = req.get_cwnd()
    success = sim.override_cwnd(req.flow_id, target_cwnd)
    if not success:
        raise HTTPException(status_code=404, detail=f"Flow {req.flow_id} not found")

    return {
        "sim_id": sim_id,
        "flow_id": req.flow_id,
        "cwnd": target_cwnd,
        "new_cwnd": target_cwnd,
        "success": True,
    }


@router.put("/simulations/{sim_id}/topology")
def update_topology(sim_id: str, req: UpdateTopologyRequest):
    sim = simulations.get(sim_id)
    if not sim:
        raise HTTPException(status_code=404, detail="Simulation not found")

    # In-place node & link sync
    sim.nodes = {n.id: n for n in req.topology.nodes}
    sim.links = {l.id: l for l in req.topology.links}
    sim.router.update_topology(sim.nodes, sim.links)

    return {
        "sim_id": sim_id,
        "success": True,
        "nodes_count": len(sim.nodes),
        "links_count": len(sim.links),
    }


@router.get("/scenarios")
def list_scenarios():
    return get_scenario_catalog()


@router.get("/scenarios/{scenario_id}")
def get_scenario(scenario_id: str):
    catalog = get_scenario_catalog()
    meta = next((s for s in catalog if s["id"] == scenario_id), None)
    if not meta:
        raise HTTPException(status_code=404, detail="Scenario not found")

    topology = build_scenario_topology(scenario_id)
    return {
        "meta": meta,
        "topology": topology,
    }


@router.get("/help")
def get_help(q: str = Query("", description="Search query"), category: Optional[str] = Query(None)):
    return search_help_desk(query=q, category=category)


@router.get("/help/context")
def get_help_context(key: str = Query(..., description="Context key, e.g. cwnd, reno, timeout")):
    return get_contextual_explanation(key)


@router.post("/experiments/compare")
def compare_protocols(req: CompareExperimentRequest):
    """
    Controlled comparison: Runs Tahoe, Reno, and CUBIC against identical 
    network topologies and traffic conditions.
    """
    duration = req.duration_s
    results = {}

    protocols = ["tahoe", "reno", "cubic"]
    for proto in protocols:
        # Build identical topology with single sender using proto
        nodes = [
            NodeConfig(id="Sender", label=f"Sender ({proto.upper()})", type=NodeType.SENDER, x=100, y=200, protocol=proto, mss=1000, initial_cwnd=1.0, initial_ssthresh=24.0, dest_id="Receiver"),
            NodeConfig(id="Router", label="Bottleneck Router", type=NodeType.ROUTER, x=400, y=200, buffer_capacity=12),
            NodeConfig(id="Receiver", label="Receiver", type=NodeType.RECEIVER, x=700, y=200),
        ]
        links = [
            LinkConfig(id="L1", source="Sender", target="Router", bandwidth_bps=10_000_000.0, propagation_delay_s=0.015),
            LinkConfig(id="L2", source="Router", target="Receiver", bandwidth_bps=6_000_000.0, propagation_delay_s=0.025, is_bottleneck=True),
        ]
        topo = TopologyData(nodes=nodes, links=links)

        sim = NetworkSimulation(topology=topo, seed=req.seed, auto_reroute=False)
        sim.run_until(duration)

        flow_key = "flow_Sender"
        results[proto] = {
            "snapshots": [
                {
                    "time": s["time"],
                    "cwnd": s["flows"].get(flow_key, {}).get("cwnd", 0),
                    "ssthresh": s["flows"].get(flow_key, {}).get("ssthresh", 0),
                    "goodput_mbps": s["flows"].get(flow_key, {}).get("goodput_mbps", 0),
                    "tx_throughput_mbps": s["flows"].get(flow_key, {}).get("tx_throughput_mbps", 0),
                    "rtt_ms": s["flows"].get(flow_key, {}).get("rtt_ms", 0),
                    "queue_occupancy_pkts": s["routers"].get("Router", {}).get("queue_occupancy_pkts", 0),
                    "total_drops": s["flows"].get(flow_key, {}).get("total_drops_overflow", 0),
                    "retransmissions": s["flows"].get(flow_key, {}).get("fast_retransmissions", 0) + s["flows"].get(flow_key, {}).get("timeout_retransmissions", 0),
                }
                for s in sim.snapshots
            ],
            "summary": sim.get_summary_metrics()["flows"].get(flow_key, {}),
        }

    return {
        "duration_s": duration,
        "seed": req.seed,
        "comparison": results,
    }
