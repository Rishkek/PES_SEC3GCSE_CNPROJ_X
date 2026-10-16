from enum import Enum
from typing import List, Dict, Optional, Set
from pydantic import BaseModel, Field


class NodeType(str, Enum):
    SENDER = "sender"
    RECEIVER = "receiver"
    ROUTER = "router"
    SWITCH = "switch"


class DropPolicy(str, Enum):
    TAIL_DROP = "tail_drop"
    ECN = "ecn"
    RED = "red"


class Packet(BaseModel):
    packet_id: int
    flow_id: str
    source_id: str
    dest_id: str
    seq_num: int
    size_bytes: int = 1000
    created_time: float
    protocol: str = "tcp"  # "tcp" or "udp"
    is_ack: bool = False
    ack_num: int = 0
    is_dup_ack: bool = False
    is_retransmit: bool = False
    retransmit_reason: Optional[str] = None  # "timeout" or "fast_retransmit"
    ecn_marked: bool = False  # CE bit set by congested router
    ecn_echo: bool = False   # ECE flag set by receiver on ACK
    cwr: bool = False        # CWR flag set by sender
    path: List[str] = Field(default_factory=list)
    current_hop: int = 0


class NodeConfig(BaseModel):
    id: str
    label: str
    type: NodeType
    x: float = 0.0
    y: float = 0.0
    
    # Router properties
    buffer_capacity: int = 20  # -1 represents infinite buffer
    drop_policy: DropPolicy = DropPolicy.TAIL_DROP
    ecn_threshold: float = 0.7  # 70% occupancy triggers ECN CE marking
    
    # Sender properties
    protocol: str = "udp"     # "udp", "reno", "tahoe", "cubic"
    mss: int = 1000           # bytes (packet payload size)
    udp_rate_mbps: float = 10.0 # UDP transmission rate in Mbps
    udp_burst_enabled: bool = False
    udp_burst_rate_mbps: float = 25.0 # Spike rate for controlled congestion
    udp_burst_start_s: float = 2.0
    udp_burst_duration_s: float = 1.0
    initial_cwnd: float = 1.0 # in MSS (for TCP)
    initial_ssthresh: float = 32.0 # in MSS (for TCP)
    max_cwnd: float = 128.0   # in MSS
    app_rate_bps: float = 0.0 # 0 = infinite backlog / greedy sender
    app_rate_unit: str = "mbps" # "mbps", "pkts_per_sec", "greedy"
    start_time: float = 0.0   # seconds
    app_stop_time: float = 0.0 # 0 = continuous until sim end
    traffic_burst_size: int = 0 # 0 = unlimited packets
    dest_id: Optional[str] = None
    rwnd: float = 64.0        # receiver advertised window in MSS
    rwnd_unit: str = "mss"    # "mss" or "bytes"
    
    # Router detection thresholds
    queue_threshold: float = 0.70
    rtt_inflation_threshold: float = 1.80
    drop_rate_threshold: float = 0.05
    detection_window_s: float = 0.20

    # Receiver properties
    receiver_rwnd: float = 64.0
    receive_buffer_capacity: int = 64


class LinkConfig(BaseModel):
    id: str
    source: str
    target: str
    bandwidth_bps: float = 10_000_000.0  # 10 Mbps default
    propagation_delay_s: float = 0.02    # 20 ms default
    loss_rate: float = 0.0               # 0.0 to 1.0 random drop probability
    is_active: bool = True
    is_bottleneck: bool = False
    cost: float = 1.0


class TopologyData(BaseModel):
    nodes: List[NodeConfig]
    links: List[LinkConfig]
