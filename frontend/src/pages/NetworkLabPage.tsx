import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  TopologyCanvas,
} from '../components/topology/TopologyCanvas';
import { NodePalette } from '../components/topology/NodePalette';
import { SimulationToolbar } from '../components/controls/SimulationToolbar';
import { PropertiesPanel, PropertiesTab } from '../components/panels/PropertiesPanel';
import { ProtocolStatePanel } from '../components/panels/ProtocolStatePanel';
import { ReroutingDashboard } from '../components/panels/ReroutingDashboard';
import { AnalyticsWorkspace, WorkspaceLayout } from '../components/charts/AnalyticsWorkspace';
import { ContextMenu, ContextMenuTarget } from '../components/topology/ContextMenu';
import {
  TopologyData,
  NodeConfig,
  LinkConfig,
  NodeType,
  SimulationSnapshot,
  EventLogEntry,
  ProtocolState,
  RerouteRecord,
} from '../types';
import {
  createSimulation,
  runSimulation,
  stepSimulation,
  resetSimulation,
  getMetrics,
  getEvents,
  rerouteTraffic,
  getScenario,
  updateNode,
  updateLink,
  cutLink,
  overrideCwnd,
  updateTopology,
  injectControlledCongestion,
  setSDNMode,
  setSDNThresholds,
} from '../services/api';
import {
  ChevronLeft,
  ChevronRight,
  Sliders,
  Activity,
  Route,
  BookOpen,
  GripHorizontal,
  Undo2,
  Redo2,
  CheckCircle2,
  AlertTriangle,
  Info,
} from 'lucide-react';

interface NetworkLabPageProps {
  initialScenarioId?: string;
  onOpenHelpDesk: (key?: string) => void;
}

export const NetworkLabPage: React.FC<NetworkLabPageProps> = ({
  initialScenarioId = 'scenario_27_sdn_udp_reroute',
  onOpenHelpDesk,
}) => {
  // Topology state
  const [topology, setTopology] = useState<TopologyData>({ nodes: [], links: [] });
  const [simId, setSimId] = useState<string | null>(null);
  const [selectedElement, setSelectedElement] = useState<{ type: 'node' | 'edge'; id: string } | null>(null);

  // Undo / Redo history stacks
  const [undoStack, setUndoStack] = useState<TopologyData[]>([]);
  const [redoStack, setRedoStack] = useState<TopologyData[]>([]);

  // Simulation controls state
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [simTime, setSimTime] = useState<number>(0.0);
  const [eventsCount, setEventsCount] = useState<number>(0);
  const [speed, setSpeed] = useState<number>(1.0);
  const [autoReroute, setAutoReroute] = useState<boolean>(true);
  const [guidedMode, setGuidedMode] = useState<boolean>(true);

  // Panels collapse & tab states
  const [leftPanelOpen, setLeftPanelOpen] = useState<boolean>(true);
  const [rightPanelOpen, setRightPanelOpen] = useState<boolean>(true);
  const [rightPanelTab, setRightPanelTab] = useState<'properties' | 'protocols' | 'rerouting'>('properties');
  const [propertiesTargetTab, setPropertiesTargetTab] = useState<PropertiesTab | null>(null);

  // Graph workspace layout & resizing state
  const [graphHeight, setGraphHeight] = useState<number>(260);
  const [graphLayoutMode, setGraphLayoutMode] = useState<WorkspaceLayout>('compact');
  const [isDraggingSplitter, setIsDraggingSplitter] = useState<boolean>(false);

  // Context Menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    target: ContextMenuTarget;
  } | null>(null);

  // Toast notification state
  const [toast, setToast] = useState<{ message: string; type: 'info' | 'success' | 'warn' } | null>(null);
  const toastTimeoutRef = useRef<any>(null);

  const showToast = (message: string, type: 'info' | 'success' | 'warn' = 'info') => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast({ message, type });
    toastTimeoutRef.current = setTimeout(() => setToast(null), 3200);
  };

  // Metrics and logs
  const [snapshots, setSnapshots] = useState<SimulationSnapshot[]>([]);
  const [latestSnapshot, setLatestSnapshot] = useState<SimulationSnapshot | null>(null);
  const [events, setEvents] = useState<EventLogEntry[]>([]);
  const [protocols, setProtocols] = useState<Record<string, ProtocolState>>({});
  const [flowPaths, setFlowPaths] = useState<Record<string, string[]>>({});
  const [congestionScores, setCongestionScores] = useState<Record<string, number>>({});
  const [rerouteHistory, setRerouteHistory] = useState<RerouteRecord[]>([]);

  // Simulation interval timer ref
  const timerRef = useRef<any>(null);

  // Push to history helper
  const commitTopology = (newTopo: TopologyData) => {
    setUndoStack((prev) => [...prev.slice(-20), topology]);
    setRedoStack([]);
    setTopology(newTopo);
  };

  // Handle Undo
  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, prev.length - 1));
    setRedoStack((prev) => [...prev, topology]);
    setTopology(previous);
    if (simId) {
      updateTopology(simId, previous).catch(console.error);
    }
    showToast('Undo topology change', 'info');
  }, [undoStack, topology, simId]);

  // Handle Redo
  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.slice(0, prev.length - 1));
    setUndoStack((prev) => [...prev, topology]);
    setTopology(next);
    if (simId) {
      updateTopology(simId, next).catch(console.error);
    }
    showToast('Redo topology change', 'info');
  }, [redoStack, topology, simId]);

  // Initialize simulation from scenario
  const initFromScenario = useCallback(
    async (scenarioId: string) => {
      try {
        const data = await getScenario(scenarioId);
        setTopology(data.topology);
        setUndoStack([]);
        setRedoStack([]);
        const res = await createSimulation(data.topology, 42, autoReroute);
        setSimId(res.sim_id);
        setSimTime(0.0);
        setEventsCount(0);
        setSnapshots([]);
        setLatestSnapshot(null);
        setEvents([]);
        setProtocols({});
        setRerouteHistory([]);
        showToast(`Loaded ${data.meta?.title || scenarioId}`, 'success');
      } catch (err) {
        console.error('Failed to init scenario:', err);
      }
    },
    [autoReroute]
  );

  useEffect(() => {
    initFromScenario(initialScenarioId);
  }, [initialScenarioId, initFromScenario]);

  // Sync simulation when topology updates structure
  const handleTopologyChange = async (newTopo: TopologyData) => {
    commitTopology(newTopo);
    if (simId) {
      try {
        await updateTopology(simId, newTopo);
      } catch (err) {
        // Fallback recreate if needed
        try {
          const res = await createSimulation(newTopo, 42, autoReroute);
          setSimId(res.sim_id);
        } catch (e) {
          console.error('Failed to sync new topology:', e);
        }
      }
    }
  };

  // Run loop
  useEffect(() => {
    if (isRunning && simId) {
      const intervalMs = Math.max(50, Math.floor(100 / speed));
      timerRef.current = setInterval(async () => {
        try {
          const runRes = await runSimulation(simId, 0.1 * speed);
          setSimTime(runRes.sim_time);
          if (runRes.latest_snapshot) {
            setLatestSnapshot(runRes.latest_snapshot);
          }

          // Fetch metrics and events periodically
          const [metricsRes, eventsRes] = await Promise.all([
            getMetrics(simId),
            getEvents(simId),
          ]);

          setSnapshots(metricsRes.snapshots || []);
          if (metricsRes.snapshots && metricsRes.snapshots.length > 0) {
            const last = metricsRes.snapshots[metricsRes.snapshots.length - 1];
            setLatestSnapshot(last);

            // Update protocols readout
            const protoMap: Record<string, ProtocolState> = {};
            Object.entries(last.flows).forEach(([fid, f]) => {
              protoMap[fid] = {
                protocol: fid,
                cwnd: f.cwnd,
                ssthresh: f.ssthresh,
                dup_ack_count: 0,
                state: f.state,
                bytes_in_flight: f.bytes_in_flight,
                rtt: f.rtt_ms,
                srtt: f.srtt_ms,
                rto: f.rto_ms,
                total_retransmissions: f.fast_retransmissions + f.timeout_retransmissions,
                fast_retransmissions: f.fast_retransmissions,
                timeout_retransmissions: f.timeout_retransmissions,
                w_max: f.cwnd,
                last_congestion_event_time: 0,
              };
            });
            setProtocols(protoMap);

            // Flow paths
            const pathMap: Record<string, string[]> = {};
            Object.entries(last.flows).forEach(([fid, f]) => {
              pathMap[fid] = f.active_path;
            });
            setFlowPaths(pathMap);

            // Congestion scores
            const scoreMap: Record<string, number> = {};
            Object.entries(last.links).forEach(([lid, l]) => {
              scoreMap[lid] = l.congestion_score;
            });
            setCongestionScores(scoreMap);
          }

          setEvents(eventsRes.events || []);
          setEventsCount(eventsRes.total_logged || 0);
          setRerouteHistory(metricsRes.reroute_history || []);

          if (runRes.is_completed) {
            setIsRunning(false);
          }
        } catch (err) {
          console.error('Simulation tick error:', err);
          setIsRunning(false);
        }
      }, intervalMs);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning, simId, speed]);

  const handleStepEvent = useCallback(async () => {
    if (!simId) return;
    try {
      const res = await stepSimulation(simId, 'event');
      setSimTime(res.sim_time);
      if (res.latest_snapshot) setLatestSnapshot(res.latest_snapshot);
      const [met, evts] = await Promise.all([getMetrics(simId), getEvents(simId)]);
      setSnapshots(met.snapshots || []);
      setEvents(evts.events || []);
      setEventsCount(evts.total_logged || 0);
    } catch (err) {
      console.error(err);
    }
  }, [simId]);

  const handleStepRTT = useCallback(async () => {
    if (!simId) return;
    try {
      const res = await stepSimulation(simId, 'rtt');
      setSimTime(res.sim_time);
      if (res.latest_snapshot) setLatestSnapshot(res.latest_snapshot);
      const [met, evts] = await Promise.all([getMetrics(simId), getEvents(simId)]);
      setSnapshots(met.snapshots || []);
      setEvents(evts.events || []);
      setEventsCount(evts.total_logged || 0);
    } catch (err) {
      console.error(err);
    }
  }, [simId]);

  const handleReset = useCallback(async () => {
    if (!simId) return;
    setIsRunning(false);
    try {
      await resetSimulation(simId);
      setSimTime(0.0);
      setEventsCount(0);
      setSnapshots([]);
      setLatestSnapshot(null);
      setEvents([]);
      setRerouteHistory([]);
      showToast('Simulation reset to t=0', 'info');
    } catch (err) {
      console.error(err);
    }
  }, [simId]);

  // Node palette additions
  const handleAddNode = (type: NodeType) => {
    const id = `${type}_${Date.now().toString().slice(-4)}`;
    const newNode: NodeConfig = {
      id,
      label: `${type.toUpperCase()} ${topology.nodes.length + 1}`,
      type,
      x: 180 + Math.random() * 220,
      y: 120 + Math.random() * 180,
      buffer_capacity: 15,
      drop_policy: 'tail_drop',
      ecn_threshold: 0.7,
      protocol: 'reno',
      mss: 1000,
      initial_cwnd: 1.0,
      initial_ssthresh: 32.0,
      max_cwnd: 128.0,
      app_rate_bps: 0,
      start_time: 0,
      rwnd: 64.0,
    };
    handleTopologyChange({
      ...topology,
      nodes: [...topology.nodes, newNode],
    });
    setSelectedElement({ type: 'node', id });
    showToast(`Added ${newNode.label}`, 'success');
  };

  const handleClear = () => {
    commitTopology({ nodes: [], links: [] });
    setSelectedElement(null);
    showToast('Topology cleared', 'warn');
  };

  const handleAutoLayout = () => {
    const senders = topology.nodes.filter((n) => n.type === 'sender');
    const routers = topology.nodes.filter((n) => n.type === 'router' || n.type === 'switch');
    const receivers = topology.nodes.filter((n) => n.type === 'receiver');

    const updatedNodes = topology.nodes.map((n) => {
      if (n.type === 'sender') {
        const idx = senders.indexOf(n);
        return { ...n, x: 80, y: 100 + idx * 140 };
      }
      if (n.type === 'router' || n.type === 'switch') {
        const idx = routers.indexOf(n);
        return { ...n, x: 340 + (idx % 2) * 160, y: 100 + Math.floor(idx / 2) * 160 };
      }
      if (n.type === 'receiver') {
        const idx = receivers.indexOf(n);
        return { ...n, x: 680, y: 100 + idx * 140 };
      }
      return n;
    });

    handleTopologyChange({ ...topology, nodes: updatedNodes });
    showToast('Auto-layout applied', 'info');
  };

  const handleExportJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(topology, null, 2));
    const link = document.createElement('a');
    link.setAttribute('href', dataStr);
    link.setAttribute('download', `topology_${Date.now()}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportJSON = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e: any) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target?.result as string);
          if (parsed.nodes && parsed.links) {
            handleTopologyChange(parsed);
            showToast('Imported topology successfully', 'success');
          }
        } catch (err) {
          showToast('Invalid JSON topology file', 'warn');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  // Node and Link updates with live API sync
  const handleUpdateNode = async (updated: NodeConfig) => {
    const nodes = topology.nodes.map((n) => (n.id === updated.id ? updated : n));
    setTopology({ ...topology, nodes });
    if (simId) {
      try {
        await updateNode(simId, updated.id, updated);
      } catch (err) {
        console.error('Failed to sync node update:', err);
      }
    }
  };

  const handleUpdateLink = async (updated: LinkConfig) => {
    const links = topology.links.map((l) => (l.id === updated.id ? updated : l));
    setTopology({ ...topology, links });
    if (simId) {
      try {
        await updateLink(simId, updated.id, updated);
      } catch (err) {
        console.error('Failed to sync link update:', err);
      }
    }
  };

  // Cutting a cable reliably
  const handleCutConnection = async (linkId: string) => {
    const linkExists = topology.links.some((l) => l.id === linkId);
    if (!linkExists) return;

    commitTopology({
      ...topology,
      links: topology.links.filter((l) => l.id !== linkId),
    });

    if (simId) {
      try {
        await cutLink(simId, linkId);
      } catch (err) {
        console.error('Failed to cut link on backend:', err);
      }
    }

    if (selectedElement?.id === linkId) {
      setSelectedElement(null);
    }
    showToast(`Cut cable: ${linkId} removed and routes recalculated`, 'warn');
  };

  // Duplicate Node
  const handleDuplicateNode = (nodeId: string) => {
    const target = topology.nodes.find((n) => n.id === nodeId);
    if (!target) return;
    const newId = `${target.type}_${Date.now().toString().slice(-4)}`;
    const clonedNode: NodeConfig = {
      ...target,
      id: newId,
      label: `${target.label} (Copy)`,
      x: target.x + 40,
      y: target.y + 40,
    };
    handleTopologyChange({
      ...topology,
      nodes: [...topology.nodes, clonedNode],
    });
    setSelectedElement({ type: 'node', id: newId });
    showToast(`Duplicated ${target.label}`, 'success');
  };

  // Disconnect all links of a node
  const handleDisconnectNode = (nodeId: string) => {
    const affected = topology.links.filter((l) => l.source === nodeId || l.target === nodeId);
    if (affected.length === 0) return;
    const remaining = topology.links.filter((l) => l.source !== nodeId && l.target !== nodeId);
    handleTopologyChange({
      ...topology,
      links: remaining,
    });
    showToast(`Disconnected ${affected.length} connection(s)`, 'warn');
  };

  // Delete Element
  const handleDeleteElement = (el: { type: 'node' | 'edge'; id: string }) => {
    if (el.type === 'node') {
      const nodes = topology.nodes.filter((n) => n.id !== el.id);
      const links = topology.links.filter((l) => l.source !== el.id && l.target !== el.id);
      handleTopologyChange({ nodes, links });
      showToast(`Deleted node ${el.id}`, 'info');
    } else {
      handleCutConnection(el.id);
    }
    setSelectedElement(null);
  };

  // Live cwnd override
  const handleOverrideCwnd = async (flowId: string, newCwnd: number) => {
    if (!simId) return;
    try {
      await overrideCwnd(simId, flowId, newCwnd);
      showToast(`Overrode cwnd to ${newCwnd} MSS for ${flowId}`, 'success');
    } catch (err) {
      console.error(err);
    }
  };

  // Context Menu Action Dispatcher
  const handleContextMenuAction = (action: string, target: ContextMenuTarget) => {
    if (action === 'edit_properties') {
      setSelectedElement({ type: target.type, id: target.id });
      setRightPanelOpen(true);
      setRightPanelTab('properties');
      setPropertiesTargetTab('general');
    } else if (action === 'edit_protocol') {
      setSelectedElement({ type: 'node', id: target.id });
      setRightPanelOpen(true);
      setRightPanelTab('properties');
      setPropertiesTargetTab('protocol');
    } else if (action === 'edit_rate') {
      setSelectedElement({ type: 'node', id: target.id });
      setRightPanelOpen(true);
      setRightPanelTab('properties');
      setPropertiesTargetTab('rate');
    } else if (action === 'edit_cwnd') {
      setSelectedElement({ type: 'node', id: target.id });
      setRightPanelOpen(true);
      setRightPanelTab('properties');
      setPropertiesTargetTab('live');
    } else if (action === 'edit_rwnd') {
      setSelectedElement({ type: 'node', id: target.id });
      setRightPanelOpen(true);
      setRightPanelTab('properties');
      setPropertiesTargetTab('rate');
    } else if (action === 'edit_queue') {
      setSelectedElement({ type: 'node', id: target.id });
      setRightPanelOpen(true);
      setRightPanelTab('properties');
      setPropertiesTargetTab('queue');
    } else if (action === 'edit_detection') {
      setSelectedElement({ type: 'node', id: target.id });
      setRightPanelOpen(true);
      setRightPanelTab('properties');
      setPropertiesTargetTab('queue');
    } else if (action === 'edit_bandwidth' || action === 'edit_delay' || action === 'edit_loss') {
      setSelectedElement({ type: 'edge', id: target.id });
      setRightPanelOpen(true);
      setRightPanelTab('properties');
      setPropertiesTargetTab('routing');
    } else if (action === 'cut_connection') {
      handleCutConnection(target.id);
    } else if (action === 'duplicate_node') {
      handleDuplicateNode(target.id);
    } else if (action === 'disconnect_node') {
      handleDisconnectNode(target.id);
    } else if (action === 'delete_node') {
      handleDeleteElement({ type: 'node', id: target.id });
    } else if (action === 'explain') {
      const key = target.type === 'node' ? target.nodeData?.type || 'node' : 'link';
      onOpenHelpDesk(key);
    }
  };

  // Splitter Mouse Drag Handler
  useEffect(() => {
    if (!isDraggingSplitter) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newHeight = window.innerHeight - e.clientY - 56; // 56px top header
      setGraphHeight(Math.max(160, Math.min(620, newHeight)));
    };

    const handleMouseUp = () => {
      setIsDraggingSplitter(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingSplitter]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept when user is typing in form controls
      const active = document.activeElement;
      if (
        active &&
        (active.tagName === 'INPUT' ||
          active.tagName === 'TEXTAREA' ||
          active.tagName === 'SELECT' ||
          (active as HTMLElement).isContentEditable)
      ) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        setIsRunning((prev) => !prev);
      } else if (e.code === 'KeyS' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        handleStepEvent();
      } else if (e.code === 'KeyR' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        handleReset();
      } else if (e.code === 'KeyG' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setGraphLayoutMode((prev) =>
          prev === 'compact' ? 'expanded' : prev === 'expanded' ? 'maximized' : 'compact'
        );
      } else if (e.code === 'KeyZ' && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if (
        (e.code === 'KeyY' && (e.ctrlKey || e.metaKey)) ||
        (e.code === 'KeyZ' && (e.ctrlKey || e.metaKey) && e.shiftKey)
      ) {
        e.preventDefault();
        handleRedo();
      } else if (e.code === 'Delete' || e.code === 'Backspace') {
        if (selectedElement) {
          e.preventDefault();
          handleDeleteElement(selectedElement);
        }
      } else if (e.code === 'Escape') {
        setSelectedElement(null);
        setContextMenu(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedElement, handleUndo, handleRedo, handleStepEvent, handleReset]);

  // Height computation based on layout mode
  const computedGraphHeight =
    graphLayoutMode === 'maximized'
      ? 'calc(100vh - 7rem)'
      : graphLayoutMode === 'expanded'
      ? '400px'
      : `${graphHeight}px`;

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] overflow-hidden bg-slate-950 relative select-none">
      {/* Simulation Playback Toolbar */}
      <SimulationToolbar
        isRunning={isRunning}
        onRunToggle={() => setIsRunning(!isRunning)}
        onStepEvent={handleStepEvent}
        onStepRTT={handleStepRTT}
        onReset={handleReset}
        simTime={simTime}
        eventsCount={eventsCount}
        speed={speed}
        onSpeedChange={setSpeed}
        autoReroute={autoReroute}
        onAutoRerouteToggle={() => setAutoReroute(!autoReroute)}
        guidedMode={guidedMode}
        onGuidedModeToggle={() => setGuidedMode(!guidedMode)}
        onOpenHelpDesk={() => onOpenHelpDesk()}
      />

      {/* Floating Toast Notification */}
      {toast && (
        <div
          className={`absolute top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl shadow-2xl backdrop-blur-md border text-xs font-medium flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-200 ${
            toast.type === 'success'
              ? 'bg-emerald-950/90 text-emerald-300 border-emerald-500/40'
              : toast.type === 'warn'
              ? 'bg-amber-950/90 text-amber-300 border-amber-500/40'
              : 'bg-slate-900/90 text-blue-300 border-blue-500/40'
          }`}
        >
          {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
          {toast.type === 'warn' && <AlertTriangle className="w-4 h-4 text-amber-400" />}
          {toast.type === 'info' && <Info className="w-4 h-4 text-blue-400" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Main Workspace (3 Panels) */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* LEFT PANEL: Node Palette & Scenarios */}
        {leftPanelOpen && (
          <div className="w-64 border-r border-slate-800 bg-slate-900/95 flex flex-col p-3 overflow-y-auto space-y-4 z-10 backdrop-blur-md">
            {/* Undo / Redo quick bar */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Topology History
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={handleUndo}
                  disabled={undoStack.length === 0}
                  className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                  title="Undo (Ctrl+Z)"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={handleRedo}
                  disabled={redoStack.length === 0}
                  className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                  title="Redo (Ctrl+Y)"
                >
                  <Redo2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <NodePalette
              onAddNode={handleAddNode}
              onClear={handleClear}
              onAutoLayout={handleAutoLayout}
              onExportJSON={handleExportJSON}
              onImportJSON={handleImportJSON}
            />

            {/* Quick Scenario Picker */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 shadow-md space-y-2">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                <span>Quick Scenarios</span>
                <BookOpen className="w-3.5 h-3.5 text-blue-400" />
              </div>
              <div className="space-y-1.5">
                {[
                  { id: 'scenario_1_flow_vs_congestion', label: '1. Flow vs Congestion' },
                  { id: 'scenario_2_infinite_buffer', label: '2. Infinite Buffer Ideal' },
                  { id: 'scenario_3_finite_buffer', label: '3. Finite Buffer Drops' },
                  { id: 'scenario_4_multi_hop', label: '4. Multi-Hop Congestion' },
                  { id: 'scenario_5_tahoe_vs_reno', label: '5. Tahoe vs Reno' },
                  { id: 'scenario_6_reno_vs_cubic', label: '6. Reno vs CUBIC' },
                  { id: 'scenario_7_rerouting_demo', label: '7. Congestion Rerouting' },
                ].map((s) => (
                  <button
                    key={s.id}
                    onClick={() => initFromScenario(s.id)}
                    className="w-full text-left px-2 py-1.5 rounded-lg text-xs text-slate-300 hover:bg-slate-800 hover:text-blue-300 transition-colors flex items-center justify-between"
                  >
                    <span>{s.label}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
                  </button>
                ))}
              </div>
            </div>

            {/* Guided Mode Info Box */}
            {guidedMode && (
              <div className="p-3 rounded-xl bg-blue-950/40 border border-blue-800/40 text-xs text-blue-200 space-y-1.5">
                <div className="font-semibold text-blue-300 flex items-center gap-1">
                  <span>Guided Mode Active</span>
                </div>
                <p className="text-[11px] leading-relaxed text-blue-300/80">
                  Right-click any node or link to edit properties or cut connections. Press <strong>Run</strong> (or Space) to start.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Left Panel Toggle Button */}
        <button
          onClick={() => setLeftPanelOpen(!leftPanelOpen)}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-20 p-1 rounded-r-lg bg-slate-800 border-y border-r border-slate-700 text-slate-400 hover:text-slate-200"
          title={leftPanelOpen ? 'Collapse component palette' : 'Expand component palette'}
        >
          {leftPanelOpen ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </button>

        {/* CENTER PANEL: Topology Canvas + Analytics Workspace */}
        <div className="flex-1 flex flex-col min-w-0 relative">
          {/* Top Half: ReactFlow Canvas */}
          <div className="flex-1 relative min-h-[180px]">
            <TopologyCanvas
              topology={topology}
              onTopologyChange={handleTopologyChange}
              selectedElement={selectedElement}
              onSelectElement={setSelectedElement}
              latestSnapshot={latestSnapshot}
              onContextMenu={(e, target) => {
                setContextMenu({ x: e.clientX, y: e.clientY, target });
              }}
              onOpenQueueSettings={(nodeId) => {
                setSelectedElement({ type: 'node', id: nodeId });
                setRightPanelOpen(true);
                setRightPanelTab('properties');
                setPropertiesTargetTab('queue');
              }}
              onOpenRateSettings={(nodeId) => {
                setSelectedElement({ type: 'node', id: nodeId });
                setRightPanelOpen(true);
                setRightPanelTab('properties');
                setPropertiesTargetTab('rate');
              }}
            />
          </div>

          {/* Draggable Splitter Handle */}
          {graphLayoutMode !== 'maximized' && (
            <div
              onMouseDown={() => setIsDraggingSplitter(true)}
              className="h-2 bg-slate-950 hover:bg-blue-600/50 cursor-row-resize flex items-center justify-center transition-colors border-t border-b border-slate-800 group"
              title="Drag to resize Graph Workspace height"
            >
              <GripHorizontal className="w-4 h-3 text-slate-600 group-hover:text-blue-300 transition-colors" />
            </div>
          )}

          {/* Bottom Half: Analytics Workspace */}
          <div
            style={{ height: computedGraphHeight }}
            className={`border-t border-slate-800 bg-slate-900 transition-[height] duration-150 ${
              graphLayoutMode === 'maximized' ? 'absolute inset-0 z-30' : ''
            }`}
          >
            <AnalyticsWorkspace
              snapshots={snapshots}
              events={events}
              rerouteHistory={rerouteHistory}
              onSelectEvent={(evt) => onOpenHelpDesk(evt.category?.toLowerCase())}
              onExplain={(k) => onOpenHelpDesk(k)}
              layoutMode={graphLayoutMode}
              onLayoutModeChange={setGraphLayoutMode}
            />
          </div>
        </div>

        {/* Right Panel Toggle Button */}
        <button
          onClick={() => setRightPanelOpen(!rightPanelOpen)}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-20 p-1 rounded-l-lg bg-slate-800 border-y border-l border-slate-700 text-slate-400 hover:text-slate-200"
          title={rightPanelOpen ? 'Collapse inspector panel' : 'Expand inspector panel'}
        >
          {rightPanelOpen ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>

        {/* RIGHT PANEL: Properties, Protocol State Machine, Rerouting Dashboard */}
        {rightPanelOpen && (
          <div className="w-84 border-l border-slate-800 bg-slate-900/95 flex flex-col overflow-y-auto z-10 backdrop-blur-md">
            {/* Panel Tabs */}
            <div className="flex border-b border-slate-800 p-2 bg-slate-950/70 gap-1">
              <button
                onClick={() => setRightPanelTab('properties')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  rightPanelTab === 'properties'
                    ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Properties</span>
              </button>

              <button
                onClick={() => setRightPanelTab('protocols')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  rightPanelTab === 'protocols'
                    ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                <span>Protocols</span>
              </button>

              <button
                onClick={() => setRightPanelTab('rerouting')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  rightPanelTab === 'rerouting'
                    ? 'bg-purple-600/20 text-purple-400 border border-purple-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <Route className="w-3.5 h-3.5" />
                <span>Rerouting</span>
              </button>
            </div>

            {/* Panel Content */}
            <div className="p-3 flex-1 overflow-y-auto">
              {rightPanelTab === 'properties' && (
                <PropertiesPanel
                  selectedElement={selectedElement}
                  topology={topology}
                  onUpdateNode={handleUpdateNode}
                  onUpdateLink={handleUpdateLink}
                  onDeleteElement={handleDeleteElement}
                  onCutLink={handleCutConnection}
                  onOverrideCwnd={handleOverrideCwnd}
                  onExplain={(k) => onOpenHelpDesk(k)}
                  targetTab={propertiesTargetTab}
                  latestSnapshot={latestSnapshot}
                />
              )}

              {rightPanelTab === 'protocols' && (
                <ProtocolStatePanel
                  protocols={protocols}
                  onExplain={(k) => onOpenHelpDesk(k)}
                />
              )}

              {rightPanelTab === 'rerouting' && (
                <ReroutingDashboard
                  flowPaths={flowPaths}
                  rerouteHistory={rerouteHistory}
                  congestionScores={congestionScores}
                  topology={topology}
                  autoReroute={autoReroute}
                  onAutoRerouteToggle={async () => {
                    const nextMode = !autoReroute;
                    setAutoReroute(nextMode);
                    if (simId) {
                      try {
                        await setSDNMode(simId, nextMode ? 'adaptive' : 'static');
                        showToast(`SDN Controller mode: ${nextMode ? 'Adaptive (SDN)' : 'Static'}`, 'info');
                      } catch (err) {
                        console.error('Failed to set SDN mode:', err);
                      }
                    }
                  }}
                  onManualReroute={async (flowId, newPath) => {
                    if (!simId) return;
                    try {
                      await rerouteTraffic(simId, flowId, newPath, 'Manual User Reroute');
                      showToast(`Rerouted ${flowId} path`, 'info');
                    } catch (err) {
                      console.error(err);
                    }
                  }}
                  sdnState={latestSnapshot?.sdn}
                  onInjectCongestion={async () => {
                    if (!simId) return;
                    try {
                      const res = await injectControlledCongestion(simId, 25.0, 1.5);
                      showToast(res.message || 'Controlled congestion burst injected!', 'warn');
                    } catch (err) {
                      console.error('Failed to inject congestion:', err);
                      showToast('Failed to inject congestion burst', 'warn');
                    }
                  }}
                  onUpdateThresholds={async (thresh) => {
                    if (!simId) return;
                    try {
                      await setSDNThresholds(simId, thresh);
                      showToast('Updated SDN congestion thresholds', 'success');
                    } catch (err) {
                      console.error('Failed to update thresholds:', err);
                      showToast('Failed to update thresholds', 'warn');
                    }
                  }}
                />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Render Context Menu if active */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          target={contextMenu.target}
          onClose={() => setContextMenu(null)}
          onSelectAction={handleContextMenuAction}
        />
      )}
    </div>
  );
};
