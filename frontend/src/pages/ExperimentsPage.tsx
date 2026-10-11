import React from 'react';
import { Download, Upload, Play, FolderCheck, FileText, CheckCircle } from 'lucide-react';
import { listScenarios } from '../services/api';

interface ExperimentsPageProps {
  onLoadScenario: (scenarioId: string) => void;
}

export const ExperimentsPage: React.FC<ExperimentsPageProps> = ({ onLoadScenario }) => {
  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-950 text-slate-100">
      <div>
        <h1 className="text-xl font-bold text-slate-100">Experiments & Saved Configurations</h1>
        <p className="text-xs text-slate-400 mt-1">
          Repeatable network topologies, protocol configurations, and exported simulation telemetry.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Preset Experiments */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
          <div className="flex items-center gap-2">
            <FolderCheck className="w-5 h-5 text-blue-400" />
            <h2 className="text-sm font-bold text-slate-200">Pre-Configured Experiments</h2>
          </div>
          <div className="space-y-2 text-xs">
            {[
              {
                id: 'scenario_1_flow_vs_congestion',
                title: 'Flow Control Limit (rwnd = 16)',
                desc: 'Sender bounded by receiver advertising window.',
              },
              {
                id: 'scenario_3_finite_buffer',
                title: 'Shared Bottleneck 10-pkt Queue',
                desc: 'Buffer drops, cumulative ACK gaps, retransmissions.',
              },
              {
                id: 'scenario_5_tahoe_vs_reno',
                title: 'Tahoe vs Reno 3-Dup-ACK Race',
                desc: 'Compare Tahoe reset vs Reno fast recovery.',
              },
              {
                id: 'scenario_7_rerouting_demo',
                title: 'Traffic Rerouting Bypass',
                desc: 'Automatic path switching upon congestion detection.',
              },
            ].map((exp) => (
              <div
                key={exp.id}
                className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between"
              >
                <div>
                  <div className="font-semibold text-slate-200">{exp.title}</div>
                  <div className="text-[11px] text-slate-400">{exp.desc}</div>
                </div>
                <button
                  onClick={() => onLoadScenario(exp.id)}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs flex items-center gap-1"
                >
                  <Play className="w-3.5 h-3.5 fill-white" />
                  <span>Run</span>
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Import & Export Operations */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-emerald-400" />
            <h2 className="text-sm font-bold text-slate-200">Import / Export Configurations</h2>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            All network configurations and discrete event traces are completely deterministic for a given configuration seed. You can export topologies as JSON or export simulation timeseries metrics as CSV.
          </p>

          <div className="space-y-3 pt-2">
            <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-slate-200">JSON Topology Specification</div>
                <div className="text-[11px] text-slate-400">Node capacities, link delays, bandwidths, protocols</div>
              </div>
              <button
                onClick={() => onLoadScenario('scenario_1_flow_vs_congestion')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs"
              >
                <Download className="w-3.5 h-3.5 text-blue-400" />
                <span>Open in Lab</span>
              </button>
            </div>

            <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-slate-200">CSV Telemetry Export</div>
                <div className="text-[11px] text-slate-400">Export timeseries data from the Analytics Workspace</div>
              </div>
              <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" /> Ready
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
