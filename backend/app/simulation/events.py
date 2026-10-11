from enum import Enum
from typing import Optional, Dict, Any
from ..network.model import Packet


class EventType(str, Enum):
    PACKET_GENERATE = "packet_generate"
    PACKET_DEPART_SENDER = "packet_depart_sender"
    LINK_TRANSMIT_FINISH = "link_transmit_finish"
    ROUTER_ARRIVAL = "router_arrival"
    ROUTER_DEPART = "router_depart"
    RECEIVER_ARRIVAL = "receiver_arrival"
    ACK_DEPART = "ack_depart"
    ACK_ARRIVAL = "ack_arrival"
    RETRANSMISSION_TIMEOUT = "retransmission_timeout"
    FAST_RETRANSMIT = "fast_retransmit"
    CONGESTION_CHECK = "congestion_check"
    REROUTE_EVENT = "reroute_event"
    LINK_STATUS_CHANGE = "link_status_change"


class SimulationEvent:
    _id_counter = 0

    def __init__(
        self,
        time: float,
        event_type: EventType,
        flow_id: str,
        packet: Optional[Packet] = None,
        node_id: Optional[str] = None,
        link_id: Optional[str] = None,
        data: Optional[Dict[str, Any]] = None,
    ):
        SimulationEvent._id_counter += 1
        self.event_id = SimulationEvent._id_counter
        self.time = time
        self.event_type = event_type
        self.flow_id = flow_id
        self.packet = packet
        self.node_id = node_id
        self.link_id = link_id
        self.data = data or {}

    def __lt__(self, other: "SimulationEvent") -> bool:
        if self.time == other.time:
            return self.event_id < other.event_id
        return self.time < other.time

    def to_dict(self) -> Dict[str, Any]:
        return {
            "event_id": self.event_id,
            "time": round(self.time, 4),
            "event_type": self.event_type.value,
            "flow_id": self.flow_id,
            "node_id": self.node_id,
            "link_id": self.link_id,
            "packet_id": self.packet.packet_id if self.packet else None,
            "seq_num": self.packet.seq_num if self.packet else None,
            "is_ack": self.packet.is_ack if self.packet else False,
            "ack_num": self.packet.ack_num if self.packet else None,
            "data": self.data,
        }
