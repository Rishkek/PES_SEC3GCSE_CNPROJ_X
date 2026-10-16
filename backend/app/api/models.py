from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field
from ..network.model import TopologyData


class CreateSimulationRequest(BaseModel):
    topology: TopologyData
    seed: int = 42
    auto_reroute: bool = False


class RunSimulationRequest(BaseModel):
    duration_s: float = 5.0
    max_events: int = 20000


class StepSimulationRequest(BaseModel):
    step_type: str = "event"  # "event" or "rtt"


class RerouteRequest(BaseModel):
    flow_id: str
    new_path: List[str]
    reason: str = "Manual User Reroute"


class CompareExperimentRequest(BaseModel):
    topology: Optional[TopologyData] = None
    duration_s: float = 8.0
    seed: int = 42


class UpdateNodeRequest(BaseModel):
    updates: Dict[str, Any]


class UpdateLinkRequest(BaseModel):
    updates: Dict[str, Any]


class OverrideCwndRequest(BaseModel):
    flow_id: str
    cwnd: Optional[float] = None
    new_cwnd: Optional[float] = None

    def get_cwnd(self) -> float:
        if self.cwnd is not None:
            return self.cwnd
        if self.new_cwnd is not None:
            return self.new_cwnd
        return 1.0


class AddLinkRequest(BaseModel):
    link: Any  # LinkConfig


class UpdateTopologyRequest(BaseModel):
    topology: TopologyData


class SDNModeRequest(BaseModel):
    mode: str = "adaptive"  # "adaptive" or "static"


class SDNThresholdsRequest(BaseModel):
    queue_threshold: Optional[float] = None
    utilization_threshold: Optional[float] = None
    drop_rate_threshold: Optional[float] = None
    latency_inflation_threshold: Optional[float] = None


class InjectCongestionRequest(BaseModel):
    flow_id: Optional[str] = None
    burst_rate_mbps: float = 25.0
    duration_s: float = 1.5


class SDNCompareRequest(BaseModel):
    duration_s: float = 4.0
    seed: int = 42


