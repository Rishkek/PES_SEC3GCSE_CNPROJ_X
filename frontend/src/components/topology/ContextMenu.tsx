import React, { useEffect, useRef } from 'react';
import {
  Sliders,
  Activity,
  Trash2,
  Scissors,
  Copy,
  Unlink,
  HelpCircle,
  Gauge,
  Maximize2,
  Zap,
  ArrowRightLeft,
  Server,
  Layers,
  HardDrive,
  Monitor,
} from 'lucide-react';
import { NodeConfig, LinkConfig } from '../../types';

export interface ContextMenuTarget {
  type: 'node' | 'edge';
  id: string;
  nodeData?: NodeConfig;
  linkData?: LinkConfig;
}

interface ContextMenuProps {
  x: number;
  y: number;
  target: ContextMenuTarget;
  onClose: () => void;
  onSelectAction: (action: string, target: ContextMenuTarget) => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  x,
  y,
  target,
  onClose,
  onSelectAction,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside or pressing Escape
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as HTMLElement)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  // Viewport clamping
  const menuWidth = 220;
  const menuHeight = 280;
  const clampedX = Math.max(10, Math.min(x, window.innerWidth - menuWidth - 10));
  const clampedY = Math.max(10, Math.min(y, window.innerHeight - menuHeight - 10));

  const isNode = target.type === 'node';
  const node = target.nodeData;
  const link = target.linkData;

  const handleAction = (action: string) => {
    onSelectAction(action, target);
    onClose();
  };

  return (
    <div
      ref={menuRef}
      style={{ left: `${clampedX}px`, top: `${clampedY}px` }}
      className="fixed z-50 w-56 bg-slate-900/95 backdrop-blur-md border border-slate-700/80 rounded-xl shadow-2xl py-1.5 text-xs text-slate-200 animate-in fade-in zoom-in-95 duration-100 select-none"
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      {/* Header */}
      <div className="px-3 py-1.5 border-b border-slate-800 text-[11px] font-semibold text-slate-400 flex items-center justify-between">
        <span className="truncate">
          {isNode ? (
            <span className="flex items-center gap-1.5">
              {node?.type === 'sender' && <HardDrive className="w-3.5 h-3.5 text-blue-400" />}
              {node?.type === 'receiver' && <Monitor className="w-3.5 h-3.5 text-emerald-400" />}
              {node?.type === 'router' && <Server className="w-3.5 h-3.5 text-purple-400" />}
              <span>{node?.label || target.id}</span>
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-slate-300">
              <ArrowRightLeft className="w-3.5 h-3.5 text-sky-400" />
              <span>Link {link?.source} → {link?.target}</span>
            </span>
          )}
        </span>
        <span className="text-[10px] uppercase font-mono px-1 rounded bg-slate-800 text-slate-400">
          {isNode ? node?.type : 'link'}
        </span>
      </div>

      <div className="py-1">
        {/* SENDER CONTEXT OPTIONS */}
        {isNode && node?.type === 'sender' && (
          <>
            <button
              onClick={() => handleAction('edit_properties')}
              className="w-full text-left px-3 py-1.5 hover:bg-blue-600/20 hover:text-blue-300 flex items-center gap-2.5 transition-colors"
            >
              <Sliders className="w-3.5 h-3.5 text-blue-400" />
              <span>Edit properties</span>
            </button>
            <button
              onClick={() => handleAction('edit_protocol')}
              className="w-full text-left px-3 py-1.5 hover:bg-blue-600/20 hover:text-blue-300 flex items-center gap-2.5 transition-colors"
            >
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              <span>Edit TCP protocol</span>
            </button>
            <button
              onClick={() => handleAction('edit_rate')}
              className="w-full text-left px-3 py-1.5 hover:bg-blue-600/20 hover:text-blue-300 flex items-center gap-2.5 transition-colors"
            >
              <Gauge className="w-3.5 h-3.5 text-emerald-400" />
              <span>Change sending rate</span>
            </button>
            <button
              onClick={() => handleAction('edit_cwnd')}
              className="w-full text-left px-3 py-1.5 hover:bg-blue-600/20 hover:text-blue-300 flex items-center gap-2.5 transition-colors"
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Change congestion window</span>
            </button>
            <div className="my-1 border-t border-slate-800/80" />
            <button
              onClick={() => handleAction('duplicate_node')}
              className="w-full text-left px-3 py-1.5 hover:bg-slate-800 flex items-center gap-2.5 transition-colors"
            >
              <Copy className="w-3.5 h-3.5 text-slate-400" />
              <span>Duplicate node</span>
            </button>
            <button
              onClick={() => handleAction('disconnect_node')}
              className="w-full text-left px-3 py-1.5 hover:bg-slate-800 text-amber-300 flex items-center gap-2.5 transition-colors"
            >
              <Unlink className="w-3.5 h-3.5 text-amber-400" />
              <span>Disconnect connections</span>
            </button>
          </>
        )}

        {/* RECEIVER CONTEXT OPTIONS */}
        {isNode && node?.type === 'receiver' && (
          <>
            <button
              onClick={() => handleAction('edit_properties')}
              className="w-full text-left px-3 py-1.5 hover:bg-emerald-600/20 hover:text-emerald-300 flex items-center gap-2.5 transition-colors"
            >
              <Sliders className="w-3.5 h-3.5 text-emerald-400" />
              <span>Edit properties</span>
            </button>
            <button
              onClick={() => handleAction('edit_rwnd')}
              className="w-full text-left px-3 py-1.5 hover:bg-emerald-600/20 hover:text-emerald-300 flex items-center gap-2.5 transition-colors"
            >
              <Maximize2 className="w-3.5 h-3.5 text-cyan-400" />
              <span>Edit receiver window (rwnd)</span>
            </button>
            <div className="my-1 border-t border-slate-800/80" />
            <button
              onClick={() => handleAction('duplicate_node')}
              className="w-full text-left px-3 py-1.5 hover:bg-slate-800 flex items-center gap-2.5 transition-colors"
            >
              <Copy className="w-3.5 h-3.5 text-slate-400" />
              <span>Duplicate node</span>
            </button>
            <button
              onClick={() => handleAction('disconnect_node')}
              className="w-full text-left px-3 py-1.5 hover:bg-slate-800 text-amber-300 flex items-center gap-2.5 transition-colors"
            >
              <Unlink className="w-3.5 h-3.5 text-amber-400" />
              <span>Disconnect connections</span>
            </button>
          </>
        )}

        {/* ROUTER CONTEXT OPTIONS */}
        {isNode && (node?.type === 'router' || node?.type === 'switch') && (
          <>
            <button
              onClick={() => handleAction('edit_properties')}
              className="w-full text-left px-3 py-1.5 hover:bg-purple-600/20 hover:text-purple-300 flex items-center gap-2.5 transition-colors"
            >
              <Sliders className="w-3.5 h-3.5 text-purple-400" />
              <span>Edit properties</span>
            </button>
            <button
              onClick={() => handleAction('edit_queue')}
              className="w-full text-left px-3 py-1.5 hover:bg-purple-600/20 hover:text-purple-300 flex items-center gap-2.5 transition-colors"
            >
              <Layers className="w-3.5 h-3.5 text-pink-400" />
              <span>Edit queue and buffer</span>
            </button>
            <button
              onClick={() => handleAction('edit_detection')}
              className="w-full text-left px-3 py-1.5 hover:bg-purple-600/20 hover:text-purple-300 flex items-center gap-2.5 transition-colors"
            >
              <Activity className="w-3.5 h-3.5 text-amber-400" />
              <span>Configure congestion detection</span>
            </button>
            <div className="my-1 border-t border-slate-800/80" />
            <button
              onClick={() => handleAction('duplicate_node')}
              className="w-full text-left px-3 py-1.5 hover:bg-slate-800 flex items-center gap-2.5 transition-colors"
            >
              <Copy className="w-3.5 h-3.5 text-slate-400" />
              <span>Duplicate node</span>
            </button>
            <button
              onClick={() => handleAction('disconnect_node')}
              className="w-full text-left px-3 py-1.5 hover:bg-slate-800 text-amber-300 flex items-center gap-2.5 transition-colors"
            >
              <Unlink className="w-3.5 h-3.5 text-amber-400" />
              <span>Disconnect connections</span>
            </button>
          </>
        )}

        {/* LINK / CABLE CONTEXT OPTIONS */}
        {!isNode && link && (
          <>
            <button
              onClick={() => handleAction('edit_properties')}
              className="w-full text-left px-3 py-1.5 hover:bg-sky-600/20 hover:text-sky-300 flex items-center gap-2.5 transition-colors"
            >
              <Sliders className="w-3.5 h-3.5 text-sky-400" />
              <span>Edit link properties</span>
            </button>
            <button
              onClick={() => handleAction('cut_connection')}
              className="w-full text-left px-3 py-1.5 hover:bg-rose-950/40 text-rose-300 flex items-center gap-2.5 transition-colors font-medium"
            >
              <Scissors className="w-3.5 h-3.5 text-rose-400" />
              <span>Cut connection</span>
            </button>
            <button
              onClick={() => handleAction('edit_bandwidth')}
              className="w-full text-left px-3 py-1.5 hover:bg-slate-800 flex items-center gap-2.5 transition-colors"
            >
              <Gauge className="w-3.5 h-3.5 text-blue-400" />
              <span>Change bandwidth</span>
            </button>
            <button
              onClick={() => handleAction('edit_delay')}
              className="w-full text-left px-3 py-1.5 hover:bg-slate-800 flex items-center gap-2.5 transition-colors"
            >
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              <span>Change propagation delay</span>
            </button>
            <button
              onClick={() => handleAction('edit_loss')}
              className="w-full text-left px-3 py-1.5 hover:bg-slate-800 flex items-center gap-2.5 transition-colors"
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Change loss probability</span>
            </button>
          </>
        )}

        {/* COMMON ACTIONS: Delete & Explain */}
        <div className="my-1 border-t border-slate-800/80" />
        <button
          onClick={() => handleAction('explain')}
          className="w-full text-left px-3 py-1.5 hover:bg-slate-800 text-slate-300 flex items-center gap-2.5 transition-colors"
        >
          <HelpCircle className="w-3.5 h-3.5 text-blue-400" />
          <span>Explain this component</span>
        </button>

        {isNode && (
          <button
            onClick={() => handleAction('delete_node')}
            className="w-full text-left px-3 py-1.5 hover:bg-rose-950/40 text-rose-400 flex items-center gap-2.5 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-500" />
            <span>Delete node</span>
          </button>
        )}
      </div>
    </div>
  );
};
