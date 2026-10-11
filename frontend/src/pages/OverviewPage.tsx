import React from 'react';
import {
  Activity,
  Layers,
  GitCompare,
  Route,
  Zap,
  BookOpen,
  ArrowRight,
  ShieldAlert,
  Server,
  PlayCircle,
} from 'lucide-react';

interface OverviewPageProps {
  onNavigate: (page: string, scenarioId?: string) => void;
  onOpenHelpDesk: (key?: string) => void;
}

export const OverviewPage: React.FC<OverviewPageProps> = ({ onNavigate, onOpenHelpDesk }) => {
  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-slate-950 text-slate-100">
      {/* Hero Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-blue-950/60 via-slate-900 to-purple-950/40 border border-slate-800 shadow-2xl relative overflow-hidden">
        <div className="max-w-3xl space-y-3 relative z-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 text-xs font-mono">
            <Activity className="w-3.5 h-3.5" />
            <span>Computer Networks Lab &bull; Unit 3 Reference Tool</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
            NetLab — Congestion Detection & Traffic Rerouting Simulator
          </h1>
          <p className="text-xs md:text-sm text-slate-300 leading-relaxed">
            An end-to-end discrete-event educational laboratory modeling packet queues, buffer overflows, cumulative TCP acknowledgements, Tahoe, Reno, CUBIC, and congestion-aware traffic rerouting.
          </p>

          <div className="pt-2 flex flex-wrap gap-3">
            <button
              onClick={() => onNavigate('lab')}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs transition-colors shadow-lg shadow-blue-900/40"
            >
              <PlayCircle className="w-4 h-4 fill-white" />
              <span>Launch Network Lab</span>
            </button>

            <button
              onClick={() => onNavigate('compare')}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium text-xs transition-colors"
            >
              <GitCompare className="w-4 h-4 text-orange-400" />
              <span>Compare Tahoe, Reno & CUBIC</span>
            </button>

            <button
              onClick={() => onOpenHelpDesk()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium text-xs transition-colors"
            >
              <BookOpen className="w-4 h-4 text-emerald-400" />
              <span>Browse Help Desk</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4 Pillars Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 shadow-md space-y-2">
          <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400 w-fit">
            <Activity className="w-5 h-5" />
          </div>
          <h3 className="text-xs font-bold text-slate-200">Discrete-Event Engine</h3>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            True packet-level simulator calculating serialization delay (bits/bps), propagation delay, finite FIFO queues, and cumulative ACKs.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 shadow-md space-y-2">
          <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 w-fit">
            <Layers className="w-5 h-5" />
          </div>
          <h3 className="text-xs font-bold text-slate-200">TCP Protocols</h3>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Exact state machines for TCP Tahoe (1988 reset to 1), TCP Reno (1990 Fast Recovery), and TCP CUBIC (RFC 9438 time-dependent curve).
          </p>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 shadow-md space-y-2">
          <div className="p-2 rounded-lg bg-purple-500/20 text-purple-400 w-fit">
            <Route className="w-5 h-5" />
          </div>
          <h3 className="text-xs font-bold text-slate-200">Traffic Rerouting</h3>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Congestion detection using queue thresholds, drop rates, and RTT inflation. Automatically shifts traffic to alternate bypass paths.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 shadow-md space-y-2">
          <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400 w-fit">
            <BookOpen className="w-5 h-5" />
          </div>
          <h3 className="text-xs font-bold text-slate-200">Integrated Help Desk</h3>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Searchable technical manual with 3 explanation depths (Beginner, Intermediate, Advanced) and 6-column mechanism tables.
          </p>
        </div>
      </div>

      {/* Guided Scenarios Quick Launch */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider">
            Guided Slide Scenarios
          </h2>
          <button
            onClick={() => onNavigate('scenarios')}
            className="text-xs text-blue-400 hover:underline flex items-center gap-1 font-medium"
          >
            <span>View All Guided Scenarios</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            {
              id: 'scenario_1_flow_vs_congestion',
              title: 'Scenario 1: Flow vs Congestion Control',
              desc: 'Inspect how sender is constrained by receiver window (rwnd) versus network bottleneck (cwnd).',
              color: 'border-blue-500/40 hover:border-blue-500',
            },
            {
              id: 'scenario_2_infinite_buffer',
              title: 'Scenario 2: Infinite-Buffer Idealization',
              desc: 'Shared router with infinite buffer: zero drops occur, but queueing delay rises sharply.',
              color: 'border-purple-500/40 hover:border-purple-500',
            },
            {
              id: 'scenario_3_finite_buffer',
              title: 'Scenario 3: Finite Buffers & Loss',
              desc: 'Buffer overflows, timeout retransmissions, duplicate ACKs, and wasted link capacity.',
              color: 'border-rose-500/40 hover:border-rose-500',
            },
            {
              id: 'scenario_4_multi_hop',
              title: 'Scenario 4: Multi-Hop Congestion Collapse',
              desc: 'Cross-traffic at downstream bottleneck wastes upstream transmission and buffer resources.',
              color: 'border-amber-500/40 hover:border-amber-500',
            },
            {
              id: 'scenario_5_tahoe_vs_reno',
              title: 'Scenario 5: TCP Tahoe vs TCP Reno',
              desc: 'Head-to-head triple duplicate ACK reaction: Tahoe reset to 1 MSS versus Reno fast recovery.',
              color: 'border-orange-500/40 hover:border-orange-500',
            },
            {
              id: 'scenario_7_rerouting_demo',
              title: 'Scenario 7: Dynamic Traffic Rerouting',
              desc: 'Primary link congests under load; detector triggers automatic diversion onto alternate route.',
              color: 'border-emerald-500/40 hover:border-emerald-500',
            },
          ].map((sc) => (
            <div
              key={sc.id}
              className={`p-4 rounded-xl bg-slate-900 border ${sc.color} transition-all shadow-md flex flex-col justify-between`}
            >
              <div className="space-y-1.5">
                <h3 className="text-xs font-bold text-slate-100">{sc.title}</h3>
                <p className="text-[11px] text-slate-400 leading-relaxed">{sc.desc}</p>
              </div>
              <button
                onClick={() => onNavigate('lab', sc.id)}
                className="mt-3 text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1"
              >
                <span>Launch in Lab</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
