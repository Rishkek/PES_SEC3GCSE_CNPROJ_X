from typing import Dict, List, Any, Optional


HELP_DESK_DATA = {
    "topics": [
        {
            "id": "congestion_vs_flow_control",
            "category": "Congestion and flow control",
            "title": "Congestion Control vs Flow Control",
            "slides_ref": "Slides 4, 5, 18",
            "beginner": "Think of flow control as pouring water into a single friend's glass without overflowing it (one sender, one receiver). Congestion control is like city rush hour: even if every car's driver is polite, having 10,000 cars trying to cross a 2-lane bridge causes gridlock across the entire city.",
            "intermediate": "Flow control is end-to-end between one sender and one receiver, bounded by rwnd (receiver advertised window). Congestion control prevents all combined senders from overwhelming intermediate routers, bounded by cwnd. The sender limits in-flight bytes to min(cwnd, rwnd).",
            "advanced": "LastByteSent - LastByteAcked <= min(cwnd, rwnd). Flow control is signaled explicitly in TCP header rwnd field. In standard TCP, congestion control has no explicit network signaling and must be inferred from packet drop (loss-based) or delay (delay-based), except when ECN (RFC 3168) is active.",
            "table": {
                "mechanism": "Flow vs Congestion Windowing",
                "trigger": "Sender calculates transmission allowance",
                "internal_state": "effective_win = min(cwnd, rwnd)",
                "action": "Sender pauses new packet dispatch if in_flight >= effective_win",
                "observable_effect": "Transmission plateaus when either buffer or bottleneck link capacity is reached",
                "why_it_matters": "Distinguishes receiver bottleneck (host capability) from network bottleneck (pipe exhaustion).",
            },
        },
        {
            "id": "tcp_slow_start",
            "category": "TCP state and congestion windows",
            "title": "TCP Slow Start",
            "slides_ref": "Slides 19, 22",
            "beginner": "Despite its name, Slow Start is the fastest growing phase! The sender starts cautiously with 1 segment, but doubles the amount sent every round trip (1 -> 2 -> 4 -> 8...) until reaching ssthresh.",
            "intermediate": "Begins at cwnd = 1 MSS. On every received cumulative ACK, cwnd += 1 MSS. Because an entire window of N packets generates N ACKs over one RTT, cwnd effectively doubles each RTT (exponential growth: cwnd = 2^k).",
            "advanced": "When cwnd reaches ssthresh, the algorithm switches to Congestion Avoidance. If packet loss occurs during Slow Start, ssthresh is set to max(2, cwnd / 2), and cwnd resets or transitions according to the protocol (Tahoe/Reno/CUBIC).",
            "table": {
                "mechanism": "Exponential Window Probing",
                "trigger": "Connection initiation or post-timeout reset",
                "internal_state": "cwnd = 1.0; cwnd < ssthresh",
                "action": "On each ACK: cwnd = cwnd + 1 MSS",
                "observable_effect": "Rapid exponential surge in transmitted packets and throughput",
                "why_it_matters": "Quickly discovers available network bandwidth from a cold start.",
            },
        },
        {
            "id": "tcp_congestion_avoidance",
            "category": "TCP state and congestion windows",
            "title": "TCP Congestion Avoidance (AIMD)",
            "slides_ref": "Slides 20, 21, 25",
            "beginner": "Once the sender is near the danger zone (above ssthresh), it taps the brakes and accelerates gently by only 1 extra packet per round trip (additive increase).",
            "intermediate": "When cwnd >= ssthresh, the sender enters linear growth. For each received ACK, cwnd += MSS * (MSS / cwnd). Over a full window of ACKs in one RTT, cwnd increases by exactly 1 MSS.",
            "advanced": "Additive Increase Multiplicative Decrease (AIMD) provides distributed stability and fairness (converges to optimal efficiency and fairness line on Chiu-Jain phase plots).",
            "table": {
                "mechanism": "Linear Probing (+1 MSS/RTT)",
                "trigger": "cwnd reaches ssthresh",
                "internal_state": "cwnd >= ssthresh; state = CongestionAvoidance",
                "action": "On each ACK: cwnd += (1.0 / cwnd) MSS",
                "observable_effect": "Linear upward slope on cwnd chart until loss occurs",
                "why_it_matters": "Carefully probes for surplus capacity without instantly crashing router queues.",
            },
        },
        {
            "id": "tcp_tahoe",
            "category": "Tahoe",
            "title": "TCP Tahoe (1988) Loss Recovery",
            "slides_ref": "Slides 21, 23, 24, 27, 30",
            "beginner": "Tahoe is conservative: whenever it suspects any congestion (even 3 duplicate ACKs), it panics, sets cwnd all the way back to 1 packet, and starts over from scratch.",
            "intermediate": "On 3 duplicate ACKs or RTO timeout: Tahoe sets ssthresh = max(2, cwnd / 2), resets cwnd = 1 MSS, dupACKcount = 0, and returns to Slow Start. It performs Fast Retransmit but NOT Fast Recovery.",
            "advanced": "Jacobson's original 1988 solution resolved the 1986 internet collapse. However, resetting cwnd to 1 MSS on mild 3-dup-ACK loss severely penalizes throughput on high-bandwidth paths.",
            "table": {
                "mechanism": "Full Reset Loss Recovery",
                "trigger": "3 duplicate ACKs or Timeout",
                "internal_state": "ssthresh = cwnd / 2; cwnd = 1 MSS; state = SlowStart",
                "action": "Retransmit missing packet; restart exponential growth to ssthresh",
                "observable_effect": "Sawtooth drop straight to 1 MSS followed by exponential ramp",
                "why_it_matters": "Historical baseline; completely prevents queue flooding but loses throughput.",
            },
        },
        {
            "id": "tcp_reno",
            "category": "Reno",
            "title": "TCP Reno (1990) Fast Recovery",
            "slides_ref": "Slides 21, 23, 24, 26, 27, 30",
            "beginner": "Reno realizes that 3 duplicate ACKs mean later packets are still reaching the destination! Instead of dropping to 1 packet, it cuts its speed in half and keeps the pipeline moving.",
            "intermediate": "On 3 dup ACKs: ssthresh = cwnd / 2; cwnd = ssthresh + 3 MSS (inflated for packets that exited the network); enters Fast Recovery. On subsequent dup ACKs: cwnd += 1. On recovery ACK: cwnd deflates to ssthresh and enters Congestion Avoidance.",
            "advanced": "Distinguishes mild loss (3 dup ACKs: network still forwarding packets) from severe loss (timeout: pipeline completely drained). Timeout still resets cwnd to 1 MSS.",
            "table": {
                "mechanism": "Fast Retransmit & Fast Recovery",
                "trigger": "dupACKcount == 3",
                "internal_state": "ssthresh = cwnd/2; cwnd = ssthresh + 3; state = FastRecovery",
                "action": "Retransmit missing segment immediately without waiting for RTO timer",
                "observable_effect": "Window halves instead of dropping to 1; resumes linear climb",
                "why_it_matters": "Dramatically improves goodput by keeping packets flowing during recovery.",
            },
        },
        {
            "id": "tcp_cubic",
            "category": "CUBIC",
            "title": "TCP CUBIC (RFC 9438) Growth Function",
            "slides_ref": "Slides 28, 29, 30",
            "beginner": "Instead of crawling forward one step per round trip like Reno, CUBIC remembers where it crashed last time (W_max), rushes back towards it, pauses carefully around it, and then tests higher ground.",
            "intermediate": "CUBIC replaces window increase with a cubic function of elapsed time: W(t) = C*(t - K)^3 + W_max. It cuts cwnd to 0.70 * W_max on loss (gentler than Reno's 0.50 cut). Window growth is independent of RTT.",
            "advanced": "K = cbrt(W_max * (1 - beta) / C). CUBIC exhibits concave growth below W_max (stability near saturation) and convex growth above W_max (rapid probing). Default algorithm in Linux, Windows, macOS.",
            "table": {
                "mechanism": "Time-Dependent Cubic Growth",
                "trigger": "Congestion avoidance epoch progression",
                "internal_state": "W_max = cwnd; ssthresh = 0.7*W_max; K = (0.3*W_max/0.4)^(1/3)",
                "action": "Calculate target window based on wall/sim-clock elapsed time",
                "observable_effect": "Smooth S-shaped curve with plateau at previous bottleneck capacity",
                "why_it_matters": "Enables gigabit/terabit high-delay links to utilize full capacity.",
            },
        },
        {
            "id": "congestion_detection_policy",
            "category": "Congestion detection",
            "title": "Congestion Detection Indicators",
            "slides_ref": "Slides 5, 13, 14, 15",
            "beginner": "Just like traffic cameras spotting highway bottlenecks before cars come to a full stop, routers and controllers monitor queue length, packet delays, and drop rates to detect trouble early.",
            "intermediate": "Monitors 4 key signals: (1) Router queue occupancy ratio (q / Q_max > 70%), (2) Packet drop rate in sliding window, (3) RTT inflation relative to minimum propagation delay, (4) Link utilization exceeding 90%.",
            "advanced": "Hysteresis prevents route flapping. ECN (RFC 3168) marks CE (Congestion Experienced) bits in IP header when queue exceeds threshold, prompting receiver ECE and sender CWR backoff without dropping packets.",
            "table": {
                "mechanism": "Multi-Metric Congestion Evaluation",
                "trigger": "Queue ratio > 0.7 or RTT inflation > 1.8x",
                "internal_state": "congestion_score = 0.7*(q/Q_max) + 0.3*busy_ratio",
                "action": "Triggers congestion alert and invokes routing cost recalculation",
                "observable_effect": "Visual warning on topology node; link highlights red/orange",
                "why_it_matters": "Provides predictive input for traffic rerouting before buffer drops occur.",
            },
        },
        {
            "id": "traffic_rerouting",
            "category": "Traffic rerouting",
            "title": "Dynamic Traffic Rerouting",
            "slides_ref": "Unit 3 Principles & Lab Specification",
            "beginner": "When GPS spots a highway jam, it redirects cars via an alternate bypass road. In our simulator, when the primary link gets congested, flows can be automatically redirected along a secondary path.",
            "intermediate": "Congestion-aware routing updates dynamic link costs: Cost = Base_Cost + Delay + (Congestion_Score * 100). The routing engine calculates alternate Dijkstra paths. If an alternate path has lower congestion and available capacity, flow path is updated.",
            "advanced": "Models in-flight packets and potential transient reordering. Rerouting is not a magic bullet: if the alternative path has higher latency or low bandwidth, performance may only marginally improve or transient packet reordering may occur.",
            "table": {
                "mechanism": "Congestion-Aware Path Diversion",
                "trigger": "Current path congestion score > threshold and alternate path available",
                "internal_state": "flow_path = alternate_path; record reroute timestamp",
                "action": "Subsequent packet departures take the new route",
                "observable_effect": "Animated packet flow shifts to alternate link; queue on old router empties",
                "why_it_matters": "Demonstrates software-defined traffic engineering and SDN rerouting.",
            },
        },
    ]
}


def search_help_desk(query: str = "", category: Optional[str] = None) -> List[Dict[str, Any]]:
    results = HELP_DESK_DATA["topics"]
    if category:
        results = [t for t in results if t["category"].lower() == category.lower()]
    if query:
        q = query.lower()
        results = [
            t for t in results
            if q in t["title"].lower()
            or q in t["beginner"].lower()
            or q in t["intermediate"].lower()
            or q in t["advanced"].lower()
            or q in t["category"].lower()
        ]
    return results


def get_contextual_explanation(context_key: str) -> Optional[Dict[str, Any]]:
    key_lower = context_key.lower()
    mapping = {
        "cwnd": "tcp_slow_start",
        "ssthresh": "tcp_congestion_avoidance",
        "tahoe": "tcp_tahoe",
        "reno": "tcp_reno",
        "cubic": "tcp_cubic",
        "timeout": "tcp_tahoe",
        "fast_retransmit": "tcp_reno",
        "fast_recovery": "tcp_reno",
        "reroute": "traffic_rerouting",
        "queue": "congestion_detection_policy",
        "ecn": "congestion_detection_policy",
        "rwnd": "congestion_vs_flow_control",
    }
    target_id = mapping.get(key_lower, "congestion_vs_flow_control")
    for t in HELP_DESK_DATA["topics"]:
        if t["id"] == target_id:
            return t
    return HELP_DESK_DATA["topics"][0]
