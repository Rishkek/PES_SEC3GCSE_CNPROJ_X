export type NodeType = 'sender' | 'receiver' | 'router' | 'switch';
export type DropPolicy = 'tail_drop' | 'ecn' | 'red';
export type TCPProtocol = 'tahoe' | 'reno' | 'cubic';

export interface NodeConfig {
  id: string;
  label: string;
  type: NodeType;
  x: number;
  y: number;
  buffer_capacity: number; // -1 for infinite
  drop_policy: DropPolicy;
  ecn_threshold: number;
  protocol: TCPProtocol;
  mss: number;
  initial_cwnd: number;
  initial_ssthresh: number;
  max_cwnd: number;
  app_rate_bps: number;
  app_rate_unit?: 'Mbps' | 'kbps' | 'pkts_s';
  app_stop_time?: number;
  traffic_burst_size?: number;
  start_time: number;
  dest_id?: string;
  rwnd: number;
  rwnd_unit?: 'packets' | 'bytes';
  receive_buffer_capacity?: number;
  receiver_rwnd?: number;
  queue_threshold?: number;
  rtt_inflation_threshold?: number;
  drop_rate_threshold?: number;
  detection_window_s?: number;
}

export interface LinkConfig {
  id: string;
  source: string;
  target: string;
  bandwidth_bps: number;
  propagation_delay_s: number;
  loss_rate: number;
  is_active: boolean;
  is_bottleneck: boolean;
  cost: number;
}

export interface TopologyData {
  nodes: NodeConfig[];
  links: LinkConfig[];
}

export interface FlowSnapshot {
  cwnd: number;
  ssthresh: number;
  state: string;
  rtt_ms: number;
  srtt_ms: number;
  rto_ms: number;
  goodput_mbps: number;
  tx_throughput_mbps: number;
  bytes_in_flight: number;
  total_delivered_bytes: number;
  total_transmitted_bytes: number;
  total_drops_overflow: number;
  total_drops_random: number;
  unneeded_duplicates: number;
  fast_retransmissions: number;
  timeout_retransmissions: number;
  active_path: string[];
}

export interface RouterSnapshot {
  queue_occupancy_pkts: number;
  buffer_capacity: number;
  utilization_pct: number;
}

export interface LinkSnapshot {
  congestion_score: number;
  is_active: boolean;
}

export interface SimulationSnapshot {
  time: number;
  flows: Record<string, FlowSnapshot>;
  routers: Record<string, RouterSnapshot>;
  links: Record<string, LinkSnapshot>;
}

export interface ProtocolState {
  protocol: string;
  cwnd: number;
  ssthresh: number;
  dup_ack_count: number;
  state: string;
  bytes_in_flight: number;
  rtt: number;
  srtt: number;
  rto: number;
  total_retransmissions: number;
  fast_retransmissions: number;
  timeout_retransmissions: number;
  w_max: number;
  last_congestion_type?: string;
  last_congestion_event_time: number;
  target_cwnd?: number;
  k_deadline?: number;
}

export interface EventLogEntry {
  event_id: number;
  time: number;
  event_type: string;
  flow_id: string;
  node_id?: string;
  link_id?: string;
  packet_id?: number;
  seq_num?: number;
  is_ack?: boolean;
  ack_num?: number;
  description?: string;
  category?: string;
  data?: Record<string, any>;
}

export interface RerouteRecord {
  time: number;
  flow_id: string;
  old_path: string[];
  new_path: string[];
  reason: string;
}

export interface ScenarioMeta {
  id: string;
  title: string;
  subtitle: string;
  category: string;
  description: string;
  slides_reference: string;
  guided_steps: string[];
}

export interface HelpDeskTopic {
  id: string;
  category: string;
  title: string;
  slides_ref: string;
  beginner: string;
  intermediate: string;
  advanced: string;
  table: {
    mechanism: string;
    trigger: string;
    internal_state: string;
    action: string;
    observable_effect: string;
    why_it_matters: string;
  };
}
