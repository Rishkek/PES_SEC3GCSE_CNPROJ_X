import React from 'react';
import { Shuffle, ArrowRight, CheckCircle2, AlertTriangle, Route } from 'lucide-react';
import { RerouteRecord, TopologyData } from '../../types';

interface ReroutingDashboardProps {
  flowPaths: Record<string, string[]>;
  rerouteHistory: RerouteRecord[];
  congestionScores: Record<string, number>;
  topology: TopologyData;
  autoReroute: boolean;
  onAutoRerouteToggle: () => void;
  onManualReroute: (flowId: string, newPath: string[]) => void;
}

export const ReroutingDashboard: React.FC<ReroutingDashboardProps> = ({
  flowPaths,
  rerouteHistory,
  congestionScores,
  topology,
  autoReroute,
  onAutoRerouteToggle,
  onManualReroute,
}) => {
  const flowKeys = Object.keys(flowPaths);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl space-y-4">
      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Route className="w-4 h-4 text-purple-400" />
          <span className="text-xs font-semibold text-slate-200">Traffic Rerouting Dashboard</span>
        </div>
        <button
          onClick={onAutoRerouteToggle}
          className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold border ${
            autoReroute
              ? 'bg-purple-900/40 border-purple-500 text-purple-300'
              : 'bg-slate-800 border-slate-700 text-slate-400'
          }`}
        >
          Auto: {autoReroute ? 'ENABLED' : 'DISABLED'}
        </button>
      </div>

      {/* Active Paths */}
      <div className="space-y-3">
        <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
          Active Flow Paths
        </div>
        {flowKeys.length === 0 ? (
          <div className="text-xs text-slate-500">No active flows configured.</div>
        ) : (
          flowKeys.map((fid) => {
            const currentPath = flowPaths[fid] || [];
            return (
              <div key={fid} className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono font-medium text-slate-300">{fid}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                    {currentPath.length - 1} Hops
                  </span>
                </div>

                <div className="flex items-center gap-1.5 font-mono text-xs text-purple-300 bg-slate-900 p-2 rounded border border-slate-800 flex-wrap">
                  {currentPath.map((nodeId, idx) => (
                    <React.Fragment key={idx}>
                      <span className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-200">
                        {nodeId}
                      </span>
                      {idx < currentPath.length - 1 && (
                        <ArrowRight className="w-3 h-3 text-slate-500" />
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Link Congestion Scores */}
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

      {/* Reroute Event Log */}
      <div className="space-y-2 pt-2 border-t border-slate-800">
        <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
          Reroute Transitions History ({rerouteHistory.length})
        </div>
        {rerouteHistory.length === 0 ? (
          <div className="text-xs text-slate-500 p-2 text-center bg-slate-950/40 rounded border border-slate-800/60">
            No reroute events recorded yet. Congestion-aware rerouting will log dynamic path shifts here.
          </div>
        ) : (
          <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
            {rerouteHistory.map((rec, i) => (
              <div key={i} className="p-2 rounded bg-slate-950 border border-slate-800 text-[11px] font-mono space-y-1">
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
