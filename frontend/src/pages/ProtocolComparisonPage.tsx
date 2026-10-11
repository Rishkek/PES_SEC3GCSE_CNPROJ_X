import React, { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { GitCompare, Play, RotateCcw, Award, CheckCircle, HelpCircle } from 'lucide-react';
import { compareProtocols } from '../services/api';

interface ProtocolComparisonPageProps {
  onOpenHelpDesk: (key?: string) => void;
}

export const ProtocolComparisonPage: React.FC<ProtocolComparisonPageProps> = ({ onOpenHelpDesk }) => {
  const [duration, setDuration] = useState<number>(6.0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [results, setResults] = useState<any>(null);

  const runExperiment = async () => {
    setIsLoading(true);
    try {
      const data = await compareProtocols(duration, 42);
      setResults(data.comparison);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    runExperiment();
  }, []);

  // Merge snapshots by timestamp for synchronized charts
  const mergedSnapshots = React.useMemo(() => {
    if (!results) return [];
    const tahoeSnaps = results.tahoe?.snapshots || [];
    const renoSnaps = results.reno?.snapshots || [];
    const cubicSnaps = results.cubic?.snapshots || [];

    const map: Record<number, any> = {};

    tahoeSnaps.forEach((s: any) => {
      map[s.time] = {
        time: s.time,
        tahoe_cwnd: s.cwnd,
        tahoe_goodput: s.goodput_mbps,
        tahoe_rtt: s.rtt_ms,
        tahoe_drops: s.total_drops,
        tahoe_queue: s.queue_occupancy_pkts,
      };
    });

    renoSnaps.forEach((s: any) => {
      if (!map[s.time]) map[s.time] = { time: s.time };
      map[s.time].reno_cwnd = s.cwnd;
      map[s.time].reno_goodput = s.goodput_mbps;
      map[s.time].reno_rtt = s.rtt_ms;
      map[s.time].reno_drops = s.total_drops;
      map[s.time].reno_queue = s.queue_occupancy_pkts;
    });

    cubicSnaps.forEach((s: any) => {
      if (!map[s.time]) map[s.time] = { time: s.time };
      map[s.time].cubic_cwnd = s.cwnd;
      map[s.time].cubic_goodput = s.goodput_mbps;
      map[s.time].cubic_rtt = s.rtt_ms;
      map[s.time].cubic_drops = s.total_drops;
      map[s.time].cubic_queue = s.queue_occupancy_pkts;
    });

    return Object.values(map).sort((a, b) => a.time - b.time);
  }, [results]);

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-950">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-blue-400 uppercase tracking-wider mb-1">
            <GitCompare className="w-4 h-4" />
            <span>Controlled Protocol Benchmark</span>
          </div>
          <h1 className="text-xl font-bold text-slate-100">
            TCP Tahoe vs TCP Reno vs TCP CUBIC
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Under identical bottleneck conditions (10 Mbps access, 6 Mbps shared link, finite 12-packet buffer), observe how each transport protocol reacts to triple duplicate ACKs and loss recovery.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-300">
            <span>Duration:</span>
            <select
              value={duration}
              onChange={(e) => setDuration(parseFloat(e.target.value))}
              className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-slate-200 font-mono text-xs"
            >
              <option value="4.0">4.0 seconds</option>
              <option value="6.0">6.0 seconds</option>
              <option value="10.0">10.0 seconds</option>
            </select>
          </div>

          <button
            onClick={runExperiment}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium text-xs transition-colors shadow-lg shadow-blue-900/30"
          >
            {isLoading ? <RotateCcw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-white" />}
            <span>{isLoading ? 'Simulating...' : 'Run Benchmark'}</span>
          </button>
        </div>
      </div>

      {/* Synchronized Multi-Series Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Graph A: Congestion Window */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-200">
              Graph A: Congestion Window Evolution (cwnd)
            </h3>
            <button onClick={() => onOpenHelpDesk('cwnd')} className="text-slate-400 hover:text-blue-400">
              <HelpCircle className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={mergedSnapshots} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="time" stroke="#64748b" tickFormatter={(v) => `${v.toFixed(1)}s`} />
                <YAxis stroke="#64748b" label={{ value: 'MSS', angle: -90, position: 'insideLeft', fill: '#64748b' }} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', fontSize: '12px' }} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Line type="monotone" dataKey="tahoe_cwnd" name="Tahoe (Reset to 1)" stroke="#38bdf8" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="reno_cwnd" name="Reno (Fast Recovery)" stroke="#f97316" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="cubic_cwnd" name="CUBIC (Time Curve)" stroke="#10b981" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="text-[11px] text-slate-400 leading-relaxed bg-slate-950 p-2.5 rounded-lg border border-slate-800">
            <strong>Key Insight (Slide 30):</strong> On packet loss, Tahoe resets cwnd to 1 MSS and restarts Slow Start. Reno halves cwnd to ssthresh and maintains Fast Recovery. CUBIC cuts window to 0.70 * W_max and quickly re-climbs its cubic curve.
          </div>
        </div>

        {/* Graph B: Throughput / Goodput */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-200">
              Graph B: Useful Delivered Goodput (Mbps)
            </h3>
            <button onClick={() => onOpenHelpDesk('reno')} className="text-slate-400 hover:text-blue-400">
              <HelpCircle className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={mergedSnapshots} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="time" stroke="#64748b" tickFormatter={(v) => `${v.toFixed(1)}s`} />
                <YAxis stroke="#64748b" label={{ value: 'Mbps', angle: -90, position: 'insideLeft', fill: '#64748b' }} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', fontSize: '12px' }} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Line type="monotone" dataKey="tahoe_goodput" name="Tahoe Goodput" stroke="#38bdf8" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="reno_goodput" name="Reno Goodput" stroke="#f97316" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="cubic_goodput" name="CUBIC Goodput" stroke="#10b981" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="text-[11px] text-slate-400 leading-relaxed bg-slate-950 p-2.5 rounded-lg border border-slate-800">
            <strong>Goodput Impact:</strong> Notice how Tahoe's reset causes deep dips in delivery rate, while Reno and CUBIC preserve higher average pipeline throughput.
          </div>
        </div>

        {/* Graph C: Measured RTT & Queueing Delay */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-200">
              Graph C: Measured Round-Trip Time (RTT)
            </h3>
            <button onClick={() => onOpenHelpDesk('queue')} className="text-slate-400 hover:text-blue-400">
              <HelpCircle className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={mergedSnapshots} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="time" stroke="#64748b" tickFormatter={(v) => `${v.toFixed(1)}s`} />
                <YAxis stroke="#64748b" label={{ value: 'ms', angle: -90, position: 'insideLeft', fill: '#64748b' }} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', fontSize: '12px' }} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Line type="monotone" dataKey="tahoe_rtt" name="Tahoe RTT" stroke="#38bdf8" strokeWidth={1.5} dot={false} />
                <Line type="monotone" dataKey="reno_rtt" name="Reno RTT" stroke="#f97316" strokeWidth={1.5} dot={false} />
                <Line type="monotone" dataKey="cubic_rtt" name="CUBIC RTT" stroke="#10b981" strokeWidth={1.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Graph D: Router Queue Occupancy */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-200">
              Graph D: Bottleneck Router Queue Occupancy
            </h3>
            <button onClick={() => onOpenHelpDesk('queue')} className="text-slate-400 hover:text-blue-400">
              <HelpCircle className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={mergedSnapshots} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="time" stroke="#64748b" tickFormatter={(v) => `${v.toFixed(1)}s`} />
                <YAxis stroke="#64748b" label={{ value: 'Packets', angle: -90, position: 'insideLeft', fill: '#64748b' }} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', fontSize: '12px' }} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Line type="monotone" dataKey="tahoe_queue" name="Tahoe Queue" stroke="#38bdf8" strokeWidth={1.5} dot={false} />
                <Line type="monotone" dataKey="reno_queue" name="Reno Queue" stroke="#f97316" strokeWidth={1.5} dot={false} />
                <Line type="monotone" dataKey="cubic_queue" name="CUBIC Queue" stroke="#10b981" strokeWidth={1.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Summary Metrics Table */}
      {results && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-400" />
              <h2 className="text-sm font-bold text-slate-100">
                Summary Engineering Metrics (Derived from Backend Simulator)
              </h2>
            </div>
            <span className="text-[11px] font-mono text-slate-400">Duration: {duration}s</span>
          </div>

          <div className="overflow-x-auto border border-slate-800 rounded-lg">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-950 font-mono text-slate-400 text-[11px]">
                <tr>
                  <th className="p-3 border-b border-slate-800">Algorithm</th>
                  <th className="p-3 border-b border-slate-800">Useful Bytes Delivered</th>
                  <th className="p-3 border-b border-slate-800">Avg Goodput</th>
                  <th className="p-3 border-b border-slate-800">Buffer Drops</th>
                  <th className="p-3 border-b border-slate-800">Fast Retransmissions</th>
                  <th className="p-3 border-b border-slate-800">Timeouts</th>
                  <th className="p-3 border-b border-slate-800">Loss Reaction Policy</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-mono">
                {['tahoe', 'reno', 'cubic'].map((proto) => {
                  const s = results[proto]?.summary || {};
                  return (
                    <tr key={proto} className="hover:bg-slate-800/40">
                      <td className="p-3 font-bold uppercase text-slate-200">
                        TCP {proto}
                      </td>
                      <td className="p-3 text-emerald-400">
                        {((s.useful_bytes_delivered || 0) / 1000).toFixed(1)} KB
                      </td>
                      <td className="p-3 font-semibold text-slate-200">
                        {s.avg_goodput_mbps || 0} Mbps
                      </td>
                      <td className="p-3 text-rose-400">
                        {s.total_drops_overflow || 0}
                      </td>
                      <td className="p-3 text-blue-400">
                        {s.fast_retransmissions || 0}
                      </td>
                      <td className="p-3 text-amber-400">
                        {s.timeout_retransmissions || 0}
                      </td>
                      <td className="p-3 text-slate-300 font-sans text-[11px]">
                        {proto === 'tahoe' && 'Cuts cwnd to 1 MSS on 3-dup-ACK & restarts Slow Start'}
                        {proto === 'reno' && 'Halves cwnd, enters Fast Recovery, resumes linear avoidance'}
                        {proto === 'cubic' && 'Gentle cut (0.70 * W_max), rapid cubic curve re-ascent'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
