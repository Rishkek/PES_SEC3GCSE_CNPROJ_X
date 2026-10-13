from typing import Optional
from .base import TCPBaseProtocol


class TCPTahoe(TCPBaseProtocol):
    """
    TCP Tahoe (1988) implementation.
    - Slow start (exponential growth: cwnd += 1 per ACK)
    - Congestion avoidance (linear growth: cwnd += 1 / cwnd per ACK)
    - Fast retransmit on 3 duplicate ACKs
    - Always cuts cwnd to 1 MSS on loss (both 3-dup-ACK and timeout) and restarts Slow Start
    """

    def on_new_ack(
        self,
        ack_num: int,
        sim_time: float,
        rtt_sample: Optional[float] = None,
        ecn_echo: bool = False,
    ) -> None:
        self.last_ack = ack_num
        self.dup_ack_count = 0
        if rtt_sample is not None:
            self.update_rtt(rtt_sample)

        if ecn_echo:
            # ECN signaled congestion
            self.w_max = self.cwnd
            self.ssthresh = max(2.0, self.cwnd / 2.0)
            self.cwnd = 1.0
            self.state = "SlowStart"
            self.last_congestion_event_time = sim_time
            self.last_congestion_type = "ecn"
            return

        if self.cwnd < self.ssthresh:
            self.state = "SlowStart"
            self.cwnd = min(self.max_cwnd, self.cwnd + 1.0)
        else:
            self.state = "CongestionAvoidance"
            self.cwnd = min(self.max_cwnd, self.cwnd + (1.0 / self.cwnd))

    def on_dup_ack(self, ack_num: int, sim_time: float) -> bool:
        self.dup_ack_count += 1
        if self.dup_ack_count == 3:
            # Fast Retransmit
            self.fast_retransmissions += 1
            self.total_retransmissions += 1
            self.w_max = self.cwnd
            self.ssthresh = max(2.0, self.cwnd / 2.0)
            self.cwnd = 1.0  # Tahoe cuts to 1 MSS
            self.state = "SlowStart"
            self.last_congestion_event_time = sim_time
            self.last_congestion_type = "3_dup_ack"
            return True
        return False

    def on_timeout(self, sim_time: float) -> None:
        self.timeout_retransmissions += 1
        self.total_retransmissions += 1
        self.w_max = self.cwnd
        self.ssthresh = max(2.0, self.cwnd / 2.0)
        self.cwnd = 1.0
        self.dup_ack_count = 0
        self.state = "SlowStart"
        self.last_congestion_event_time = sim_time
        self.last_congestion_type = "timeout"
        # Exponential backoff
        self.rto = min(self.rto * 2.0, 3.0)
