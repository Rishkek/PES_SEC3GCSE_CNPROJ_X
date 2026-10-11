# NetLab — Architecture & System Design

## 1. System Overview

**NetLab** is an interactive computer networks simulation and educational engineering tool. It provides a discrete-event network simulator with a React/TypeScript visual workspace designed around the concepts presented in Computer Networks Unit 3 (Congestion Control and Traffic Rerouting).

### High-Level Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React 18 + TS)                 │
│  - ReactFlow Interactive Topology Editor                    │
│  - Recharts Synced Telemetry (cwnd, Goodput, RTT, Queue)    │
│  - Integrated Help Desk (3 Tiers + Mechanism Tables)        │
│  - Simulation Playback Controller (Run/Pause/Step/Speed)    │
└──────────────────────────▲──────────────────────────────────┘
                           │ HTTP REST / WebSocket JSON
┌──────────────────────────▼──────────────────────────────────┐
│                   Backend (FastAPI + Pydantic)               │
│  - Discrete-Event Engine (Priority Queue Min-Heap)          │
│  - Router Model (Finite FIFO Queue, Drop & ECN Marking)     │
│  - Transport Protocols (TCP Tahoe, TCP Reno, TCP CUBIC)     │
│  - Routing Engine (Dijkstra + Dynamic Congestion Cost)      │
│  - Analytics & Scenario Telemetry                           │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Discrete-Event Simulation Model

The simulator executes discrete events ordered chronologically in a priority queue (min-heap):

1. **`PACKET_GENERATE`**: Sender transmits new data segments when permitted by the effective transmission window `min(cwnd, rwnd)`.
2. **`LINK_TRANSMIT_FINISH`**: Serialization delay completed on transmitter link:
   $$\text{Serialization Delay} = \frac{\text{Packet Size (bits)}}{\text{Link Bandwidth (bps)}}$$
3. **`ROUTER_ARRIVAL`**: Packet reaches router interface after propagation delay.
4. **`ROUTER_ENQUEUE` / `DROP`**:
   - If buffer is full ($\text{queue} \ge \text{Buffer Capacity}$), packet is discarded with category `DROP_BUFFER_FULL`.
   - If random link loss occurs, packet discarded with `DROP_RANDOM_LOSS`.
   - If ECN enabled and queue exceeds threshold, CE bit is set on packet.
5. **`ROUTER_DEPART`**: Router transmitter becomes free; front packet in FIFO queue begins transmission.
6. **`RECEIVER_ARRIVAL`**: Cumulative ACK generated:
   - In-order: advances expected sequence number, sends cumulative ACK.
   - Out-of-order: stored in reorder buffer, generates duplicate ACK.
7. **`ACK_ARRIVAL`**: Sender receives ACK:
   - 3 duplicate ACKs trigger Fast Retransmit.
   - New cumulative ACK updates SRTT/RTO, adjusts `cwnd` based on protocol.
8. **`RETRANSMISSION_TIMEOUT`**: RTO timer expires; sender restarts Slow Start and retransmits missing segment.
9. **`CONGESTION_CHECK` & `REROUTE_EVENT`**: Periodic evaluation of queue ratios and dynamic route shifting.

---

## 3. Modeling Assumptions Beyond the Slides

To turn slide conceptual diagrams into an exact discrete-event simulator, the following standard networking assumptions were modeled:
1. **Serialization & Propagation**: Real physical link physics are simulated. A 1000-byte packet on a 10 Mbps link requires $0.8\text{ ms}$ serialization time, plus the configured link propagation delay.
2. **Jacobson/Karn RTO Algorithm (RFC 6298)**:
   $$\text{SRTT} = (1 - \alpha)\text{SRTT} + \alpha \cdot \text{RTT}_{\text{sample}} \quad (\alpha = 0.125)$$
   $$\text{RTTVAR} = (1 - \beta)\text{RTTVAR} + \beta \cdot |\text{SRTT} - \text{RTT}_{\text{sample}}| \quad (\beta = 0.25)$$
   $$\text{RTO} = \text{SRTT} + \max(G, 4 \cdot \text{RTTVAR})$$
3. **Discrete Packet Size**: Standard segment size (MSS) is 1000 or 1400 bytes; ACK packets are modeled as 40 bytes.
4. **Finite Buffers**: Routers enforce finite FIFO buffers (configurable packets, default 10–20 packets, or $-1$ for infinite buffer).
