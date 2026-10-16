import React, { useState } from 'react';
import {
  Route,
  ArrowRight,
  AlertTriangle,
  Zap,
  CheckCircle2,
  Sliders,
  Activity,
  ShieldCheck,
  Clock,
  TrendingUp,
  Cpu,
} from 'lucide-react';
import { RerouteRecord, TopologyData, SDNControllerState } from '../../types';

interface ReroutingDashboardProps {
  flowPaths: Record<string, string[]>;
  rerouteHistory: RerouteRecord[];
  congestionScores: Record<string, number>;
  topology: TopologyData;
  autoReroute: boolean;
  onAutoRerouteToggle: () => void;
  onManualReroute: (flowId: string, newPath: string[]) => void;
  sdnState?: SDNControllerState | null;
  onInjectCongestion?: () => void;
  onUpdateThresholds?: (thresholds: {
    queue_threshold?: number;
    utilization_threshold?: number;
    drop_rate_threshold?: number;
  }) => void;
}

export const ReroutingDashboard: React.FC<ReroutingDashboardProps> = ({
  flowPaths,
  rerouteHistory,
  congestionScores,
  topology,
  autoReroute,
  onAutoRerouteToggle,
  onManualReroute,
  sdnState,
  onInjectCongestion,
  onUpdateThresholds,
}) => {
  const [showThresholds, setShowThresholds] = useState<boolean>(false);
  const [queueThresh, setQueueThresh] = useState<number>(
    sdnState?.thresholds?.queue_threshold ?? 70
  );
  const [utilThresh, setUtilThresh] = useState<number>(
    sdnState?.thresholds?.utilization_threshold ?? 85
  );
  const [dropThresh, setDropThresh] = useState<number>(
    sdnState?.thresholds?.drop_rate_threshold ?? 3
  );

  const flowKeys = Object.keys(flowPaths);
  const overloadedFlows = sdnState?.overloaded_flows || [];
  const latestRecovery =
    sdnState?.recovery_records && sdnState.recovery_records.length > 0
      ? sdnState.recovery_records[sdnState.recovery_records.length - 1]
      : null;

  const handleThresholdSave = () => {
    if (onUpdateThresholds) {
      onUpdateThresholds({
        queue_threshold: queueThresh / 100.0,
        utilization_threshold: utilThresh / 100.0,
        drop_rate_threshold: dropThresh / 100.0,
      });
    }
    setShowThresholds(false);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl space-y-4">
      {/* 1. Header with SDN Mode Toggle */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded bg-purple-600/20 text-purple-400 border border-purple-500/30">
            <Cpu className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
              <span>SDN Controller & Traffic Rerouting</span>
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-900/60 text-purple-300 font-mono">
                Topic 27
              </span>
            </div>
            <div className="text-[10px] text-slate-400">
              UDP Congestion Detection & Adaptive Bypass
            </div>
          </div>
        </div>

        {/* Static vs Adaptive Toggle */}
        <button
          onClick={onAutoRerouteToggle}
          title="Toggle between Autonomous SDN Dynamic Rerouting and Static Shortest-Path Routing"
          className={`px-2.5 py-1 rounded text-[10px] font-mono font-bold tracking-wide border transition-all ${
            autoReroute
              ? 'bg-emerald-950/40 border-emerald-500 text-emerald-300 shadow-sm shadow-emerald-900/20'
              : 'bg-rose-950/40 border-rose-600/70 text-rose-300'
          }`}
        >
          {autoReroute ? '⚡ ADAPTIVE (SDN)' : '🔒 STATIC ROUTING'}
        </button>
      </div>

      {/* 2. Controlled Congestion Trigger & Threshold Controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={onInjectCongestion}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/40 text-xs font-semibold transition-colors"
        >
          <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
          <span>Inject Controlled Congestion</span>
        </button>

        <button
          onClick={() => setShowThresholds(!showThresholds)}
          className={`p-1.5 rounded-lg border text-xs flex items-center gap-1 ${
            showThresholds
              ? 'bg-slate-800 border-purple-500 text-purple-300'
              : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
          }`}
          title="Configure Congestion Detection Thresholds"
        >
          <Sliders className="w-3.5 h-3.5" />
          <span className="text-[10px] font-mono">Thresholds</span>
        </button>
      </div>

      {/* 3. Programmable Thresholds Drawer */}
      {showThresholds && (
        <div className="p-3 rounded-lg bg-slate-950 border border-purple-800/40 space-y-3 text-xs">
          <div className="flex items-center justify-between text-slate-300 font-semibold text-[11px]">
            <span>SDN Detection Thresholds</span>
            <button
              onClick={handleThresholdSave}
              className="px-2 py-0.5 rounded bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-bold"
            >
              Apply
            </button>
          </div>

          <div className="space-y-2">
            <div>
              <div className="flex justify-between text-[10px] text-slate-400 mb-0.5">
                <span>Queue Occupancy Threshold:</span>
                <span className="font-mono text-purple-300 font-bold">{queueThresh}%</span>
              </div>
              <input
                type="range"
                min="30"
                max="95"
                value={queueThresh}
                onChange={(e) => setQueueThresh(parseInt(e.target.value))}
                className="w-full accent-purple-500 h-1 bg-slate-800 rounded"
              />
            </div>

            <div>
              <div className="flex justify-between text-[10px] text-slate-400 mb-0.5">
                <span>Link Utilization Threshold:</span>
                <span className="font-mono text-purple-300 font-bold">{utilThresh}%</span>
              </div>
              <input
                type="range"
                min="50"
                max="98"
                value={utilThresh}
                onChange={(e) => setUtilThresh(parseInt(e.target.value))}
                className="w-full accent-purple-500 h-1 bg-slate-800 rounded"
              />
            </div>

            <div>
              <div className="flex justify-between text-[10px] text-slate-400 mb-0.5">
                <span>Packet Drop Rate Threshold:</span>
                <span className="font-mono text-purple-300 font-bold">{dropThresh}%</span>
              </div>
              <input
                type="range"
                min="1"
                max="15"
                value={dropThresh}
                onChange={(e) => setDropThresh(parseInt(e.target.value))}
                className="w-full accent-purple-500 h-1 bg-slate-800 rounded"
              />
            </div>
          </div>
        </div>
      )}

      {/* 4. Overloaded Path Detection Alert Status */}
      {overloadedFlows.length > 0 ? (
        <div className="p-3 rounded-lg bg-rose-950/30 border border-rose-500/50 space-y-1.5 animate-pulse">
          <div className="flex items-center gap-1.5 text-rose-300 text-xs font-bold">
            <AlertTriangle className="w-4 h-4 text-rose-400" />
            <span>OVERLOADED PATH DETECTED!</span>
          </div>
          {overloadedFlows.map((ov, i) => (
            <div key={i} className="text-[11px] text-rose-200/90 font-mono space-y-0.5">
              <div>Flow: <span className="font-bold">{ov.flow_id}</span></div>
              <div className="text-[10px] text-rose-300/80">
                {ov.reasons && ov.reasons.length > 0
                  ? ov.reasons.join(' • ')
                  : 'Queue capacity exceeded defined threshold.'}
              </div>
            </div>
          ))}
          {!autoReroute && (
            <div className="text-[10px] text-amber-300 font-semibold pt-1">
              ⚠️ In Static Mode: Traffic remains trapped on congested path. Enable Adaptive Mode to trigger bypass!
            </div>
          )}
        </div>
      ) : (
        <div className="p-2.5 rounded-lg bg-emerald-950/20 border border-emerald-500/30 flex items-center gap-2 text-xs text-emerald-300">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>All flow paths operating within safe queue & bandwidth thresholds.</span>
        </div>
      )}

      {/* 5. Dynamic Recovery Time & Throughput Performance Card */}
      {latestRecovery && (
        <div className="p-3 rounded-lg bg-gradient-to-r from-purple-950/40 via-indigo-950/40 to-slate-950/60 border border-purple-500/40 space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-purple-200">
            <span className="flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              <span>SDN Recovery Performance</span>
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-900/60 text-emerald-300 font-mono">
              RECOVERED
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs pt-1">
            <div className="p-2 rounded bg-slate-950/80 border border-slate-800">
              <div className="text-[10px] text-slate-400 flex items-center gap-1">
                <Clock className="w-3 h-3 text-purple-400" />
                <span>Recovery Time:</span>
              </div>
              <div className="text-sm font-mono font-bold text-purple-300">
                {latestRecovery.recovery_time_ms} ms
              </div>
            </div>

            <div className="p-2 rounded bg-slate-950/80 border border-slate-800">
              <div className="text-[10px] text-slate-400 flex items-center gap-1">
                <Activity className="w-3 h-3 text-emerald-400" />
                <span>Restored Throughput:</span>
              </div>
              <div className="text-sm font-mono font-bold text-emerald-400">
                {latestRecovery.post_throughput_mbps} Mbps
              </div>
            </div>
          </div>

          <div className="text-[10px] font-mono text-slate-300 flex items-center justify-between px-1">
            <span>Pre-loss: {latestRecovery.pre_throughput_mbps} Mbps</span>
            <span className="text-emerald-400 font-bold">
              Recovery: {latestRecovery.throughput_recovery_pct}%
            </span>
          </div>
        </div>
      )}

      {/* 6. Active Flow Statistics Table (OpenFlow Table) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
          <span>Flow Table Statistics</span>
          <span className="text-[10px] text-slate-500 font-mono">{flowKeys.length} Flows</span>
        </div>

        {flowKeys.length === 0 ? (
          <div className="text-xs text-slate-500 p-2">No active flows.</div>
        ) : (
          flowKeys.map((fid) => {
            const currentPath = flowPaths[fid] || [];
            const flowStat = sdnState?.flow_table?.[fid];
            const isCongested = flowStat?.health_status === 'CONGESTED';
            const isRerouted = flowStat?.health_status === 'REROUTED';

            return (
              <div
                key={fid}
                className={`p-3 rounded-lg border space-y-2 transition-all ${
                  isCongested
                    ? 'bg-rose-950/20 border-rose-500/40 text-slate-200'
                    : isRerouted
                    ? 'bg-purple-950/20 border-purple-500/40 text-slate-200'
                    : 'bg-slate-950/60 border-slate-800 text-slate-200'
                }`}
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-semibold">{fid}</span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-900/60 text-purple-300 font-mono uppercase">
                      {flowStat?.protocol || 'UDP'}
                    </span>
                  </div>

                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold ${
                      isCongested
                        ? 'bg-rose-900/60 text-rose-300'
                        : isRerouted
                        ? 'bg-purple-900/60 text-purple-300'
                        : 'bg-emerald-900/60 text-emerald-300'
                    }`}
                  >
                    {flowStat?.health_status || 'OPTIMAL'}
                  </span>
                </div>

                {/* Path Breadcrumbs */}
                <div className="flex items-center gap-1 font-mono text-[11px] bg-slate-900 p-1.5 rounded border border-slate-800 flex-wrap">
                  {currentPath.map((nodeId, idx) => (
                    <React.Fragment key={idx}>
                      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-200 font-semibold">
                        {nodeId}
                      </span>
                      {idx < currentPath.length - 1 && (
                        <ArrowRight className="w-3 h-3 text-slate-500" />
                      )}
                    </React.Fragment>
                  ))}
                </div>

                {/* Telemetry Numbers */}
                {flowStat && (
                  <div className="grid grid-cols-3 gap-1 text-[10px] font-mono text-slate-400 pt-1">
                    <div>
                      Rate: <span className="text-slate-200 font-bold">{flowStat.rate_mbps} Mbps</span>
                    </div>
                    <div>
                      Goodput: <span className="text-emerald-400 font-bold">{flowStat.goodput_mbps} Mbps</span>
                    </div>
                    <div>
                      Loss: <span className={`font-bold ${flowStat.loss_rate_pct > 0 ? 'text-rose-400' : 'text-slate-300'}`}>{flowStat.loss_rate_pct}%</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* 7. Link Congestion Indicators */}
      <div className="space-y-2 pt-2 border-t border-slate-800">
        <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
          Link Congestion Indicators
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          {topology.links.map((link) => {
            const score = congestionScores[link.id] || 0;
            const isHigh = score > 0.5;
            return (
              <div
                key={link.id}
                className={`p-2 rounded border flex flex-col justify-between ${
                  isHigh
                    ? 'bg-orange-950/20 border-orange-500/50 text-orange-300'
                    : 'bg-slate-950/40 border-slate-800/80 text-slate-300'
                }`}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="font-mono text-[11px]">{link.id}</span>
                  <span className="font-mono text-[10px] font-bold">{(score * 100).toFixed(0)}%</span>
                </div>
                <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${isHigh ? 'bg-orange-500' : 'bg-emerald-500'}`}
                    style={{ width: `${Math.min(100, score * 100)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 8. Reroute Transitions History */}
      <div className="space-y-2 pt-2 border-t border-slate-800">
        <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
          Reroute Transitions History ({rerouteHistory.length})
        </div>
        {rerouteHistory.length === 0 ? (
          <div className="text-xs text-slate-500 p-2 text-center bg-slate-950/40 rounded border border-slate-800/60">
            No reroute events recorded yet. Autonomous SDN rerouting will log dynamic path shifts here.
          </div>
        ) : (
          <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
            {rerouteHistory.map((rec, i) => (
              <div
                key={i}
                className="p-2 rounded bg-slate-950 border border-slate-800 text-[11px] font-mono space-y-1"
              >
                <div className="flex justify-between text-slate-400 text-[10px]">
                  <span>t = {rec.time}s</span>
                  <span className="text-purple-400 font-bold">{rec.reason}</span>
                </div>
                <div className="flex items-center gap-1 text-slate-300 text-[10px]">
                  <span className="text-rose-400 line-through">{rec.old_path.join('➔')}</span>
                  <ArrowRight className="w-3 h-3 text-slate-500" />
                  <span className="text-emerald-400 font-bold">{rec.new_path.join('➔')}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
