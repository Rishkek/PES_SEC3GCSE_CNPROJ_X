from typing import Dict, Any, Optional
from .base import TCPBaseProtocol


class UDPProtocol(TCPBaseProtocol):
    """
    User Datagram Protocol (UDP) Traffic Engine.
    
    Models connectionless, unacknowledged datagram transmission at a configured
    bit rate (CBR / Constant Bit Rate or burst rate). Does not throttle on loss
    or wait for ACKs, making it the canonical transport protocol to study router
    queue saturation, controlled congestion, and SDN dynamic rerouting.
    """

    def __init__(
        self,
        mss: int = 1000,
        rate_mbps: float = 10.0,
        **kwargs,
    ):
        super().__init__(
            mss=mss,
            initial_cwnd=64.0,
            initial_ssthresh=64.0,
            max_cwnd=128.0,
        )
        self.rate_mbps = float(rate_mbps)
        self.state = "ActiveCBR"
        self.packets_sent = 0
        self.bytes_sent = 0
        self.packets_delivered = 0
        self.bytes_delivered = 0
        self.packets_dropped = 0
        self.current_rtt_ms = 20.0

    def packet_interval_s(self, active_rate_mbps: Optional[float] = None) -> float:
        """Computes time delta between successive UDP packet dispatches."""
        rate = active_rate_mbps if active_rate_mbps is not None else self.rate_mbps
        rate_bps = max(100_000.0, rate * 1_000_000.0)
        return max(0.0001, (self.mss * 8.0) / rate_bps)

    def on_new_ack(
        self,
        ack_num: int,
        sim_time: float,
        rtt_sample: Optional[float] = None,
        ecn_echo: bool = False,
    ) -> None:
        """UDP is connectionless: no ACK processing."""
        pass

    def on_dup_ack(self, ack_num: int, sim_time: float) -> bool:
        """UDP has no ACKs or duplicate ACKs."""
        return False

    def on_timeout(self, sim_time: float) -> None:
        """UDP does not maintain retransmission timers."""
        pass

    def get_state(self) -> Dict[str, Any]:
        """Telemetry representation for analytics and UI dashboards."""
        base = super().get_state()
        base.update({
            "protocol": "UDP",
            "rate_mbps": round(self.rate_mbps, 2),
            "packets_sent": self.packets_sent,
            "bytes_sent": self.bytes_sent,
            "packets_delivered": self.packets_delivered,
            "bytes_delivered": self.bytes_delivered,
            "packets_dropped": self.packets_dropped,
            "state": self.state,
            "loss_rate_pct": round(
                (self.packets_dropped / max(1, self.packets_sent)) * 100.0, 2
            ),
        })
        return base
