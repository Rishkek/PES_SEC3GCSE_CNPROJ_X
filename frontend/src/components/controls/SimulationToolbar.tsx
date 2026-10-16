import React from 'react';
import { Play, Pause, StepForward, RotateCcw, FastForward, Clock, Activity, Shuffle, HelpCircle } from 'lucide-react';

interface SimulationToolbarProps {
  isRunning: boolean;
  onRunToggle: () => void;
  onStepEvent: () => void;
  onStepRTT: () => void;
  onReset: () => void;
  simTime: number;
  eventsCount: number;
  speed: number;
  onSpeedChange: (speed: number) => void;
  autoReroute: boolean;
  onAutoRerouteToggle: () => void;
  guidedMode: boolean;
  onGuidedModeToggle: () => void;
  onOpenHelpDesk: () => void;
}

export const SimulationToolbar: React.FC<SimulationToolbarProps> = ({
  isRunning,
  onRunToggle,
  onStepEvent,
  onStepRTT,
  onReset,
  simTime,
  eventsCount,
  speed,
  onSpeedChange,
  autoReroute,
  onAutoRerouteToggle,
  guidedMode,
  onGuidedModeToggle,
  onOpenHelpDesk,
}) => {
  return (
    <div className="h-14 bg-slate-900 border-b border-slate-800 px-4 flex items-center justify-between gap-4 select-none">
      {/* Playback action buttons */}
      <div className="flex items-center gap-2">
        <button
          onClick={onRunToggle}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium text-xs transition-all shadow-sm ${
            isRunning
              ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-900/40'
              : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/40'
          }`}
          title={isRunning ? 'Pause simulation' : 'Run simulation'}
        >
          {isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-white" />}
          <span>{isRunning ? 'Pause' : 'Run'}</span>
        </button>

        <button
          onClick={onStepEvent}
          disabled={isRunning}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 text-xs transition-colors"
          title="Step forward 1 discrete event"
        >
          <StepForward className="w-3.5 h-3.5" />
          <span>Step</span>
        </button>

        <button
          onClick={onStepRTT}
          disabled={isRunning}
          className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 text-xs transition-colors"
          title="Step forward ~1 RTT period (~80ms)"
        >
          <FastForward className="w-3.5 h-3.5" />
          <span>Step RTT</span>
        </button>

        <button
          onClick={onReset}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/40 hover:text-rose-300 text-slate-300 text-xs transition-colors"
          title="Reset simulation to time 0"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset</span>
        </button>

        <div className="h-5 w-px bg-slate-800 mx-1" />

        {/* Speed selector */}
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <span>Speed:</span>
          <select
            value={speed}
            onChange={(e) => onSpeedChange(parseFloat(e.target.value))}
            className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-200 font-mono text-xs focus:outline-none focus:border-blue-500"
          >
            <option value="0.25">0.25x</option>
            <option value="0.5">0.5x</option>
            <option value="1.0">1.0x</option>
            <option value="2.0">2.0x</option>
            <option value="5.0">5.0x</option>
          </select>
        </div>
      </div>

      {/* Center status display: Simulation Time and Event count */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-slate-950 border border-slate-800 font-mono text-xs">
          <Clock className="w-3.5 h-3.5 text-blue-400" />
          <span className="text-slate-400">Sim Time:</span>
          <span className="text-blue-300 font-bold">{simTime.toFixed(3)}s</span>
        </div>

        <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-slate-950 border border-slate-800 font-mono text-xs">
          <Activity className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-slate-400">Events:</span>
          <span className="text-emerald-300 font-semibold">{eventsCount}</span>
        </div>
      </div>

      {/* Right controls: Auto-Reroute, Guided mode, Help Desk */}
      <div className="flex items-center gap-3">
        <button
          onClick={onAutoRerouteToggle}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
            autoReroute
              ? 'bg-purple-900/30 border-purple-500 text-purple-300'
              : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200'
          }`}
          title="Switch SDN Controller between Adaptive Dynamic Rerouting and Static Routing"
        >
          <Shuffle className="w-3.5 h-3.5" />
          <span>SDN Reroute: {autoReroute ? 'Adaptive' : 'Static'}</span>
        </button>

        <button
          onClick={onGuidedModeToggle}
          className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
            guidedMode
              ? 'bg-blue-900/30 border-blue-500 text-blue-300'
              : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200'
          }`}
          title="Toggle Guided Onboarding Annotations"
        >
          {guidedMode ? 'Guided Mode' : 'Expert Mode'}
        </button>

        <button
          onClick={onOpenHelpDesk}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs transition-colors"
          title="Open Integrated Help Desk"
        >
          <HelpCircle className="w-4 h-4 text-blue-400" />
          <span>Help Desk</span>
        </button>
      </div>
    </div>
  );
};
