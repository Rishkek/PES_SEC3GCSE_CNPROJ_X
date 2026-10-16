import React, { useState, useEffect } from 'react';
import {
  HelpCircle,
  Trash2,
  Sliders,
  Scissors,
  Activity,
  Gauge,
  Layers,
  Zap,
  ArrowRightLeft,
  Server,
  HardDrive,
  Monitor,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import {
  NodeConfig,
  LinkConfig,
  TopologyData,
  TCPProtocol,
  DropPolicy,
  SimulationSnapshot,
} from '../../types';

export type PropertiesTab = 'general' | 'protocol' | 'rate' | 'queue' | 'routing' | 'live';

interface PropertiesPanelProps {
  selectedElement: { type: 'node' | 'edge'; id: string } | null;
  topology: TopologyData;
  onUpdateNode: (updatedNode: NodeConfig) => void;
  onUpdateLink: (updatedLink: LinkConfig) => void;
  onDeleteElement: (element: { type: 'node' | 'edge'; id: string }) => void;
  onCutLink?: (linkId: string) => void;
  onOverrideCwnd?: (flowId: string, newCwnd: number) => void;
  onExplain: (key: string) => void;
  targetTab?: PropertiesTab | null;
  latestSnapshot?: SimulationSnapshot | null;
}

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
  selectedElement,
  topology,
  onUpdateNode,
  onUpdateLink,
  onDeleteElement,
  onCutLink,
  onOverrideCwnd,
  onExplain,
  targetTab,
  latestSnapshot,
}) => {
  const [activeTab, setActiveTab] = useState<PropertiesTab>('general');
  const [overrideCwndInput, setOverrideCwndInput] = useState<string>('10');
  const [overrideFeedback, setOverrideFeedback] = useState<string | null>(null);

  // Automatically switch tab when targetTab changes
  useEffect(() => {
    if (targetTab) {
      setActiveTab(targetTab);
    } else if (selectedElement?.type === 'node') {
      const n = topology.nodes.find((node) => node.id === selectedElement.id);
      if (n?.type === 'sender') setActiveTab('protocol');
      else if (n?.type === 'router') setActiveTab('queue');
      else setActiveTab('general');
    } else if (selectedElement?.type === 'edge') {
      setActiveTab('routing');
    }
  }, [targetTab, selectedElement, topology.nodes]);

  if (!selectedElement) {
    return (
      <div className="p-6 text-xs text-slate-500 text-center flex flex-col items-center justify-center h-64 border border-dashed border-slate-800 rounded-xl bg-slate-900/40">
        <Sliders className="w-10 h-10 text-slate-700 mb-3" />
        <span className="font-medium text-slate-400 mb-1">No Element Selected</span>
        <span className="text-[11px] text-slate-500 max-w-[200px]">
          Click any node or link in the topology, or right-click to inspect and modify parameters.
        </span>
      </div>
    );
  }

  const isNode = selectedElement.type === 'node';
  const node = isNode ? topology.nodes.find((n) => n.id === selectedElement.id) : null;
  const link = !isNode ? topology.links.find((l) => l.id === selectedElement.id) : null;

  if (isNode && !node) return null;
  if (!isNode && !link) return null;

  const flowId = node ? `flow_${node.id}` : '';
  const liveFlow = latestSnapshot?.flows?.[flowId];
  const liveRouter = node ? latestSnapshot?.routers?.[node.id] : undefined;

  // Connected links count for node
  const connectedLinks = isNode
    ? topology.links.filter((l) => l.source === node?.id || l.target === node?.id)
    : [];

  const handleApplyCwndOverride = () => {
    const val = parseFloat(overrideCwndInput);
    if (!isNaN(val) && val > 0 && onOverrideCwnd && node) {
      onOverrideCwnd(flowId, val);
      setOverrideFeedback(`Forced cwnd to ${val} MSS`);
      setTimeout(() => setOverrideFeedback(null), 3000);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 shadow-xl flex flex-col text-xs text-slate-200">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
        <div className="flex items-center gap-2">
          <div
            className={`p-1.5 rounded-lg ${
              isNode
                ? node?.type === 'sender'
                  ? 'bg-blue-500/20 text-blue-400'
                  : node?.type === 'receiver'
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'bg-purple-500/20 text-purple-400'
                : 'bg-sky-500/20 text-sky-400'
            }`}
          >
            {isNode ? (
              node?.type === 'sender' ? (
                <HardDrive className="w-4 h-4" />
              ) : node?.type === 'receiver' ? (
                <Monitor className="w-4 h-4" />
              ) : (
                <Server className="w-4 h-4" />
              )
            ) : (
              <ArrowRightLeft className="w-4 h-4" />
            )}
          </div>
          <div>
            <div className="font-semibold text-slate-200 flex items-center gap-1.5">
              <span>{isNode ? node?.label : `Link ${link?.id}`}</span>
            </div>
            <div className="text-[10px] text-slate-400 capitalize">
              {isNode ? `${node?.type} (${node?.id})` : `${link?.source} → ${link?.target}`}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {!isNode && link && onCutLink && (
            <button
              onClick={() => onCutLink(link.id)}
              className="p-1.5 rounded hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 transition-colors"
              title="Cut this cable"
            >
              <Scissors className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={() => onExplain(isNode ? node?.type || 'node' : 'link')}
            className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-blue-400 transition-colors"
            title="Explain component"
          >
            <HelpCircle className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDeleteElement(selectedElement)}
            className="p-1.5 rounded hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 transition-colors"
            title="Delete element"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Internal Sub-tabs */}
      <div className="flex space-x-1 border-b border-slate-800 pb-2 mb-3 overflow-x-auto scrollbar-none">
        <button
          onClick={() => setActiveTab('general')}
          className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
            activeTab === 'general'
              ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          General
        </button>

        {isNode && node?.type === 'sender' && (
          <>
            <button
              onClick={() => setActiveTab('protocol')}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                activeTab === 'protocol'
                  ? 'bg-blue-600/20 text-blue-300 border border-blue-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              Protocol
            </button>
            <button
              onClick={() => setActiveTab('rate')}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                activeTab === 'rate'
                  ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              Rate & Load
            </button>
            <button
              onClick={() => setActiveTab('live')}
              className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                activeTab === 'live'
                  ? 'bg-amber-600/20 text-amber-300 border border-amber-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              Live Overrides
            </button>
          </>
        )}

        {isNode && (node?.type === 'router' || node?.type === 'switch') && (
          <button
            onClick={() => setActiveTab('queue')}
            className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
              activeTab === 'queue'
                ? 'bg-purple-600/20 text-purple-300 border border-purple-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            Queue & Buffer
          </button>
        )}

        {isNode && node?.type === 'receiver' && (
          <button
            onClick={() => setActiveTab('rate')}
            className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
              activeTab === 'rate'
                ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            Flow Control
          </button>
        )}

        {!isNode && (
          <button
            onClick={() => setActiveTab('routing')}
            className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
              activeTab === 'routing'
                ? 'bg-sky-600/20 text-sky-300 border border-sky-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            Link Config
          </button>
        )}
      </div>

      {/* TAB CONTENT */}

      {/* 1. GENERAL TAB */}
      {activeTab === 'general' && isNode && node && (
        <div className="space-y-3">
          <div>
            <label className="text-slate-400 mb-1 block">Node Label:</label>
            <input
              type="text"
              value={node.label}
              onChange={(e) => onUpdateNode({ ...node, label: e.target.value })}
              className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 text-xs focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-slate-400 bg-slate-950/50 p-2.5 rounded-lg border border-slate-800">
            <div>
              <span className="text-slate-500 block">Node ID:</span>
              <span className="text-slate-200">{node.id}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Type:</span>
              <span className="text-slate-200 capitalize">{node.type}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Position:</span>
              <span>X:{Math.round(node.x)} Y:{Math.round(node.y)}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Links:</span>
              <span>{connectedLinks.length} connected</span>
            </div>
          </div>
        </div>
      )}

      {/* 2. PROTOCOL TAB (Sender) */}
      {activeTab === 'protocol' && isNode && node?.type === 'sender' && (
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span>TCP Protocol Variant:</span>
              <button
                onClick={() => onExplain(node.protocol)}
                className="text-blue-400 hover:underline flex items-center gap-0.5"
              >
                <HelpCircle className="w-3 h-3" /> Explain
              </button>
            </div>
            <select
              value={node.protocol}
              onChange={(e) => onUpdateNode({ ...node, protocol: e.target.value as any })}
              className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 font-mono text-xs focus:outline-none focus:border-blue-500"
            >
              <option value="udp">UDP (Topic 27) — Connectionless Datagram Generator</option>
              <option value="reno">TCP Reno (1990) — Fast Recovery to ssthresh</option>
              <option value="tahoe">TCP Tahoe (1988) — Drops to 1 on loss</option>
              <option value="cubic">TCP CUBIC (RFC 9438) — Cubic polynomial</option>
            </select>
          </div>

          {node.protocol === 'udp' ? (
            <div className="space-y-3 p-3 bg-purple-950/20 border border-purple-800/40 rounded-lg">
              <div className="flex items-center justify-between text-xs text-purple-300 font-semibold">
                <span>UDP Rate Configuration (Topic 27)</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-900/60 font-mono">
                  {(node.udp_rate_mbps ?? 10.0).toFixed(1)} Mbps
                </span>
              </div>
              <div>
                <div className="text-[11px] text-slate-400 mb-1">Transmission Bit Rate:</div>
                <input
                  type="range"
                  min="1"
                  max="40"
                  step="0.5"
                  value={node.udp_rate_mbps ?? 10.0}
                  onChange={(e) => onUpdateNode({ ...node, udp_rate_mbps: parseFloat(e.target.value) })}
                  className="w-full accent-purple-500"
                />
              </div>

              {/* Controlled Congestion Spike */}
              <div className="pt-2 border-t border-purple-900/40 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-300 font-medium">Controlled Congestion Burst:</span>
                  <input
                    type="checkbox"
                    checked={!!node.udp_burst_enabled}
                    onChange={(e) => onUpdateNode({ ...node, udp_burst_enabled: e.target.checked })}
                    className="accent-purple-500"
                  />
                </div>
                {node.udp_burst_enabled && (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <div className="text-[10px] text-slate-400">Burst Rate (Mbps):</div>
                      <input
                        type="number"
                        min="5"
                        max="60"
                        value={node.udp_burst_rate_mbps ?? 25.0}
                        onChange={(e) =>
                          onUpdateNode({ ...node, udp_burst_rate_mbps: parseFloat(e.target.value) || 25.0 })
                        }
                        className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs"
                      />
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400">Burst Start (s):</div>
                      <input
                        type="number"
                        min="0"
                        max="20"
                        step="0.5"
                        value={node.udp_burst_start_s ?? 2.0}
                        onChange={(e) =>
                          onUpdateNode({ ...node, udp_burst_start_s: parseFloat(e.target.value) || 2.0 })
                        }
                        className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-200 text-xs"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="flex items-center justify-between text-slate-400 mb-1">
                  <span>Initial cwnd:</span>
                  <button onClick={() => onExplain('cwnd')} className="text-blue-400">
                    <HelpCircle className="w-3 h-3" />
                  </button>
                </div>
                <input
                  type="number"
                  min="1"
                  max="64"
                  value={node.initial_cwnd}
                  onChange={(e) =>
                    onUpdateNode({ ...node, initial_cwnd: Math.max(1, parseFloat(e.target.value) || 1) })
                  }
                  className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-200 font-mono text-xs focus:border-blue-500"
                />
                <span className="text-[10px] text-slate-500">packets</span>
              </div>

              <div>
                <div className="flex items-center justify-between text-slate-400 mb-1">
                  <span>Initial ssthresh:</span>
                  <button onClick={() => onExplain('ssthresh')} className="text-blue-400">
                    <HelpCircle className="w-3 h-3" />
                  </button>
                </div>
                <input
                  type="number"
                  min="2"
                  max="128"
                  value={node.initial_ssthresh}
                  onChange={(e) =>
                    onUpdateNode({ ...node, initial_ssthresh: Math.max(2, parseFloat(e.target.value) || 16) })
                  }
                  className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-200 font-mono text-xs focus:border-blue-500"
                />
                <span className="text-[10px] text-slate-500">packets</span>
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span>Maximum Segment Size (MSS):</span>
              <span className="font-mono text-blue-400">{node.mss || 1000} bytes</span>
            </div>
            <input
              type="number"
              min="200"
              max="9000"
              step="100"
              value={node.mss || 1000}
              onChange={(e) =>
                onUpdateNode({ ...node, mss: Math.max(200, parseInt(e.target.value) || 1000) })
              }
              className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-200 font-mono text-xs"
            />
          </div>

          <div>
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span>Receiver Advertised Window (rwnd):</span>
              <button onClick={() => onExplain('rwnd')} className="text-blue-400">
                <HelpCircle className="w-3 h-3" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                max="256"
                value={node.rwnd || 64}
                onChange={(e) =>
                  onUpdateNode({ ...node, rwnd: Math.max(1, parseFloat(e.target.value) || 64) })
                }
                className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-200 font-mono text-xs"
              />
              <select
                value={node.rwnd_unit || 'packets'}
                onChange={(e) => onUpdateNode({ ...node, rwnd_unit: e.target.value as any })}
                className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-300 text-xs font-mono"
              >
                <option value="packets">MSS (pkts)</option>
                <option value="bytes">Bytes</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* 3. RATE & TRAFFIC LOAD TAB (Sender / Receiver) */}
      {activeTab === 'rate' && isNode && (
        <div className="space-y-3">
          {node?.type === 'sender' ? (
            <>
              <div>
                <div className="flex items-center justify-between text-slate-400 mb-1">
                  <span>Application Generation Mode:</span>
                </div>
                <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-950/60 rounded-lg border border-slate-800">
                  <button
                    onClick={() => onUpdateNode({ ...node, app_rate_bps: 0 })}
                    className={`py-1 rounded text-[11px] font-medium transition-colors ${
                      node.app_rate_bps === 0
                        ? 'bg-blue-600/30 text-blue-300 border border-blue-500/40'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Greedy / Saturated
                  </button>
                  <button
                    onClick={() =>
                      onUpdateNode({
                        ...node,
                        app_rate_bps: node.app_rate_bps > 0 ? node.app_rate_bps : 5_000_000,
                      })
                    }
                    className={`py-1 rounded text-[11px] font-medium transition-colors ${
                      node.app_rate_bps > 0
                        ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/40'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Rate-Metered
                  </button>
                </div>
              </div>

              {node.app_rate_bps > 0 && (
                <div className="space-y-3 bg-slate-950/40 p-2.5 rounded-lg border border-slate-800">
                  <div>
                    <div className="flex items-center justify-between text-slate-400 mb-1">
                      <span>Sending Rate:</span>
                      <span className="font-mono text-emerald-400">
                        {node.app_rate_bps >= 1_000_000
                          ? `${(node.app_rate_bps / 1_000_000).toFixed(1)} Mbps`
                          : `${(node.app_rate_bps / 1_000).toFixed(0)} kbps`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0.1"
                        max="100"
                        step="0.5"
                        value={
                          node.app_rate_unit === 'kbps'
                            ? (node.app_rate_bps / 1_000)
                            : (node.app_rate_bps / 1_000_000)
                        }
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          const bps =
                            node.app_rate_unit === 'kbps' ? val * 1_000 : val * 1_000_000;
                          onUpdateNode({ ...node, app_rate_bps: bps });
                        }}
                        className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-200 font-mono text-xs"
                      />
                      <select
                        value={node.app_rate_unit || 'Mbps'}
                        onChange={(e) => {
                          const unit = e.target.value as any;
                          onUpdateNode({ ...node, app_rate_unit: unit });
                        }}
                        className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-300 font-mono text-xs"
                      >
                        <option value="Mbps">Mbps</option>
                        <option value="kbps">kbps</option>
                      </select>
                    </div>

                    {/* Presets */}
                    <div className="flex gap-1 mt-2">
                      {[1, 5, 10, 20].map((mbps) => (
                        <button
                          key={mbps}
                          onClick={() =>
                            onUpdateNode({
                              ...node,
                              app_rate_bps: mbps * 1_000_000,
                              app_rate_unit: 'Mbps',
                            })
                          }
                          className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                        >
                          {mbps}M
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-slate-400 block mb-1">Burst Size:</span>
                      <input
                        type="number"
                        min="1"
                        max="32"
                        value={node.traffic_burst_size || 1}
                        onChange={(e) =>
                          onUpdateNode({
                            ...node,
                            traffic_burst_size: Math.max(1, parseInt(e.target.value) || 1),
                          })
                        }
                        className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-200 font-mono text-xs"
                      />
                      <span className="text-[10px] text-slate-500">packets</span>
                    </div>

                    <div>
                      <span className="text-slate-400 block mb-1">Stop Time (s):</span>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        placeholder="None (∞)"
                        value={node.app_stop_time ?? ''}
                        onChange={(e) =>
                          onUpdateNode({
                            ...node,
                            app_stop_time: e.target.value ? parseFloat(e.target.value) : undefined,
                          })
                        }
                        className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-200 font-mono text-xs"
                      />
                      <span className="text-[10px] text-slate-500">seconds</span>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Receiver flow control */
            node && (
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between text-slate-400 mb-1">
                  <span>Receiver Window (rwnd):</span>
                  <span className="font-mono text-emerald-400">{node.rwnd || 64} MSS</span>
                </div>
                <input
                  type="number"
                  min="1"
                  max="512"
                  value={node.rwnd || 64}
                  onChange={(e) =>
                    onUpdateNode({ ...node, rwnd: Math.max(1, parseFloat(e.target.value) || 64) })
                  }
                  className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-200 font-mono text-xs"
                />
              </div>

              <div>
                <span className="text-slate-400 block mb-1">Receive Buffer Capacity:</span>
                <input
                  type="number"
                  min="4096"
                  max="1048576"
                  step="4096"
                  value={node.receive_buffer_capacity || 65536}
                  onChange={(e) =>
                    onUpdateNode({
                      ...node,
                      receive_buffer_capacity: parseInt(e.target.value) || 65536,
                    })
                  }
                  className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-200 font-mono text-xs"
                />
                <span className="text-[10px] text-slate-500">bytes</span>
              </div>
            </div>
            )
          )}
        </div>
      )}

      {/* 4. QUEUE & BUFFER TAB (Router) */}
      {activeTab === 'queue' && isNode && (node?.type === 'router' || node?.type === 'switch') && (
        <div className="space-y-3">
          {/* Live Router Status */}
          {liveRouter && (
            <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800 text-[11px] font-mono space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Current Occupancy:</span>
                <span className="text-purple-300 font-bold">
                  {liveRouter.queue_occupancy_pkts} pkts
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Queue Utilization:</span>
                <span
                  className={
                    liveRouter.utilization_pct > 75
                      ? 'text-rose-400 font-bold'
                      : 'text-emerald-400'
                  }
                >
                  {liveRouter.utilization_pct.toFixed(1)}%
                </span>
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span>Router Buffer Capacity:</span>
              <button
                onClick={() => onExplain('queue')}
                className="text-blue-400 flex items-center gap-0.5"
              >
                <HelpCircle className="w-3 h-3" /> Explain
              </button>
            </div>

            <div className="flex items-center gap-2 mb-2">
              <input
                type="number"
                min="-1"
                max="500"
                value={node.buffer_capacity}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  onUpdateNode({ ...node, buffer_capacity: isNaN(val) ? 20 : val });
                }}
                className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-200 font-mono text-xs focus:border-purple-500"
              />
              <button
                onClick={() =>
                  onUpdateNode({
                    ...node,
                    buffer_capacity: node.buffer_capacity === -1 ? 20 : -1,
                  })
                }
                className={`px-2.5 py-1 rounded text-[11px] font-mono border transition-colors ${
                  node.buffer_capacity === -1
                    ? 'bg-purple-950/70 border-purple-500 text-purple-300 font-bold'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                {node.buffer_capacity === -1 ? 'Infinite (∞)' : 'Set ∞'}
              </button>
            </div>

            {node.buffer_capacity !== -1 && (
              <input
                type="range"
                min="2"
                max="100"
                step="1"
                value={node.buffer_capacity}
                onChange={(e) =>
                  onUpdateNode({ ...node, buffer_capacity: parseInt(e.target.value) })
                }
                className="w-full accent-purple-500"
              />
            )}
          </div>

          <div>
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span>Drop & Marking Policy:</span>
              <button onClick={() => onExplain('ecn')} className="text-blue-400">
                <HelpCircle className="w-3 h-3" />
              </button>
            </div>
            <select
              value={node.drop_policy}
              onChange={(e) => onUpdateNode({ ...node, drop_policy: e.target.value as DropPolicy })}
              className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 font-mono text-xs focus:outline-none focus:border-purple-500"
            >
              <option value="tail_drop">Tail Drop — Drops when buffer full</option>
              <option value="ecn">ECN — Explicit Congestion Notification (RFC 3168)</option>
            </select>
          </div>

          {node.drop_policy === 'ecn' && (
            <div>
              <div className="text-slate-400 mb-1 flex justify-between">
                <span>ECN Marking Threshold:</span>
                <span className="font-mono text-purple-400">
                  {(node.ecn_threshold * 100).toFixed(0)}%
                </span>
              </div>
              <input
                type="range"
                min="0.2"
                max="0.95"
                step="0.05"
                value={node.ecn_threshold}
                onChange={(e) =>
                  onUpdateNode({ ...node, ecn_threshold: parseFloat(e.target.value) })
                }
                className="w-full accent-purple-500"
              />
            </div>
          )}

          {/* Router Congestion Detection Thresholds */}
          <div className="border-t border-slate-800 pt-2 space-y-2">
            <span className="text-[11px] font-semibold text-slate-400 block">
              Congestion Detection Thresholds:
            </span>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <span className="text-slate-400 block mb-0.5">Queue Threshold:</span>
                <input
                  type="number"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={node.queue_threshold ?? 0.8}
                  onChange={(e) =>
                    onUpdateNode({ ...node, queue_threshold: parseFloat(e.target.value) || 0.8 })
                  }
                  className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-200 font-mono text-xs"
                />
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Drop Rate Alert:</span>
                <input
                  type="number"
                  min="0.01"
                  max="0.5"
                  step="0.01"
                  value={node.drop_rate_threshold ?? 0.05}
                  onChange={(e) =>
                    onUpdateNode({
                      ...node,
                      drop_rate_threshold: parseFloat(e.target.value) || 0.05,
                    })
                  }
                  className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-200 font-mono text-xs"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. LIVE OVERRIDES TAB (Sender) */}
      {activeTab === 'live' && isNode && node?.type === 'sender' && (
        <div className="space-y-3">
          <div className="p-2.5 rounded-lg bg-amber-950/30 border border-amber-800/40 text-[11px] text-amber-200/90 leading-relaxed">
            Directly test how TCP reacts when the congestion window is externally forced or perturbed during a running simulation.
          </div>

          {liveFlow && (
            <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800 text-[11px] font-mono space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Live cwnd:</span>
                <span className="text-blue-400 font-bold">{liveFlow.cwnd.toFixed(2)} MSS</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Live ssthresh:</span>
                <span className="text-amber-400">{liveFlow.ssthresh.toFixed(0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">TCP State:</span>
                <span className="text-slate-200 capitalize">{liveFlow.state}</span>
              </div>
            </div>
          )}

          <div>
            <label className="text-slate-400 mb-1 block">Force Congestion Window (cwnd):</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                max="256"
                value={overrideCwndInput}
                onChange={(e) => setOverrideCwndInput(e.target.value)}
                className="flex-1 bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 font-mono text-xs focus:border-amber-500"
                placeholder="e.g. 16"
              />
              <button
                onClick={handleApplyCwndOverride}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold rounded text-xs transition-colors flex items-center gap-1"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Force</span>
              </button>
            </div>
            {overrideFeedback && (
              <div className="mt-2 text-xs text-emerald-400 flex items-center gap-1 animate-in fade-in">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{overrideFeedback}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 6. ROUTING & LINK CONFIG TAB */}
      {activeTab === 'routing' && !isNode && link && (
        <div className="space-y-3">
          <div>
            <div className="text-slate-400 mb-1 flex justify-between">
              <span>Bandwidth:</span>
              <span className="font-mono text-blue-400">
                {(link.bandwidth_bps / 1_000_000).toFixed(1)} Mbps
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="100"
              step="1"
              value={link.bandwidth_bps / 1_000_000}
              onChange={(e) =>
                onUpdateLink({ ...link, bandwidth_bps: parseFloat(e.target.value) * 1_000_000 })
              }
              className="w-full accent-blue-500"
            />
          </div>

          <div>
            <div className="text-slate-400 mb-1 flex justify-between">
              <span>Propagation Delay:</span>
              <span className="font-mono text-emerald-400">
                {(link.propagation_delay_s * 1000).toFixed(0)} ms
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="200"
              step="5"
              value={link.propagation_delay_s * 1000}
              onChange={(e) =>
                onUpdateLink({ ...link, propagation_delay_s: parseFloat(e.target.value) / 1000 })
              }
              className="w-full accent-emerald-500"
            />
          </div>

          <div>
            <div className="text-slate-400 mb-1 flex justify-between">
              <span>Random Loss Probability:</span>
              <span className="font-mono text-rose-400">{(link.loss_rate * 100).toFixed(1)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="0.2"
              step="0.005"
              value={link.loss_rate}
              onChange={(e) => onUpdateLink({ ...link, loss_rate: parseFloat(e.target.value) })}
              className="w-full accent-rose-500"
            />
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-800">
            <label className="flex items-center gap-2 cursor-pointer text-slate-300">
              <input
                type="checkbox"
                checked={link.is_bottleneck}
                onChange={(e) => onUpdateLink({ ...link, is_bottleneck: e.target.checked })}
                className="rounded bg-slate-800 border-slate-700 text-blue-500 focus:ring-0"
              />
              <span>Bottleneck Link</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer text-slate-300">
              <input
                type="checkbox"
                checked={link.is_active}
                onChange={(e) => onUpdateLink({ ...link, is_active: e.target.checked })}
                className="rounded bg-slate-800 border-slate-700 text-blue-500 focus:ring-0"
              />
              <span>Link Active</span>
            </label>
          </div>

          {onCutLink && (
            <div className="pt-2 border-t border-slate-800">
              <button
                onClick={() => onCutLink(link.id)}
                className="w-full py-1.5 px-3 rounded-lg bg-rose-950/50 hover:bg-rose-900/60 text-rose-300 border border-rose-800/60 font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                <Scissors className="w-3.5 h-3.5" />
                <span>Cut This Cable</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
