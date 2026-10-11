import React, { useState, useRef, useMemo } from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  TrendingUp,
  Activity,
  Clock,
  AlertTriangle,
  Server,
  Route,
  List,
  Search,
  Download,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  LayoutGrid,
  FileSpreadsheet,
  FileCode,
  Image as ImageIcon,
  Printer,
  ChevronDown,
} from 'lucide-react';
import { SimulationSnapshot, EventLogEntry, RerouteRecord } from '../../types';

export type WorkspaceLayout = 'compact' | 'expanded' | 'maximized';

interface AnalyticsWorkspaceProps {
  snapshots: SimulationSnapshot[];
  events: EventLogEntry[];
  rerouteHistory: RerouteRecord[];
  onSelectEvent?: (event: EventLogEntry) => void;
  onExplain?: (key: string) => void;
  layoutMode?: WorkspaceLayout;
  onLayoutModeChange?: (mode: WorkspaceLayout) => void;
}

export const AnalyticsWorkspace: React.FC<AnalyticsWorkspaceProps> = ({
  snapshots,
  events,
  rerouteHistory,
  onSelectEvent,
  onExplain,
  layoutMode = 'compact',
  onLayoutModeChange,
}) => {
  const [activeTab, setActiveTab] = useState<
    'cwnd' | 'throughput' | 'rtt' | 'loss' | 'queue' | 'reroute' | 'events' | 'dashboard'
  >('cwnd');
  const [eventSearch, setEventSearch] = useState('');
  const [eventCategoryFilter, setEventCategoryFilter] = useState<string>('ALL');

  // Zoom / time range state
  const [zoomLevel, setZoomLevel] = useState<number>(1.0); // 1.0 = all, 2.0 = 2x, etc.
  const [timeOffset, setTimeOffset] = useState<number>(0);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // Format snapshots for charts
  const rawChartData = useMemo(() => {
    return snapshots.map((s) => {
      const point: any = { time: s.time };
      // Flatten flows
      Object.entries(s.flows).forEach(([fid, flow]) => {
        point[`${fid}_cwnd`] = parseFloat(flow.cwnd.toFixed(2));
        point[`${fid}_ssthresh`] = parseFloat(flow.ssthresh.toFixed(2));
        point[`${fid}_goodput`] = parseFloat(flow.goodput_mbps.toFixed(2));
        point[`${fid}_tx`] = parseFloat(flow.tx_throughput_mbps.toFixed(2));
        point[`${fid}_rtt`] = parseFloat(flow.rtt_ms.toFixed(1));
        point[`${fid}_srtt`] = parseFloat(flow.srtt_ms.toFixed(1));
        point[`${fid}_drops`] = flow.total_drops_overflow + flow.total_drops_random;
        point[`${fid}_rexmits`] = flow.fast_retransmissions + flow.timeout_retransmissions;
      });
      // Flatten routers
      Object.entries(s.routers).forEach(([rid, r]) => {
        point[`${rid}_queue`] = r.queue_occupancy_pkts;
        point[`${rid}_cap`] = r.buffer_capacity;
      });
      return point;
    });
  }, [snapshots]);

  // Apply zoom / time window filtering
  const chartData = useMemo(() => {
    if (rawChartData.length === 0) return [];
    if (zoomLevel <= 1.0) return rawChartData;

    const totalPoints = rawChartData.length;
    const windowPoints = Math.max(5, Math.floor(totalPoints / zoomLevel));
    const maxOffset = Math.max(0, totalPoints - windowPoints);
    const clampedOffset = Math.min(timeOffset, maxOffset);

    return rawChartData.slice(clampedOffset, clampedOffset + windowPoints);
  }, [rawChartData, zoomLevel, timeOffset]);

  const maxTime = rawChartData.length > 0 ? rawChartData[rawChartData.length - 1].time : 0;

  // Extract flow keys & router keys
  const sampleFlows = snapshots[0]?.flows ? Object.keys(snapshots[0].flows) : [];
  const sampleRouters = snapshots[0]?.routers ? Object.keys(snapshots[0].routers) : [];

  // Filter events
  const filteredEvents = events.filter((e) => {
    const matchesSearch =
      !eventSearch ||
      e.description?.toLowerCase().includes(eventSearch.toLowerCase()) ||
      e.flow_id.toLowerCase().includes(eventSearch.toLowerCase()) ||
      e.category?.toLowerCase().includes(eventSearch.toLowerCase());
    const matchesCat = eventCategoryFilter === 'ALL' || e.category === eventCategoryFilter;
    return matchesSearch && matchesCat;
  });

  // Zoom handlers
  const handleZoomIn = () => {
    setZoomLevel((prev) => Math.min(10, prev * 1.5));
  };
  const handleZoomOut = () => {
    setZoomLevel((prev) => {
      const next = prev / 1.5;
      if (next <= 1.0) {
        setTimeOffset(0);
        return 1.0;
      }
      return next;
    });
  };
  const handleResetZoom = () => {
    setZoomLevel(1.0);
    setTimeOffset(0);
  };

  // 1. Export CSV
  const handleExportCSV = () => {
    if (rawChartData.length === 0) return;
    const headers = Object.keys(rawChartData[0]).join(',');
    const rows = rawChartData.map((d) => Object.values(d).join(','));
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...rows].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `netlab_metrics_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setExportMenuOpen(false);
  };

  // 2. Export JSON
  const handleExportJSON = () => {
    if (rawChartData.length === 0) return;
    const jsonStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(rawChartData, null, 2));
    const link = document.createElement('a');
    link.setAttribute('href', jsonStr);
    link.setAttribute('download', `netlab_metrics_${Date.now()}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setExportMenuOpen(false);
  };

  // 3. Export SVG
  const handleExportSVG = () => {
    const svgEl = containerRef.current?.querySelector('svg.recharts-surface');
    if (!svgEl) {
      alert('No chart SVG found to export.');
      return;
    }
    const serializer = new XMLSerializer();
    let source = serializer.serializeToString(svgEl);
    if (!source.match(/^<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)) {
      source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `netlab_chart_${Date.now()}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setExportMenuOpen(false);
  };

  // 4. Export PNG (Canvas conversion)
  const handleExportPNG = () => {
    const svgEl = containerRef.current?.querySelector('svg.recharts-surface');
    if (!svgEl) {
      alert('No chart found to export.');
      return;
    }
    const serializer = new XMLSerializer();
    let source = serializer.serializeToString(svgEl);
    if (!source.match(/^<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)) {
      source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    const svgBlob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    const URLObject = window.URL || window.webkitURL || window;
    const blobURL = URLObject.createObjectURL(svgBlob);

    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = svgEl.clientWidth || 1000;
      canvas.height = svgEl.clientHeight || 500;
      const context = canvas.getContext('2d');
      if (context) {
        context.fillStyle = '#0f172a'; // dark background
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0);
        const pngURL = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = pngURL;
        link.download = `netlab_chart_${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
      URLObject.revokeObjectURL(blobURL);
    };
    image.src = blobURL;
    setExportMenuOpen(false);
  };

  // 5. Printable HTML / PDF Report
  const handlePrintReport = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const lastSnap = snapshots[snapshots.length - 1];
    const totalDrops = lastSnap
      ? Object.values(lastSnap.flows).reduce(
          (sum, f) => sum + f.total_drops_overflow + f.total_drops_random,
          0
        )
      : 0;
    const totalRexmits = lastSnap
      ? Object.values(lastSnap.flows).reduce(
          (sum, f) => sum + f.fast_retransmissions + f.timeout_retransmissions,
          0
        )
      : 0;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>NetLab Simulation Report</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 24px; color: #1e293b; background: #fff; }
            h1 { font-size: 22px; margin-bottom: 4px; color: #0f172a; }
            .subtitle { font-size: 13px; color: #64748b; margin-bottom: 20px; }
            .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
            .stat-card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; background: #f8fafc; }
            .stat-val { font-size: 20px; font-weight: bold; color: #0f172a; }
            .stat-lbl { font-size: 11px; text-transform: uppercase; color: #64748b; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 12px; }
            th, td { border: 1px solid #e2e8f0; padding: 8px 12px; text-align: left; }
            th { background: #f1f5f9; color: #475569; }
            @media print { body { padding: 0; } button { display: none; } }
          </style>
        </head>
        <body>
          <h1>NetLab — Simulation Run Report</h1>
          <div class="subtitle">Generated on ${new Date().toLocaleString()} | Duration: ${maxTime.toFixed(2)}s</div>
          <div class="stats-grid">
            <div class="stat-card"><div class="stat-lbl">Simulated Time</div><div class="stat-val">${maxTime.toFixed(2)}s</div></div>
            <div class="stat-card"><div class="stat-lbl">Total Samples</div><div class="stat-val">${snapshots.length}</div></div>
            <div class="stat-card"><div class="stat-lbl">Total Packet Drops</div><div class="stat-val">${totalDrops}</div></div>
            <div class="stat-card"><div class="stat-lbl">Retransmissions</div><div class="stat-val">${totalRexmits}</div></div>
          </div>
          <h3>Flow Summary</h3>
          <table>
            <thead>
              <tr><th>Flow ID</th><th>Final cwnd</th><th>ssthresh</th><th>State</th><th>SRTT</th><th>Goodput</th><th>Drops</th></tr>
            </thead>
            <tbody>
              ${lastSnap ? Object.entries(lastSnap.flows).map(([fid, f]) => `
                <tr>
                  <td><strong>${fid}</strong></td>
                  <td>${f.cwnd.toFixed(1)} MSS</td>
                  <td>${f.ssthresh.toFixed(0)}</td>
                  <td>${f.state}</td>
                  <td>${f.srtt_ms.toFixed(1)} ms</td>
                  <td>${f.goodput_mbps.toFixed(2)} Mbps</td>
                  <td>${f.total_drops_overflow + f.total_drops_random}</td>
                </tr>
              `).join('') : '<tr><td colspan="7">No flow data</td></tr>'}
            </tbody>
          </table>
          <br/>
          <button onclick="window.print()" style="padding: 8px 16px; background: #2563eb; color: #fff; border: none; border-radius: 6px; cursor: pointer;">Print to PDF</button>
        </body>
      </html>
    `);
    printWindow.document.close();
    setExportMenuOpen(false);
  };

  return (
    <div
      ref={containerRef}
      className="bg-slate-900 border-t border-slate-800 flex flex-col h-full select-none"
    >
      {/* Workspace Navigation & Toolbar */}
      <div className="flex items-center justify-between border-b border-slate-800 px-3 bg-slate-950/80 gap-2">
        {/* Navigation Tabs */}
        <div className="flex space-x-1 overflow-x-auto py-1.5 scrollbar-none">
          <button
            onClick={() => setActiveTab('cwnd')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'cwnd'
                ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Congestion Window</span>
          </button>

          <button
            onClick={() => setActiveTab('throughput')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'throughput'
                ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Throughput</span>
          </button>

          <button
            onClick={() => setActiveTab('rtt')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'rtt'
                ? 'bg-amber-600/20 text-amber-400 border border-amber-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>RTT & Delay</span>
          </button>

          <button
            onClick={() => setActiveTab('loss')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'loss'
                ? 'bg-rose-600/20 text-rose-400 border border-rose-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Loss</span>
          </button>

          <button
            onClick={() => setActiveTab('queue')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'queue'
                ? 'bg-purple-600/20 text-purple-400 border border-purple-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span>Queue</span>
          </button>

          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'dashboard'
                ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
            title="4-Graph Multi-Chart Dashboard View"
          >
            <LayoutGrid className="w-3.5 h-3.5 text-indigo-400" />
            <span>Multi-Graph</span>
          </button>

          <button
            onClick={() => setActiveTab('reroute')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'reroute'
                ? 'bg-sky-600/20 text-sky-400 border border-sky-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Route className="w-3.5 h-3.5" />
            <span>Rerouting</span>
          </button>

          <button
            onClick={() => setActiveTab('events')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'events'
                ? 'bg-cyan-600/20 text-cyan-400 border border-cyan-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <List className="w-3.5 h-3.5" />
            <span>Events ({events.length})</span>
          </button>
        </div>

        {/* Action Controls: Zoom, Layout, and Export */}
        <div className="flex items-center gap-1.5 relative">
          {/* Zoom controls */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5">
            <button
              onClick={handleZoomIn}
              className="p-1 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded transition-colors"
              title="Zoom In Time Window"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleZoomOut}
              className="p-1 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded transition-colors"
              title="Zoom Out Time Window"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            {zoomLevel > 1.0 && (
              <button
                onClick={handleResetZoom}
                className="px-1.5 py-0.5 text-[10px] font-mono text-blue-400 hover:bg-slate-800 rounded flex items-center gap-0.5"
                title="Reset zoom to fit all data"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Fit</span>
              </button>
            )}
          </div>

          {/* Export Dropdown Menu */}
          <div className="relative">
            <button
              onClick={() => setExportMenuOpen(!exportMenuOpen)}
              className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700"
            >
              <Download className="w-3.5 h-3.5 text-blue-400" />
              <span>Export</span>
              <ChevronDown className="w-3 h-3 text-slate-500" />
            </button>

            {exportMenuOpen && (
              <div
                className="absolute right-0 top-full mt-1 w-44 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl py-1 z-50 text-xs text-slate-200"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={handleExportCSV}
                  className="w-full px-3 py-1.5 text-left hover:bg-slate-800 flex items-center gap-2 text-slate-300"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Export CSV</span>
                </button>
                <button
                  onClick={handleExportJSON}
                  className="w-full px-3 py-1.5 text-left hover:bg-slate-800 flex items-center gap-2 text-slate-300"
                >
                  <FileCode className="w-3.5 h-3.5 text-amber-400" />
                  <span>Export JSON</span>
                </button>
                <button
                  onClick={handleExportPNG}
                  className="w-full px-3 py-1.5 text-left hover:bg-slate-800 flex items-center gap-2 text-slate-300"
                >
                  <ImageIcon className="w-3.5 h-3.5 text-blue-400" />
                  <span>Export PNG Chart</span>
                </button>
                <button
                  onClick={handleExportSVG}
                  className="w-full px-3 py-1.5 text-left hover:bg-slate-800 flex items-center gap-2 text-slate-300"
                >
                  <Download className="w-3.5 h-3.5 text-purple-400" />
                  <span>Export SVG Vector</span>
                </button>
                <div className="border-t border-slate-800 my-1" />
                <button
                  onClick={handlePrintReport}
                  className="w-full px-3 py-1.5 text-left hover:bg-slate-800 flex items-center gap-2 text-slate-300"
                >
                  <Printer className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Print Report / PDF</span>
                </button>
              </div>
            )}
          </div>

          {/* Layout Mode Toggles (Compact, Expanded, Maximized) */}
          {onLayoutModeChange && (
            <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5">
              <button
                onClick={() =>
                  onLayoutModeChange(layoutMode === 'maximized' ? 'compact' : 'maximized')
                }
                className="p-1 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded transition-colors"
                title={layoutMode === 'maximized' ? 'Restore Workspace' : 'Maximize Graph Workspace'}
              >
                {layoutMode === 'maximized' ? (
                  <Minimize2 className="w-3.5 h-3.5 text-blue-400" />
                ) : (
                  <Maximize2 className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 p-3 min-h-[200px] overflow-hidden">
        {chartData.length === 0 && activeTab !== 'events' ? (
          <div className="h-full flex items-center justify-center text-xs text-slate-500">
            No simulation metrics recorded yet. Press "Run" or "Step" above to start live data collection.
          </div>
        ) : (
          <>
            {/* 1. CONGESTION WINDOW TAB */}
            {activeTab === 'cwnd' && (
              <div className="w-full h-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="time" stroke="#64748b" tickFormatter={(v) => `${v.toFixed(1)}s`} />
                    <YAxis stroke="#64748b" label={{ value: 'MSS', angle: -90, position: 'insideLeft', fill: '#64748b' }} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', fontSize: '12px' }} />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    {sampleFlows.map((fid, idx) => (
                      <React.Fragment key={fid}>
                        <Line
                          type="monotone"
                          dataKey={`${fid}_cwnd`}
                          name={`${fid} (cwnd)`}
                          stroke={idx === 0 ? '#3b82f6' : idx === 1 ? '#f97316' : '#10b981'}
                          strokeWidth={2}
                          dot={false}
                        />
                        <Line
                          type="stepAfter"
                          dataKey={`${fid}_ssthresh`}
                          name={`${fid} (ssthresh)`}
                          stroke={idx === 0 ? '#93c5fd' : '#fdba74'}
                          strokeDasharray="4 4"
                          dot={false}
                        />
                      </React.Fragment>
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* 2. THROUGHPUT TAB */}
            {activeTab === 'throughput' && (
              <div className="w-full h-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="time" stroke="#64748b" tickFormatter={(v) => `${v.toFixed(1)}s`} />
                    <YAxis stroke="#64748b" label={{ value: 'Mbps', angle: -90, position: 'insideLeft', fill: '#64748b' }} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', fontSize: '12px' }} />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    {sampleFlows.map((fid) => (
                      <React.Fragment key={fid}>
                        <Area
                          type="monotone"
                          dataKey={`${fid}_goodput`}
                          name={`${fid} Useful Goodput`}
                          stroke="#10b981"
                          fill="rgba(16, 185, 129, 0.2)"
                          strokeWidth={2}
                        />
                        <Line
                          type="monotone"
                          dataKey={`${fid}_tx`}
                          name={`${fid} Transmitted Load`}
                          stroke="#60a5fa"
                          strokeDasharray="3 3"
                          dot={false}
                        />
                      </React.Fragment>
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* 3. RTT TAB */}
            {activeTab === 'rtt' && (
              <div className="w-full h-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="time" stroke="#64748b" tickFormatter={(v) => `${v.toFixed(1)}s`} />
                    <YAxis stroke="#64748b" label={{ value: 'ms', angle: -90, position: 'insideLeft', fill: '#64748b' }} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', fontSize: '12px' }} />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    {sampleFlows.map((fid) => (
                      <React.Fragment key={fid}>
                        <Line
                          type="monotone"
                          dataKey={`${fid}_rtt`}
                          name={`${fid} Sample RTT`}
                          stroke="#f59e0b"
                          strokeWidth={2}
                          dot={false}
                        />
                        <Line
                          type="monotone"
                          dataKey={`${fid}_srtt`}
                          name={`${fid} Smoothed SRTT`}
                          stroke="#3b82f6"
                          strokeDasharray="4 4"
                          dot={false}
                        />
                      </React.Fragment>
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* 4. LOSS TAB */}
            {activeTab === 'loss' && (
              <div className="w-full h-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="time" stroke="#64748b" tickFormatter={(v) => `${v.toFixed(1)}s`} />
                    <YAxis stroke="#64748b" label={{ value: 'Packets', angle: -90, position: 'insideLeft', fill: '#64748b' }} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', fontSize: '12px' }} />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    {sampleFlows.map((fid) => (
                      <React.Fragment key={fid}>
                        <Bar dataKey={`${fid}_drops`} name={`${fid} Total Drops`} fill="#f43f5e" />
                        <Bar dataKey={`${fid}_rexmits`} name={`${fid} Retransmissions`} fill="#f97316" />
                      </React.Fragment>
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* 5. QUEUE TAB */}
            {activeTab === 'queue' && (
              <div className="w-full h-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="time" stroke="#64748b" tickFormatter={(v) => `${v.toFixed(1)}s`} />
                    <YAxis stroke="#64748b" label={{ value: 'Packets', angle: -90, position: 'insideLeft', fill: '#64748b' }} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', fontSize: '12px' }} />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    {sampleRouters.map((rid, idx) => (
                      <React.Fragment key={rid}>
                        <Line
                          type="monotone"
                          dataKey={`${rid}_queue`}
                          name={`${rid} Queue Occupancy`}
                          stroke={idx === 0 ? '#a855f7' : '#ec4899'}
                          strokeWidth={2}
                          dot={false}
                        />
                        <Line
                          type="stepAfter"
                          dataKey={`${rid}_cap`}
                          name={`${rid} Buffer Limit`}
                          stroke="#ef4444"
                          strokeDasharray="5 5"
                          dot={false}
                        />
                      </React.Fragment>
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* 6. MULTI-GRAPH DASHBOARD TAB */}
            {activeTab === 'dashboard' && (
              <div className="w-full h-full grid grid-cols-2 grid-rows-2 gap-2 overflow-hidden">
                {/* Chart 1: cwnd */}
                <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800 flex flex-col min-h-0">
                  <div className="text-[10px] font-semibold text-slate-400 mb-1 flex items-center gap-1">
                    <TrendingUp className="w-3 h-3 text-blue-400" />
                    <span>Congestion Window (MSS)</span>
                  </div>
                  <div className="flex-1 min-h-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="2 2" stroke="#1e293b" />
                        <XAxis dataKey="time" stroke="#64748b" tick={false} />
                        <YAxis stroke="#64748b" fontSize={10} />
                        {sampleFlows.map((fid, idx) => (
                          <Line
                            key={fid}
                            type="monotone"
                            dataKey={`${fid}_cwnd`}
                            stroke={idx === 0 ? '#3b82f6' : '#f97316'}
                            dot={false}
                            strokeWidth={1.5}
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Chart 2: Throughput */}
                <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800 flex flex-col min-h-0">
                  <div className="text-[10px] font-semibold text-slate-400 mb-1 flex items-center gap-1">
                    <Activity className="w-3 h-3 text-emerald-400" />
                    <span>Throughput (Mbps)</span>
                  </div>
                  <div className="flex-1 min-h-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <CartesianGrid strokeDasharray="2 2" stroke="#1e293b" />
                        <XAxis dataKey="time" stroke="#64748b" tick={false} />
                        <YAxis stroke="#64748b" fontSize={10} />
                        {sampleFlows.map((fid) => (
                          <Area
                            key={fid}
                            type="monotone"
                            dataKey={`${fid}_goodput`}
                            stroke="#10b981"
                            fill="rgba(16, 185, 129, 0.2)"
                            strokeWidth={1.5}
                          />
                        ))}
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Chart 3: Queue */}
                <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800 flex flex-col min-h-0">
                  <div className="text-[10px] font-semibold text-slate-400 mb-1 flex items-center gap-1">
                    <Server className="w-3 h-3 text-purple-400" />
                    <span>Router Queue (Packets)</span>
                  </div>
                  <div className="flex-1 min-h-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="2 2" stroke="#1e293b" />
                        <XAxis dataKey="time" stroke="#64748b" tick={false} />
                        <YAxis stroke="#64748b" fontSize={10} />
                        {sampleRouters.map((rid) => (
                          <Line
                            key={rid}
                            type="monotone"
                            dataKey={`${rid}_queue`}
                            stroke="#a855f7"
                            dot={false}
                            strokeWidth={1.5}
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Chart 4: RTT Delay */}
                <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800 flex flex-col min-h-0">
                  <div className="text-[10px] font-semibold text-slate-400 mb-1 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-amber-400" />
                    <span>Smoothed RTT (ms)</span>
                  </div>
                  <div className="flex-1 min-h-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="2 2" stroke="#1e293b" />
                        <XAxis dataKey="time" stroke="#64748b" tick={false} />
                        <YAxis stroke="#64748b" fontSize={10} />
                        {sampleFlows.map((fid) => (
                          <Line
                            key={fid}
                            type="monotone"
                            dataKey={`${fid}_srtt`}
                            stroke="#f59e0b"
                            dot={false}
                            strokeWidth={1.5}
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}

            {/* 7. REROUTE TAB */}
            {activeTab === 'reroute' && (
              <div className="w-full h-full overflow-y-auto pr-2">
                <div className="text-xs font-semibold text-slate-300 mb-2">
                  Traffic Rerouting History ({rerouteHistory.length} Transitions)
                </div>
                {rerouteHistory.length === 0 ? (
                  <div className="text-xs text-slate-500 py-8 text-center">
                    No dynamic traffic rerouting occurred yet. Enable "Auto-Reroute" or run Scenario 7 to demonstrate path shifting.
                  </div>
                ) : (
                  <table className="w-full text-xs text-left border border-slate-800 rounded-lg overflow-hidden">
                    <thead className="bg-slate-950 text-slate-400 font-mono text-[11px]">
                      <tr>
                        <th className="p-2 border-b border-slate-800">Timestamp</th>
                        <th className="p-2 border-b border-slate-800">Flow</th>
                        <th className="p-2 border-b border-slate-800">Original Route</th>
                        <th className="p-2 border-b border-slate-800">New Diverted Route</th>
                        <th className="p-2 border-b border-slate-800">Trigger Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 font-mono">
                      {rerouteHistory.map((rec, idx) => (
                        <tr key={idx} className="hover:bg-slate-800/40">
                          <td className="p-2 text-slate-400">{rec.time.toFixed(3)}s</td>
                          <td className="p-2 text-slate-200 font-bold">{rec.flow_id}</td>
                          <td className="p-2 text-rose-400">{rec.old_path.join(' ➔ ')}</td>
                          <td className="p-2 text-emerald-400 font-semibold">{rec.new_path.join(' ➔ ')}</td>
                          <td className="p-2 text-purple-300">{rec.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* 8. EVENTS TAB */}
            {activeTab === 'events' && (
              <div className="w-full h-full flex flex-col space-y-2">
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Search event timeline (e.g. drop, retransmit, timeout)..."
                      value={eventSearch}
                      onChange={(e) => setEventSearch(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <select
                    value={eventCategoryFilter}
                    onChange={(e) => setEventCategoryFilter(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 font-mono"
                  >
                    <option value="ALL">All Categories</option>
                    <option value="DROP_BUFFER_FULL">Buffer Drops</option>
                    <option value="DROP_RANDOM_LOSS">Random Drops</option>
                    <option value="TIMEOUT">Timeouts</option>
                    <option value="FAST_RETRANSMIT">Fast Retransmit</option>
                    <option value="ECN_MARKED">ECN Signals</option>
                    <option value="TRAFFIC_REROUTE">Reroutes</option>
                  </select>
                </div>

                <div className="flex-1 overflow-y-auto border border-slate-800 rounded-lg max-h-[160px]">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-950 text-slate-400 font-mono text-[10px] sticky top-0">
                      <tr>
                        <th className="p-2 border-b border-slate-800">Time</th>
                        <th className="p-2 border-b border-slate-800">Category</th>
                        <th className="p-2 border-b border-slate-800">Flow</th>
                        <th className="p-2 border-b border-slate-800">Description</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80 font-mono text-[11px]">
                      {filteredEvents.map((evt) => (
                        <tr
                          key={evt.event_id}
                          onClick={() => onSelectEvent?.(evt)}
                          className="hover:bg-slate-800/50 cursor-pointer"
                        >
                          <td className="p-2 text-slate-400 whitespace-nowrap">{evt.time.toFixed(3)}s</td>
                          <td className="p-2 whitespace-nowrap">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[9px] uppercase font-bold ${
                                evt.category === 'DROP_BUFFER_FULL'
                                  ? 'bg-rose-950/60 text-rose-400 border border-rose-800/60'
                                  : evt.category === 'TIMEOUT'
                                  ? 'bg-amber-950/60 text-amber-400 border border-amber-800/60'
                                  : evt.category === 'FAST_RETRANSMIT'
                                  ? 'bg-blue-950/60 text-blue-400 border border-blue-800/60'
                                  : evt.category === 'TRAFFIC_REROUTE'
                                  ? 'bg-purple-950/60 text-purple-400 border border-purple-800/60'
                                  : 'bg-slate-800 text-slate-300'
                              }`}
                            >
                              {evt.category || evt.event_type}
                            </span>
                          </td>
                          <td className="p-2 text-slate-300 whitespace-nowrap">{evt.flow_id}</td>
                          <td className="p-2 text-slate-300 truncate max-w-md">{evt.description || evt.event_type}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
