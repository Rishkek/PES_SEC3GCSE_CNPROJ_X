from .base import TCPBaseProtocol
from .tahoe import TCPTahoe
from .reno import TCPReno
from .cubic import TCPCubic


def create_protocol(
    name: str,
    mss: int = 1000,
    initial_cwnd: float = 1.0,
    initial_ssthresh: float = 32.0,
    max_cwnd: float = 128.0,
) -> TCPBaseProtocol:
    name_lower = name.lower()
    if "tahoe" in name_lower:
        return TCPTahoe(
            mss=mss,
            initial_cwnd=initial_cwnd,
            initial_ssthresh=initial_ssthresh,
            max_cwnd=max_cwnd,
        )
    elif "cubic" in name_lower:
        return TCPCubic(
            mss=mss,
            initial_cwnd=initial_cwnd,
            initial_ssthresh=initial_ssthresh,
            max_cwnd=max_cwnd,
        )
    else:  # default to Reno
        return TCPReno(
            mss=mss,
            initial_cwnd=initial_cwnd,
            initial_ssthresh=initial_ssthresh,
            max_cwnd=max_cwnd,
        )
