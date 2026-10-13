import math
from typing import Optional, Dict, Any
from .base import TCPBaseProtocol


class TCPCubic(TCPBaseProtocol):
    """
    TCP CUBIC (RFC 9438) implementation.
    - CUBIC window growth function: W_cubic(t) = C * (t - K)^3 + W_max
    - Multiplicative decrease factor beta = 0.7 (cuts to 0.7 * W_max, per Unit 3 slide 28)
    - C = 0.4 scaling constant
    - Time-based window growth independent of RTT
    - Fast recovery on 3 duplicate ACKs
    """

    def __init__(
        self,
        mss: int = 1000,
        initial_cwnd: float = 1.0,
        initial_ssthresh: float = 32.0,
        max_cwnd: float = 128.0,
        beta: float = 0.7,
        c: float = 0.4,
    ):
        super().__init__(mss, initial_cwnd, initial_ssthresh, max_cwnd)
        self.beta = beta
        self.c = c
        self.epoch_start_time = 0.0
        self.k = 0.0
        self.target_cwnd = float(initial_cwnd)
        self.w_max = float(initial_ssthresh)

    def _calculate_k(self) -> float:
        """Calculate K = cbrt(W_max * (1 - beta) / C)."""
        val = (self.w_max * (1.0 - self.beta)) / self.c
        return math.pow(max(0.0001, val), 1.0 / 3.0)

    def _get_cubic_target(self, sim_time: float) -> float:
        """Calculate target cwnd at simulation time."""
        t = max(0.0, sim_time - self.epoch_start_time)
        dt = t - self.k
        w_cubic = self.c * (dt ** 3) + self.w_max
        
        # TCP-friendly estimate
        rtt_sec = max(0.01, self.srtt)
        w_tcp = (self.w_max * self.beta) + (3.0 * (1.0 - self.beta) / (1.0 + self.beta)) * (t / rtt_sec)
        
        return max(w_cubic, w_tcp)

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
            self.w_max = self.cwnd
            self.ssthresh = max(2.0, self.cwnd * self.beta)
            self.cwnd = self.ssthresh
            self.epoch_start_time = sim_time
            self.k = self._calculate_k()
            self.dup_ack_count = 0
            self.state = "CongestionAvoidance"
            self.last_congestion_event_time = sim_time
            self.last_congestion_type = "ecn"
            return

        if self.state == "FastRecovery":
            # Exit fast recovery
            self.cwnd = self.ssthresh
            self.epoch_start_time = sim_time
            self.k = self._calculate_k()
            self.dup_ack_count = 0
            self.state = "CongestionAvoidance"
            return

        self.dup_ack_count = 0
        if self.cwnd < self.ssthresh:
            self.state = "SlowStart"
            self.cwnd = min(self.max_cwnd, self.cwnd + 1.0)
        else:
            self.state = "CongestionAvoidance"
            self.target_cwnd = self._get_cubic_target(sim_time)
            # Additive increment per ACK towards target
            if self.target_cwnd > self.cwnd:
                increment = (self.target_cwnd - self.cwnd) / self.cwnd
                # Bound increment between standard Reno (1/cwnd) and smooth step
                step = max(1.0 / self.cwnd, min(increment, 1.0))
                self.cwnd = min(self.max_cwnd, self.cwnd + step)
            else:
                self.cwnd = min(self.max_cwnd, self.cwnd + (1.0 / self.cwnd))

    def on_dup_ack(self, ack_num: int, sim_time: float) -> bool:
        self.dup_ack_count += 1
        if self.dup_ack_count == 3:
            self.fast_retransmissions += 1
            self.total_retransmissions += 1
            self.w_max = self.cwnd
            self.ssthresh = max(2.0, self.cwnd * self.beta)
            self.cwnd = self.ssthresh
            self.epoch_start_time = sim_time
            self.k = self._calculate_k()
            self.state = "FastRecovery"
            self.last_congestion_event_time = sim_time
            self.last_congestion_type = "3_dup_ack"
            return True
        elif self.dup_ack_count > 3 and self.state == "FastRecovery":
            # In Fast Recovery
            return False
        return False

    def on_timeout(self, sim_time: float) -> None:
        self.timeout_retransmissions += 1
        self.total_retransmissions += 1
        self.w_max = self.cwnd
        self.ssthresh = max(2.0, self.cwnd * self.beta)
        self.cwnd = 1.0
        self.dup_ack_count = 0
        self.epoch_start_time = sim_time
        self.k = self._calculate_k()
        self.state = "SlowStart"
        self.last_congestion_event_time = sim_time
        self.last_congestion_type = "timeout"
        self.rto = min(self.rto * 2.0, 3.0)

    def get_state(self) -> Dict[str, Any]:
        st = super().get_state()
        st.update({
            "beta": self.beta,
            "c_factor": self.c,
            "k_deadline": round(self.k, 4),
            "target_cwnd": round(self.target_cwnd, 3),
            "time_in_epoch": round(max(0.0, st["last_congestion_event_time"]), 4),
        })
        return st
