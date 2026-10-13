import pytest
from app.protocols import create_protocol
from app.protocols.tahoe import TCPTahoe
from app.protocols.reno import TCPReno
from app.protocols.cubic import TCPCubic


def test_tahoe_slow_start_and_transition():
    proto = TCPTahoe(mss=1000, initial_cwnd=1.0, initial_ssthresh=4.0)
    assert proto.cwnd == 1.0
    assert proto.state == "SlowStart"

    # 3 new ACKs in slow start -> cwnd goes 1 -> 2 -> 3 -> 4
    proto.on_new_ack(ack_num=1, sim_time=0.1)
    assert proto.cwnd == 2.0
    proto.on_new_ack(ack_num=2, sim_time=0.2)
    assert proto.cwnd == 3.0
    proto.on_new_ack(ack_num=3, sim_time=0.3)
    assert proto.cwnd == 4.0

    # At or above ssthresh -> Congestion Avoidance (+1/cwnd per ACK)
    proto.on_new_ack(ack_num=4, sim_time=0.4)
    assert proto.state == "CongestionAvoidance"
    assert round(proto.cwnd, 3) == round(4.0 + (1.0 / 4.0), 3)


def test_tahoe_triple_duplicate_ack_loss():
    proto = TCPTahoe(mss=1000, initial_cwnd=8.0, initial_ssthresh=16.0)
    # First 2 dup acks: no fast retransmit
    assert proto.on_dup_ack(ack_num=10, sim_time=1.0) is False
    assert proto.on_dup_ack(ack_num=10, sim_time=1.01) is False
    # 3rd dup ack triggers Fast Retransmit
    triggered = proto.on_dup_ack(ack_num=10, sim_time=1.02)
    assert triggered is True
    # Tahoe sets ssthresh = 8 / 2 = 4, cwnd resets to 1 MSS, restarts Slow Start
    assert proto.ssthresh == 4.0
    assert proto.cwnd == 1.0
    assert proto.state == "SlowStart"


def test_reno_fast_recovery_and_deflation():
    proto = TCPReno(mss=1000, initial_cwnd=10.0, initial_ssthresh=16.0)
    proto.on_dup_ack(ack_num=5, sim_time=1.0)
    proto.on_dup_ack(ack_num=5, sim_time=1.01)
    triggered = proto.on_dup_ack(ack_num=5, sim_time=1.02)
    assert triggered is True

    # Reno sets ssthresh = 10 / 2 = 5, cwnd = ssthresh + 3 = 8
    assert proto.ssthresh == 5.0
    assert proto.cwnd == 8.0
    assert proto.state == "FastRecovery"

    # 4th dup ack in Fast Recovery inflates window
    proto.on_dup_ack(ack_num=5, sim_time=1.03)
    assert proto.cwnd == 9.0

    # Recovery ACK arrives: deflates to ssthresh and enters Congestion Avoidance
    proto.on_new_ack(ack_num=6, sim_time=1.1)
    assert proto.cwnd == 5.0
    assert proto.state == "CongestionAvoidance"


def test_cubic_multiplicative_decrease_and_k():
    proto = TCPCubic(mss=1000, initial_cwnd=20.0, initial_ssthresh=32.0, beta=0.7, c=0.4)
    # Trigger 3 dup acks
    proto.on_dup_ack(ack_num=1, sim_time=2.0)
    proto.on_dup_ack(ack_num=1, sim_time=2.01)
    triggered = proto.on_dup_ack(ack_num=1, sim_time=2.02)
    assert triggered is True

    # W_max = 20, ssthresh = 20 * 0.7 = 14
    assert proto.w_max == 20.0
    assert proto.ssthresh == 14.0
    assert proto.cwnd == 14.0
    # K should be calculated
    assert proto.k > 0.0

    # Fast recovery exit
    proto.on_new_ack(ack_num=2, sim_time=2.1)
    assert proto.state == "CongestionAvoidance"


def test_timeout_reset_all_protocols():
    for name in ["tahoe", "reno", "cubic"]:
        proto = create_protocol(name, initial_cwnd=12.0)
        proto.on_timeout(sim_time=3.0)
        assert proto.cwnd == 1.0
        assert proto.state == "SlowStart"
        assert proto.timeout_retransmissions == 1
