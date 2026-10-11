import React from 'react';
import { HardDrive, Monitor, Server, Cpu, RefreshCw, Trash2, Download, Upload } from 'lucide-react';
import { NodeType } from '../../types';

interface NodePaletteProps {
  onAddNode: (type: NodeType) => void;
  onClear: () => void;
  onAutoLayout: () => void;
  onExportJSON: () => void;
  onImportJSON: () => void;
}

export const NodePalette: React.FC<NodePaletteProps> = ({
  onAddNode,
  onClear,
  onAutoLayout,
  onExportJSON,
  onImportJSON,
}) => {
  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 shadow-xl backdrop-blur-md flex flex-col gap-3">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        Component Palette
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => onAddNode('sender')}
          className="flex items-center gap-2 p-2 rounded-lg bg-slate-800/80 hover:bg-blue-600/20 hover:border-blue-500/50 border border-slate-700/60 text-slate-200 text-xs transition-all text-left"
          title="Add TCP Sender node"
        >
          <div className="p-1 rounded bg-blue-500/20 text-blue-400">
            <HardDrive className="w-4 h-4" />
          </div>
          <div>
            <div className="font-medium">TCP Sender</div>
            <div className="text-[10px] text-slate-400">Host source</div>
          </div>
        </button>

        <button
          onClick={() => onAddNode('receiver')}
          className="flex items-center gap-2 p-2 rounded-lg bg-slate-800/80 hover:bg-emerald-600/20 hover:border-emerald-500/50 border border-slate-700/60 text-slate-200 text-xs transition-all text-left"
          title="Add TCP Receiver node"
        >
          <div className="p-1 rounded bg-emerald-500/20 text-emerald-400">
            <Monitor className="w-4 h-4" />
          </div>
          <div>
            <div className="font-medium">Receiver</div>
            <div className="text-[10px] text-slate-400">TCP sink</div>
          </div>
        </button>

        <button
          onClick={() => onAddNode('router')}
          className="flex items-center gap-2 p-2 rounded-lg bg-slate-800/80 hover:bg-purple-600/20 hover:border-purple-500/50 border border-slate-700/60 text-slate-200 text-xs transition-all text-left"
          title="Add Router node"
        >
          <div className="p-1 rounded bg-purple-500/20 text-purple-400">
            <Server className="w-4 h-4" />
          </div>
          <div>
            <div className="font-medium">Router</div>
            <div className="text-[10px] text-slate-400">Queue buffer</div>
          </div>
        </button>

        <button
          onClick={() => onAddNode('switch')}
          className="flex items-center gap-2 p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 hover:border-slate-500 border border-slate-700/60 text-slate-200 text-xs transition-all text-left"
          title="Add Forwarding Switch"
        >
          <div className="p-1 rounded bg-slate-700/60 text-slate-300">
            <Cpu className="w-4 h-4" />
          </div>
          <div>
            <div className="font-medium">Switch</div>
            <div className="text-[10px] text-slate-400">Forwarder</div>
          </div>
        </button>
      </div>

      <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
        <button
          onClick={onAutoLayout}
          className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
          title="Auto-arrange topology nodes"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Layout</span>
        </button>

        <button
          onClick={onExportJSON}
          className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
          title="Export topology as JSON"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export</span>
        </button>

        <button
          onClick={onImportJSON}
          className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
          title="Import topology from JSON"
        >
          <Upload className="w-3.5 h-3.5" />
          <span>Import</span>
        </button>

        <button
          onClick={onClear}
          className="flex items-center gap-1 px-2 py-1 rounded bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/50 transition-colors"
          title="Clear canvas"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Clear</span>
        </button>
      </div>
    </div>
  );
};
