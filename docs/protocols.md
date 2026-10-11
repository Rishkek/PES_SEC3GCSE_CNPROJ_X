# TCP Protocol Specifications & State Machines

## 1. TCP Tahoe (1988)

Implemented strictly according to Van Jacobson's 1988 specification and Unit 3 slides 21, 23, 24, 27:

- **Slow Start**:
  - Initial `cwnd = 1.0 MSS`, `ssthresh = 32.0 MSS`.
  - On each new cumulative ACK: $\text{cwnd} = \min(\text{max\_cwnd}, \text{cwnd} + 1.0)$.
- **Congestion Avoidance**:
  - When $\text{cwnd} \ge \text{ssthresh}$:
    $$\text{cwnd} = \min\left(\text{max\_cwnd}, \text{cwnd} + \frac{1}{\text{cwnd}}\right)$$
    (Results in $+1\text{ MSS}$ per RTT).
- **Reaction to 3 Duplicate ACKs (Fast Retransmit)**:
  - $\text{ssthresh} = \max(2.0, \text{cwnd} / 2.0)$
  - $\text{cwnd} = 1.0\text{ MSS}$ (Tahoe resets to 1 packet!)
  - $\text{state} = \text{"SlowStart"}$
  - Missing packet is retransmitted immediately.
- **Reaction to Timeout**:
  - $\text{ssthresh} = \max(2.0, \text{cwnd} / 2.0)$
  - $\text{cwnd} = 1.0\text{ MSS}$
  - Exponential backoff: $\text{RTO} = \min(3.0, \text{RTO} \times 2.0)$
  - Missing packet is retransmitted; restarts Slow Start.

---

## 2. TCP Reno (1990)

Implemented according to Unit 3 slides 21, 23, 24, 26, 27:

- **Slow Start & Congestion Avoidance**: Same as Tahoe.
- **Reaction to 3 Duplicate ACKs (Fast Retransmit & Fast Recovery)**:
  - $\text{ssthresh} = \max(2.0, \text{cwnd} / 2.0)$
  - $\text{cwnd} = \text{ssthresh} + 3.0\text{ MSS}$ (Window inflated for the 3 packets that left the network).
  - $\text{state} = \text{"FastRecovery"}$
  - Missing packet is retransmitted immediately.
- **During Fast Recovery**:
  - On additional duplicate ACKs: $\text{cwnd} = \text{cwnd} + 1.0\text{ MSS}$.
  - On new cumulative ACK (Recovery ACK acknowledging missing data):
    - Deflate window: $\text{cwnd} = \text{ssthresh}$.
    - $\text{state} = \text{"CongestionAvoidance"}$.
- **Reaction to Timeout**:
  - In any state: $\text{ssthresh} = \max(2.0, \text{cwnd} / 2.0)$, $\text{cwnd} = 1.0\text{ MSS}$, $\text{state} = \text{"SlowStart"}$.

---

## 3. TCP CUBIC (RFC 9438)

Implemented based on RFC 9438 and Unit 3 slides 28, 29, 30:

- **Multiplicative Decrease Factor**: $\beta = 0.70$ (per slide 28: *"CUBIC cuts to 0.70 * W_max, not to half"*).
- **Scaling Constant**: $C = 0.4$.
- **Window Target Function**:
  $$W_{\text{cubic}}(t) = C \cdot (t - K)^3 + W_{\text{max}}$$
  Where:
  $$K = \sqrt[3]{\frac{W_{\text{max}} \cdot (1 - \beta)}{C}}$$
  $t$ is elapsed simulation time since the epoch/last loss event.
- **TCP-Friendliness Region**:
  $$W_{\text{tcp}}(t) = W_{\text{max}} \cdot \beta + \frac{3(1 - \beta)}{1 + \beta} \cdot \frac{t}{\text{SRTT}}$$
  Target window is chosen as $\max(W_{\text{cubic}}(t), W_{\text{tcp}}(t))$.
- **Reaction to 3 Duplicate ACKs**:
  - $W_{\text{max}} = \text{cwnd}$
  - $\text{ssthresh} = \max(2.0, \text{cwnd} \times \beta)$
  - $\text{cwnd} = \text{ssthresh}$
  - Reset epoch: $t_{\text{epoch}} = \text{sim\_time}$, recalculate $K$.
  - State transitions to Congestion Avoidance along the cubic curve.

---

## 4. Jain's Fairness Index

When multiple flows compete over a shared bottleneck, fairness is evaluated using Jain's Index:
$$\mathcal{J}(x_1, x_2, \dots, x_n) = \frac{\left( \sum_{i=1}^n x_i \right)^2}{n \cdot \sum_{i=1}^n x_i^2}$$
Where $x_i$ is the useful delivered goodput of flow $i$. An index of $1.0$ represents perfect fairness, while $1/n$ represents total monopolization by a single flow.
