from typing import Dict, List, Optional, Tuple
import heapq
from ..network.model import NodeConfig, LinkConfig, NodeType


class CongestionPolicy:
    def __init__(
        self,
        queue_ratio_threshold: float = 0.70,     # 70% queue occupancy
        drop_rate_threshold: float = 0.05,        # 5% drops
        rtt_inflation_factor: float = 1.80,       # 1.8x baseline RTT
        utilization_threshold: float = 0.90,      # 90% link utilization
        sustained_window_s: float = 0.2,          # Hysteresis window
    ):
        self.queue_ratio_threshold = queue_ratio_threshold
        self.drop_rate_threshold = drop_rate_threshold
        self.rtt_inflation_factor = rtt_inflation_factor
        self.utilization_threshold = utilization_threshold
        self.sustained_window_s = sustained_window_s


class RoutingEngine:
    def __init__(self, nodes: Dict[str, NodeConfig], links: Dict[str, LinkConfig]):
        self.nodes = nodes
        self.links = links
        self.adjacency: Dict[str, List[Tuple[str, LinkConfig]]] = {}
        self._build_graph()

    def _build_graph(self) -> None:
        self.adjacency = {nid: [] for nid in self.nodes}
        for link in self.links.values():
            if link.is_active:
                if link.source in self.adjacency:
                    self.adjacency[link.source].append((link.target, link))
                # For network simulation, if links are bidirectional:
                if link.target in self.adjacency:
                    self.adjacency[link.target].append((link.source, link))

    def update_topology(self, nodes: Dict[str, NodeConfig], links: Dict[str, LinkConfig]) -> None:
        self.nodes = nodes
        self.links = links
        self._build_graph()

    def find_all_paths(self, src: str, dst: str, max_depth: int = 8) -> List[List[str]]:
        """Find all simple paths from src to dst."""
        results: List[List[str]] = []

        def dfs(current: str, path: List[str], visited: set):
            if current == dst:
                results.append(list(path))
                return
            if len(path) >= max_depth:
                return
            for neighbor, link in self.adjacency.get(current, []):
                if link.is_active and neighbor not in visited:
                    visited.add(neighbor)
                    path.append(neighbor)
                    dfs(neighbor, path, visited)
                    path.pop()
                    visited.remove(neighbor)

        dfs(src, [src], {src})
        return results

    def find_shortest_path(
        self,
        src: str,
        dst: str,
        congestion_scores: Optional[Dict[str, float]] = None,
        congestion_aware: bool = False,
    ) -> Optional[List[str]]:
        """
        Dijkstra shortest path.
        If congestion_aware=True, link cost = base_cost + 10 * delay + 50 * congestion_score
        """
        if src not in self.nodes or dst not in self.nodes:
            return None

        distances: Dict[str, float] = {nid: float("inf") for nid in self.nodes}
        previous: Dict[str, Optional[str]] = {nid: None for nid in self.nodes}
        distances[src] = 0.0

        pq = [(0.0, src)]

        while pq:
            curr_dist, curr_node = heapq.heappop(pq)
            if curr_dist > distances[curr_node]:
                continue
            if curr_node == dst:
                break

            for neighbor, link in self.adjacency.get(curr_node, []):
                if not link.is_active:
                    continue

                # Base cost is propagation delay in ms + configured cost
                edge_cost = link.cost + (link.propagation_delay_s * 1000.0)

                if congestion_aware and congestion_scores:
                    c_score = congestion_scores.get(link.id, 0.0)
                    edge_cost += c_score * 100.0  # heavily penalize congested links

                new_dist = curr_dist + edge_cost
                if new_dist < distances[neighbor]:
                    distances[neighbor] = new_dist
                    previous[neighbor] = curr_node
                    heapq.heappush(pq, (new_dist, neighbor))

        if distances[dst] == float("inf"):
            return None

        # Reconstruct path
        path = []
        curr: Optional[str] = dst
        while curr is not None:
            path.append(curr)
            curr = previous[curr]
        path.reverse()
        return path

    def calculate_path_cost(
        self,
        path: List[str],
        congestion_scores: Optional[Dict[str, float]] = None,
    ) -> Dict[str, float]:
        """Calculates total delay, bottleneck capacity, and congestion score for a path."""
        total_delay = 0.0
        min_capacity = float("inf")
        total_congestion = 0.0

        for i in range(len(path) - 1):
            u, v = path[i], path[i + 1]
            # Find link between u and v
            for nbr, link in self.adjacency.get(u, []):
                if nbr == v and link.is_active:
                    total_delay += link.propagation_delay_s
                    min_capacity = min(min_capacity, link.bandwidth_bps)
                    if congestion_scores:
                        total_congestion += congestion_scores.get(link.id, 0.0)
                    break

        return {
            "total_delay_ms": round(total_delay * 1000.0, 2),
            "bottleneck_capacity_mbps": round(min_capacity / 1_000_000.0, 2) if min_capacity != float("inf") else 0.0,
            "total_congestion_score": round(total_congestion, 3),
        }
