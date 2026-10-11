import React from 'react';
import { Activity, ShieldCheck, Zap, AlertOctagon, HelpCircle } from 'lucide-react';
import { ProtocolState } from '../../types';

interface ProtocolStatePanelProps {
  protocols: Record<string, ProtocolState>;
  onExplain: (key: string) => void;
}

export const ProtocolStatePanel: React.FC<ProtocolStatePanelProps> = ({ protocols, onExplain }) => {
  const flowKeys = Object.keys(protocols);

  if (flowKeys.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-xs text-slate-500 text-center">
        No active TCP flows. Run the simulation to observe protocol state transitions.
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl space-y-4">
      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-blue-400" />
          <span className="text-xs font-semibold text-slate-200">Protocol State Inspector</span>
        </div>
        <span className="text-[10px] text-slate-400 font-mono">{flowKeys.length} Flow(s)</span>
      </div>

      {flowKeys.map((fid) => {
        const p = protocols[fid];
        const stateColor =
          p.state === 'FastRecovery'
            ? 'bg-orange-500/20 text-orange-400 border-orange-500/40'
            : p.state === 'SlowStart'
            ? 'bg-blue-500/20 text-blue-400 border-blue-500/40'
            : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40';

        return (
          <div key={fid} className="p-3 rounded-lg bg-slate-950/60 border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-semibold text-slate-300">{fid}</span>
              <div className="flex items-center gap-1.5">
                <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase font-bold border ${stateColor}`}>
                  {p.state}
                </span>
                <button
                  onClick={() => onExplain(p.protocol)}
                  className="p-1 text-slate-400 hover:text-blue-400"
                  title={`Explain ${p.protocol}`}
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Grid of live values */}
            <div className="grid grid-cols-2 gap-2 font-mono text-xs">
              <div className="p-2 rounded bg-slate-900/80 border border-slate-800/80">
                <div className="flex justify-between text-slate-400 text-[10px] mb-0.5">
                  <span>cwnd:</span>
                  <button onClick={() => onExplain('cwnd')} className="text-blue-400 text-[9px] hover:underline">
                    ?
                  </button>
                </div>
                <div className="text-blue-400 font-bold text-sm">{p.cwnd} <span className="text-[10px] text-slate-500">MSS</span></div>
              </div>

              <div className="p-2 rounded bg-slate-900/80 border border-slate-800/80">
                <div className="flex justify-between text-slate-400 text-[10px] mb-0.5">
                  <span>ssthresh:</span>
                  <button onClick={() => onExplain('ssthresh')} className="text-amber-400 text-[9px] hover:underline">
                    ?
                  </button>
                </div>
                <div className="text-amber-400 font-bold text-sm">{p.ssthresh} <span className="text-[10px] text-slate-500">MSS</span></div>
              </div>

              <div className="p-2 rounded bg-slate-900/80 border border-slate-800/80">
                <div className="text-slate-400 text-[10px] mb-0.5">dupACK count:</div>
                <div className="text-slate-200 font-bold text-sm">{p.dup_ack_count}</div>
              </div>

              <div className="p-2 rounded bg-slate-900/80 border border-slate-800/80">
                <div className="text-slate-400 text-[10px] mb-0.5">In-Flight:</div>
                <div className="text-slate-200 font-bold text-sm">{p.bytes_in_flight} <span className="text-[10px] text-slate-500">pkts</span></div>
              </div>

              <div className="p-2 rounded bg-slate-900/80 border border-slate-800/80">
                <div className="text-slate-400 text-[10px] mb-0.5">RTT (Smooth):</div>
                <div className="text-emerald-400 font-bold text-sm">{p.srtt} <span className="text-[10px] text-slate-500">ms</span></div>
              </div>

              <div className="p-2 rounded bg-slate-900/80 border border-slate-800/80">
                <div className="text-slate-400 text-[10px] mb-0.5">RTO Timer:</div>
                <div className="text-slate-300 font-bold text-sm">{p.rto} <span className="text-[10px] text-slate-500">ms</span></div>
              </div>
            </div>

            {/* Retransmissions & Loss Summary */}
            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono text-slate-400">
              <span>Fast Rexmits: <strong className="text-slate-200">{p.fast_retransmissions}</strong></span>
              <span>Timeouts: <strong className="text-rose-400">{p.timeout_retransmissions}</strong></span>
            </div>

            {p.last_congestion_type && (
              <div className="p-1.5 rounded bg-slate-900 border border-slate-800 text-[10px] font-mono text-slate-400 flex items-center gap-1.5">
                <AlertOctagon className="w-3.5 h-3.5 text-amber-400" />
                <span>Last Loss: <strong className="text-amber-300 capitalize">{p.last_congestion_type.replace('_', ' ')}</strong> at {p.last_congestion_event_time}s</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
