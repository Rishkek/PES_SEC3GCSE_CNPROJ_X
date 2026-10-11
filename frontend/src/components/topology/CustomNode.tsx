import React, { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Server, Monitor, HardDrive, Cpu, AlertTriangle } from 'lucide-react';
import { NodeConfig, RouterSnapshot, FlowSnapshot } from '../../types';

interface CustomNodeData extends NodeConfig {
  routerStats?: RouterSnapshot;
  flowStats?: FlowSnapshot;
  isSelected?: boolean;
  onOpenQueueSettings?: (nodeId: string) => void;
  onOpenRateSettings?: (nodeId: string) => void;
}

export const CustomNode = memo(({ data, selected }: NodeProps<CustomNodeData>) => {
  const isRouter = data.type === 'router';
  const isSender = data.type === 'sender';
  const isReceiver = data.type === 'receiver';

  const queuePkts = data.routerStats?.queue_occupancy_pkts ?? 0;
  const capacity = data.buffer_capacity;
  const queuePct = capacity > 0 ? (queuePkts / capacity) * 100 : (data.routerStats?.utilization_pct || 0);
  const isBufferFull = capacity > 0 && queuePkts >= capacity;
  const isCongested = queuePct > 75 || isBufferFull;

  // 4 queue status colors
  const getQueueColorClass = () => {
    if (isBufferFull) return 'bg-rose-600 animate-pulse';
    if (queuePct > 75) return 'bg-orange-500';
    if (queuePct >= 50) return 'bg-amber-400';
    return 'bg-emerald-500';
  };

  const getQueueStatusLabel = () => {
    if (capacity === -1) return 'Infinite';
    if (isBufferFull) return 'Buffer Full!';
    if (queuePct > 75) return 'Congested';
    if (queuePct >= 50) return 'Heavy';
    return 'Normal';
  };

  return (
    <div
      className={`relative px-4 py-3 rounded-xl border transition-all duration-200 min-w-[160px] shadow-lg backdrop-blur-md cursor-pointer ${
        selected
          ? 'border-blue-400 ring-2 ring-blue-500/40 bg-slate-900/95'
          : isBufferFull
          ? 'border-rose-500/90 bg-slate-900/95 ring-2 ring-rose-500/40'
          : isCongested
          ? 'border-orange-500/80 bg-slate-900/90 ring-1 ring-orange-500/30'
          : 'border-slate-700/80 bg-slate-900/80 hover:border-slate-500'
      }`}
    >
      {/* Target handle (left) */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-blue-400 !border-2 !border-slate-900 hover:scale-125 transition-transform"
      />

      <div className="flex items-center space-x-2.5">
        <div
          className={`p-2 rounded-lg flex items-center justify-center ${
            isSender
              ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
              : isReceiver
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : isRouter
              ? isBufferFull
                ? 'bg-rose-500/30 text-rose-400 border border-rose-500/50 animate-bounce'
                : isCongested
                ? 'bg-orange-500/20 text-orange-400 border border-orange-500/40 animate-pulse'
                : 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
              : 'bg-slate-700/40 text-slate-300'
          }`}
        >
          {isSender && <HardDrive className="w-5 h-5" />}
          {isReceiver && <Monitor className="w-5 h-5" />}
          {isRouter && <Server className="w-5 h-5" />}
          {data.type === 'switch' && <Cpu className="w-5 h-5" />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-xs text-slate-200 truncate">{data.label}</span>
            {isBufferFull ? (
              <span className="text-[9px] px-1 py-0.2 rounded bg-rose-900/80 text-rose-300 font-bold border border-rose-500/50 animate-pulse">
                FULL
              </span>
            ) : isCongested ? (
              <AlertTriangle className="w-3.5 h-3.5 text-orange-400 animate-bounce ml-1 flex-shrink-0" />
            ) : null}
          </div>
          <div className="text-[10px] text-slate-400 capitalize flex items-center gap-1">
            <span>{data.type}</span>
            {isSender && (
              <span className="px-1 py-0.2 rounded bg-blue-900/60 text-blue-300 font-mono text-[9px] uppercase font-bold">
                {data.protocol}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Router live queue occupancy with 4 status colors & click-to-edit */}
      {isRouter && (
        <div
          className="mt-2.5 pt-2 border-t border-slate-800 hover:bg-slate-800/40 rounded p-1 -mx-1 transition-colors group"
          onClick={(e) => {
            e.stopPropagation();
            data.onOpenQueueSettings?.(data.id);
          }}
          title="Click to edit router buffer capacity & thresholds"
        >
          <div className="flex justify-between items-center text-[10px] font-mono text-slate-400 mb-1">
            <span className="flex items-center gap-1 group-hover:text-blue-300 transition-colors">
              <span>Queue:</span>
              <span className={`text-[9px] px-1 rounded font-bold ${
                isBufferFull ? 'bg-rose-950 text-rose-400' :
                queuePct > 75 ? 'bg-orange-950 text-orange-400' :
                queuePct >= 50 ? 'bg-amber-950 text-amber-400' :
                'bg-emerald-950 text-emerald-400'
              }`}>
                {getQueueStatusLabel()}
              </span>
            </span>
            <span className={isBufferFull ? 'text-rose-400 font-bold' : isCongested ? 'text-orange-400 font-bold' : 'text-slate-300'}>
              {queuePkts}/{capacity === -1 ? '∞' : capacity} pkts
            </span>
          </div>
          {capacity !== -1 && (
            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-700/50">
              <div
                className={`h-full transition-all duration-200 ${getQueueColorClass()}`}
                style={{ width: `${Math.min(100, Math.max(0, queuePct))}%` }}
              />
            </div>
          )}
        </div>
      )}

      {/* Sender live cwnd status */}
      {isSender && data.flowStats && (
        <div
          className="mt-2.5 pt-2 border-t border-slate-800 flex justify-between items-center text-[10px] font-mono hover:bg-slate-800/30 rounded p-1 -mx-1 transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            data.onOpenRateSettings?.(data.id);
          }}
          title="Click to view rate and congestion window settings"
        >
          <span className="text-slate-400">cwnd:</span>
          <span className="text-blue-400 font-semibold">{data.flowStats.cwnd.toFixed(1)} MSS</span>
          <span className="text-slate-500">ssth:</span>
          <span className="text-amber-400">{data.flowStats.ssthresh.toFixed(0)}</span>
        </div>
      )}

      {/* Sender rate if configured */}
      {isSender && (data.app_rate_bps > 0) && (
        <div className="text-[9px] font-mono text-emerald-400/90 flex justify-between px-1">
          <span>Rate:</span>
          <span>
            {data.app_rate_bps >= 1_000_000
              ? `${(data.app_rate_bps / 1_000_000).toFixed(1)} Mbps`
              : `${(data.app_rate_bps / 1_000).toFixed(0)} kbps`}
          </span>
        </div>
      )}

      {/* Receiver stats */}
      {isReceiver && (
        <div className="mt-2.5 pt-2 border-t border-slate-800 flex justify-between items-center text-[10px] font-mono">
          <span className="text-slate-400">rwnd:</span>
          <span className="text-emerald-400 font-semibold">{data.rwnd || data.receiver_rwnd || 64} MSS</span>
        </div>
      )}

      {/* Source handle (right) */}
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-blue-400 !border-2 !border-slate-900 hover:scale-125 transition-transform"
      />
    </div>
  );
});
CustomNode.displayName = 'CustomNode';
