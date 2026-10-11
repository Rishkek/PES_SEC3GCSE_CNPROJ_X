from abc import ABC, abstractmethod
from typing import Dict, Any, Optional


class TCPBaseProtocol(ABC):
    def __init__(
        self,
        mss: int = 1000,
        initial_cwnd: float = 1.0,
        initial_ssthresh: float = 32.0,
        max_cwnd: float = 128.0,
    ):
        self.mss = mss
        self.cwnd = float(initial_cwnd)
        self.ssthresh = float(initial_ssthresh)
        self.max_cwnd = float(max_cwnd)
        self.dup_ack_count = 0
        self.state = "SlowStart"  # "SlowStart", "CongestionAvoidance", "FastRecovery"
        
        # ACK and byte tracking
        self.last_ack = 0
        self.bytes_in_flight = 0
        
        # RTT and Jacobson's RTO tracking
        self.rtt = 0.05       # latest RTT sample in seconds
        self.srtt = 0.05      # smoothed RTT
        self.rttvar = 0.025   # RTT variance
        self.rto = 0.2        # retransmission timeout in seconds (min 0.2s, max 3.0s)
        
        # Statistics
        self.total_retransmissions = 0
        self.fast_retransmissions = 0
        self.timeout_retransmissions = 0
        self.last_congestion_event_time = 0.0
        self.last_congestion_type: Optional[str] = None
        self.w_max = float(initial_cwnd)

    def update_rtt(self, sample_rtt: float) -> None:
        """Update SRTT and RTO using Jacobson / Karn's algorithm (RFC 6298)."""
        if sample_rtt <= 0:
            return
        self.rtt = sample_rtt
        if self.srtt is None or self.srtt == 0:
            self.srtt = sample_rtt
            self.rttvar = sample_rtt / 2.0
        else:
            alpha = 0.125
            beta = 0.25
            self.rttvar = (1 - beta) * self.rttvar + beta * abs(self.srtt - sample_rtt)
            self.srtt = (1 - alpha) * self.srtt + alpha * sample_rtt
        
        # RTO = SRTT + max(G, 4 * RTTVAR)
        calculated_rto = self.srtt + max(0.01, 4.0 * self.rttvar)
        self.rto = max(0.2, min(calculated_rto, 3.0))

    @abstractmethod
    def on_new_ack(
        self,
        ack_num: int,
        sim_time: float,
        rtt_sample: Optional[float] = None,
        ecn_echo: bool = False,
    ) -> None:
        pass

    @abstractmethod
    def on_dup_ack(self, ack_num: int, sim_time: float) -> bool:
        """Process duplicate ACK. Returns True if fast retransmit should trigger."""
        pass

    @abstractmethod
    def on_timeout(self, sim_time: float) -> None:
        pass

    def get_state(self) -> Dict[str, Any]:
        return {
            "protocol": self.__class__.__name__,
            "cwnd": round(self.cwnd, 3),
            "ssthresh": round(self.ssthresh, 3),
            "dup_ack_count": self.dup_ack_count,
            "state": self.state,
            "bytes_in_flight": self.bytes_in_flight,
            "rtt": round(self.rtt * 1000.0, 2),  # in ms
            "srtt": round(self.srtt * 1000.0, 2),
            "rto": round(self.rto * 1000.0, 2),
            "total_retransmissions": self.total_retransmissions,
            "fast_retransmissions": self.fast_retransmissions,
            "timeout_retransmissions": self.timeout_retransmissions,
            "w_max": round(self.w_max, 3),
            "last_congestion_type": self.last_congestion_type,
            "last_congestion_event_time": round(self.last_congestion_event_time, 4),
        }
