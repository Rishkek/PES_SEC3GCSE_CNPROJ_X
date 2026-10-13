from typing import Optional
from .base import TCPBaseProtocol


class TCPReno(TCPBaseProtocol):
    """
    TCP Reno (1990) implementation.
    - Slow start (exponential growth: cwnd += 1 per ACK)
    - Congestion avoidance (linear growth: cwnd += 1 / cwnd per ACK)
    - Fast retransmit & Fast recovery on 3 duplicate ACKs:
      - ssthresh = cwnd / 2
      - cwnd = ssthresh + 3 (inflated for the 3 packets leaving network)
      - On subsequent dup ACKs: cwnd += 1
      - On recovery ACK: deflates cwnd = ssthresh, enters Congestion Avoidance
    - On timeout: cwnd = 1 MSS, ssthresh = cwnd / 2, restarts Slow Start
    """

    def on_new_ack(
        self,
        ack_num: int,
        sim_time: float,
        rtt_sample: Optional[float] = None,
        ecn_echo: bool = False,
    ) -> None:
        self.last_ack = ack_num
        if rtt_sample is not None:
            self.update_rtt(rtt_sample)

        if ecn_echo:
            # ECN signaled congestion: halve cwnd like loss, enter Congestion Avoidance
            self.w_max = self.cwnd
            self.ssthresh = max(2.0, self.cwnd / 2.0)
            self.cwnd = self.ssthresh
            self.dup_ack_count = 0
            self.state = "CongestionAvoidance"
            self.last_congestion_event_time = sim_time
            self.last_congestion_type = "ecn"
            return

        if self.state == "FastRecovery":
            # Recovery ACK received: deflate window back to ssthresh and resume Congestion Avoidance
            self.cwnd = self.ssthresh
            self.dup_ack_count = 0
            self.state = "CongestionAvoidance"
            return

        self.dup_ack_count = 0
        if self.cwnd < self.ssthresh:
            self.state = "SlowStart"
            self.cwnd = min(self.max_cwnd, self.cwnd + 1.0)
        else:
            self.state = "CongestionAvoidance"
            self.cwnd = min(self.max_cwnd, self.cwnd + (1.0 / self.cwnd))

    def on_dup_ack(self, ack_num: int, sim_time: float) -> bool:
        self.dup_ack_count += 1
        if self.dup_ack_count == 3:
            # Enter Fast Retransmit & Fast Recovery
            self.fast_retransmissions += 1
            self.total_retransmissions += 1
            self.w_max = self.cwnd
            self.ssthresh = max(2.0, self.cwnd / 2.0)
            self.cwnd = self.ssthresh + 3.0  # Inflate cwnd
            self.state = "FastRecovery"
            self.last_congestion_event_time = sim_time
            self.last_congestion_type = "3_dup_ack"
            return True
        elif self.dup_ack_count > 3 and self.state == "FastRecovery":
            # Each additional duplicate ACK means one more packet left the network
            self.cwnd = min(self.max_cwnd, self.cwnd + 1.0)
            return False
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
        self.rto = min(self.rto * 2.0, 3.0)
