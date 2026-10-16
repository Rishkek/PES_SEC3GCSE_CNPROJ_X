import {
  TopologyData,
  SimulationSnapshot,
  EventLogEntry,
  ScenarioMeta,
  HelpDeskTopic,
  RerouteRecord,
  NodeConfig,
  LinkConfig,
} from '../types';

const API_BASE = '/api/v1';

export async function createSimulation(topology: TopologyData, seed = 42, autoReroute = false) {
  const res = await fetch(`${API_BASE}/simulations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topology, seed, auto_reroute: autoReroute }),
  });
  if (!res.ok) throw new Error(`Failed to create simulation: ${res.statusText}`);
  return res.json();
}

export async function getSimulation(simId: string) {
  const res = await fetch(`${API_BASE}/simulations/${simId}`);
  if (!res.ok) throw new Error(`Failed to get simulation: ${res.statusText}`);
  return res.json();
}

export async function runSimulation(simId: string, durationS = 1.0) {
  const res = await fetch(`${API_BASE}/simulations/${simId}/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ duration_s: durationS }),
  });
  if (!res.ok) throw new Error(`Failed to run simulation: ${res.statusText}`);
  return res.json();
}

export async function stepSimulation(simId: string, stepType: 'event' | 'rtt' = 'event') {
  const res = await fetch(`${API_BASE}/simulations/${simId}/step`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ step_type: stepType }),
  });
  if (!res.ok) throw new Error(`Failed to step simulation: ${res.statusText}`);
  return res.json();
}

export async function resetSimulation(simId: string) {
  const res = await fetch(`${API_BASE}/simulations/${simId}/reset`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(`Failed to reset simulation: ${res.statusText}`);
  return res.json();
}

export async function getMetrics(simId: string): Promise<{
  sim_time: number;
  snapshots: SimulationSnapshot[];
  summary: any;
  reroute_history: RerouteRecord[];
}> {
  const res = await fetch(`${API_BASE}/simulations/${simId}/metrics`);
  if (!res.ok) throw new Error(`Failed to get metrics: ${res.statusText}`);
  return res.json();
}

export async function getEvents(simId: string, category?: string): Promise<{
  total_logged: number;
  events: EventLogEntry[];
}> {
  const url = category
    ? `${API_BASE}/simulations/${simId}/events?category=${encodeURIComponent(category)}`
    : `${API_BASE}/simulations/${simId}/events`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to get events: ${res.statusText}`);
  return res.json();
}

export async function rerouteTraffic(simId: string, flowId: string, newPath: string[], reason = 'Manual Reroute') {
  const res = await fetch(`${API_BASE}/simulations/${simId}/reroute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ flow_id: flowId, new_path: newPath, reason }),
  });
  if (!res.ok) throw new Error(`Failed to reroute traffic: ${res.statusText}`);
  return res.json();
}

export async function listScenarios(): Promise<ScenarioMeta[]> {
  const res = await fetch(`${API_BASE}/scenarios`);
  if (!res.ok) throw new Error(`Failed to list scenarios: ${res.statusText}`);
  return res.json();
}

export async function getScenario(scenarioId: string): Promise<{ meta: ScenarioMeta; topology: TopologyData }> {
  const res = await fetch(`${API_BASE}/scenarios/${scenarioId}`);
  if (!res.ok) throw new Error(`Failed to get scenario: ${res.statusText}`);
  return res.json();
}

export async function searchHelpDesk(query = '', category?: string): Promise<HelpDeskTopic[]> {
  const params = new URLSearchParams();
  if (query) params.append('q', query);
  if (category) params.append('category', category);
  const res = await fetch(`${API_BASE}/help?${params.toString()}`);
  if (!res.ok) throw new Error(`Failed to search help desk: ${res.statusText}`);
  return res.json();
}

export async function getHelpContext(key: string): Promise<HelpDeskTopic> {
  const res = await fetch(`${API_BASE}/help/context?key=${encodeURIComponent(key)}`);
  if (!res.ok) throw new Error(`Failed to get context: ${res.statusText}`);
  return res.json();
}

export async function compareProtocols(durationS = 6.0, seed = 42) {
  const res = await fetch(`${API_BASE}/experiments/compare`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ duration_s: durationS, seed }),
  });
  if (!res.ok) throw new Error(`Failed to run protocol comparison: ${res.statusText}`);
  return res.json();
}

export async function updateNode(simId: string, nodeId: string, updates: Partial<NodeConfig>) {
  const res = await fetch(`${API_BASE}/simulations/${simId}/nodes/${nodeId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ updates }),
  });
  if (!res.ok) throw new Error(`Failed to update node: ${res.statusText}`);
  return res.json();
}

export async function updateLink(simId: string, linkId: string, updates: Partial<LinkConfig>) {
  const res = await fetch(`${API_BASE}/simulations/${simId}/links/${linkId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ updates }),
  });
  if (!res.ok) throw new Error(`Failed to update link: ${res.statusText}`);
  return res.json();
}

export async function cutLink(simId: string, linkId: string) {
  const res = await fetch(`${API_BASE}/simulations/${simId}/links/${linkId}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(`Failed to cut link: ${res.statusText}`);
  return res.json();
}

export async function addLink(simId: string, link: LinkConfig) {
  const res = await fetch(`${API_BASE}/simulations/${simId}/links`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ link }),
  });
  if (!res.ok) throw new Error(`Failed to add link: ${res.statusText}`);
  return res.json();
}

export async function overrideCwnd(simId: string, flowId: string, newCwnd: number) {
  const res = await fetch(`${API_BASE}/simulations/${simId}/override_cwnd`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ flow_id: flowId, new_cwnd: newCwnd }),
  });
  if (!res.ok) throw new Error(`Failed to override cwnd: ${res.statusText}`);
  return res.json();
}

export async function updateTopology(simId: string, topology: TopologyData) {
  const res = await fetch(`${API_BASE}/simulations/${simId}/topology`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topology }),
  });
  if (!res.ok) throw new Error(`Failed to update topology: ${res.statusText}`);
  return res.json();
}

// ============================================================================
// Project 27: SDN Controller, UDP Traffic & Dynamic Rerouting API Client
// ============================================================================

export async function getSDNStatus(simId: string) {
  const res = await fetch(`${API_BASE}/simulations/${simId}/sdn`);
  if (!res.ok) throw new Error(`Failed to get SDN status: ${res.statusText}`);
  return res.json();
}

export async function setSDNMode(simId: string, mode: 'adaptive' | 'static') {
  const res = await fetch(`${API_BASE}/simulations/${simId}/sdn/mode`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode }),
  });
  if (!res.ok) throw new Error(`Failed to set SDN mode: ${res.statusText}`);
  return res.json();
}

export async function setSDNThresholds(
  simId: string,
  thresholds: {
    queue_threshold?: number;
    utilization_threshold?: number;
    drop_rate_threshold?: number;
  }
) {
  const res = await fetch(`${API_BASE}/simulations/${simId}/sdn/thresholds`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(thresholds),
  });
  if (!res.ok) throw new Error(`Failed to set SDN thresholds: ${res.statusText}`);
  return res.json();
}

export async function injectControlledCongestion(
  simId: string,
  burstRateMbps = 25.0,
  durationS = 1.5,
  flowId?: string
) {
  const res = await fetch(`${API_BASE}/simulations/${simId}/sdn/inject_congestion`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ burst_rate_mbps: burstRateMbps, duration_s: durationS, flow_id: flowId }),
  });
  if (!res.ok) throw new Error(`Failed to inject congestion: ${res.statusText}`);
  return res.json();
}

export async function compareSDNRouting(durationS = 4.0, seed = 42) {
  const res = await fetch(`${API_BASE}/sdn/compare`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ duration_s: durationS, seed }),
  });
  if (!res.ok) throw new Error(`Failed to compare SDN routing: ${res.statusText}`);
  return res.json();
}

