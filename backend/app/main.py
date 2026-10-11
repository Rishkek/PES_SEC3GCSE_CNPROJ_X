import asyncio
import json
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from .api.routes import router as api_router, simulations

app = FastAPI(
    title="NetLab API — Congestion Detection & Traffic Rerouting Simulator",
    version="1.0.0",
    description="Educational computer networking discrete-event simulation engine with TCP Tahoe, Reno, CUBIC, finite queues, and congestion-aware rerouting.",
)

# Enable CORS for local Vite dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")


@app.get("/")
def root():
    return {
        "app": "NetLab — Congestion Detection & Traffic Rerouting Simulator",
        "version": "1.0.0",
        "api_docs": "/docs",
    }


@app.websocket("/api/v1/ws/{sim_id}")
async def websocket_endpoint(websocket: WebSocket, sim_id: str):
    await websocket.accept()
    try:
        while True:
            # Receive client command (e.g. {"action": "step", "speed": 1.0} or {"action": "stream", "duration": 5.0})
            data_text = await websocket.receive_text()
            msg = json.loads(data_text)
            action = msg.get("action", "tick")

            sim = simulations.get(sim_id)
            if not sim:
                await websocket.send_json({"error": "Simulation not found"})
                continue

            if action == "run_tick":
                dt = float(msg.get("dt", 0.1))
                target = sim.sim_time + dt
                sim.run_until(target)
                latest_snapshot = sim.snapshots[-1] if sim.snapshots else None
                latest_events = sim.event_log[-5:] if sim.event_log else []
                await websocket.send_json({
                    "type": "tick_update",
                    "sim_time": round(sim.sim_time, 4),
                    "snapshot": latest_snapshot,
                    "recent_events": latest_events,
                    "is_completed": sim.is_completed,
                    "protocols": {fid: p.get_state() for fid, p in sim.protocols.items()},
                })
            elif action == "step":
                sim.step()
                latest_snapshot = sim.snapshots[-1] if sim.snapshots else None
                await websocket.send_json({
                    "type": "step_update",
                    "sim_time": round(sim.sim_time, 4),
                    "snapshot": latest_snapshot,
                    "recent_events": sim.event_log[-3:],
                    "is_completed": sim.is_completed,
                })
            elif action == "ping":
                await websocket.send_json({"type": "pong", "sim_time": round(sim.sim_time, 4)})
    except WebSocketDisconnect:
        pass
    except Exception as e:
        pass
