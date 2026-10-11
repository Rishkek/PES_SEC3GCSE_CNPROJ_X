import React, { memo } from 'react';
import { EdgeProps, getBezierPath, EdgeLabelRenderer } from 'reactflow';
import { LinkConfig, LinkSnapshot } from '../../types';

interface CustomEdgeData extends LinkConfig {
  linkStats?: LinkSnapshot;
  isReroutedActive?: boolean;
}

export const CustomEdge = memo(({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: EdgeProps<CustomEdgeData>) => {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const congestionScore = data?.linkStats?.congestion_score || 0;
  const isCongested = congestionScore > 0.5;
  const isBottleneck = data?.is_bottleneck;
  const bwMbps = (data?.bandwidth_bps || 10_000_000) / 1_000_000;
  const delayMs = (data?.propagation_delay_s || 0.02) * 1000;

  const strokeColor = isCongested
    ? '#f97316' // orange
    : isBottleneck
    ? '#eab308' // amber
    : selected
    ? '#60a5fa' // blue
    : '#475569'; // slate-600

  return (
    <>
      {/* Background glow when congested or selected */}
      {(isCongested || selected) && (
        <path
          d={edgePath}
          fill="none"
          stroke={isCongested ? 'rgba(249, 115, 22, 0.4)' : 'rgba(96, 165, 250, 0.3)'}
          strokeWidth={8}
          className="blur-[2px]"
        />
      )}

      {/* Main link path */}
      <path
        id={id}
        d={edgePath}
        fill="none"
        stroke={strokeColor}
        strokeWidth={isCongested ? 3.5 : 2.5}
        className={data?.is_active ? 'animate-packet-flow' : 'opacity-40'}
      />

      {/* Edge label pill */}
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
          }}
          className={`px-2 py-0.5 rounded-md text-[10px] font-mono shadow-md border backdrop-blur-sm transition-all ${
            isCongested
              ? 'bg-slate-900/90 border-orange-500/80 text-orange-400 font-bold'
              : isBottleneck
              ? 'bg-slate-900/90 border-amber-500/60 text-amber-300'
              : 'bg-slate-900/80 border-slate-700 text-slate-300'
          }`}
        >
          <div className="flex items-center gap-1.5">
            <span>{bwMbps}M</span>
            <span className="text-slate-500">|</span>
            <span>{delayMs.toFixed(0)}ms</span>
            {isBottleneck && (
              <span className="text-[9px] px-1 rounded bg-amber-900/60 text-amber-300 uppercase">
                BN
              </span>
            )}
            {isCongested && (
              <span className="text-[9px] px-1 rounded bg-orange-900/60 text-orange-300 animate-pulse uppercase">
                Congested
              </span>
            )}
          </div>
        </div>
      </EdgeLabelRenderer>
    </>
  );
});
CustomEdge.displayName = 'CustomEdge';
