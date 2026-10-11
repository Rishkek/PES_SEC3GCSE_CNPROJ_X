import React, { useCallback, useMemo } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  Connection,
  addEdge,
  useNodesState,
  useEdgesState,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { CustomNode } from './CustomNode';
import { CustomEdge } from './CustomEdge';
import { NodeConfig, LinkConfig, TopologyData, SimulationSnapshot } from '../../types';
import { ContextMenuTarget } from './ContextMenu';

interface TopologyCanvasProps {
  topology: TopologyData;
  onTopologyChange: (topology: TopologyData) => void;
  selectedElement: { type: 'node' | 'edge'; id: string } | null;
  onSelectElement: (element: { type: 'node' | 'edge'; id: string } | null) => void;
  latestSnapshot: SimulationSnapshot | null;
  onContextMenu?: (event: React.MouseEvent, target: ContextMenuTarget) => void;
  onOpenQueueSettings?: (nodeId: string) => void;
  onOpenRateSettings?: (nodeId: string) => void;
}

const nodeTypes = { custom: CustomNode };
const edgeTypes = { custom: CustomEdge };

export const TopologyCanvas: React.FC<TopologyCanvasProps> = ({
  topology,
  onTopologyChange,
  selectedElement,
  onSelectElement,
  latestSnapshot,
  onContextMenu,
  onOpenQueueSettings,
  onOpenRateSettings,
}) => {
  // Map topology nodes into ReactFlow Nodes
  const initialNodes: Node[] = useMemo(() => {
    return topology.nodes.map((n) => {
      const flowKey = `flow_${n.id}`;
      return {
        id: n.id,
        type: 'custom',
        position: { x: n.x, y: n.y },
        data: {
          ...n,
          routerStats: latestSnapshot?.routers?.[n.id],
          flowStats: latestSnapshot?.flows?.[flowKey],
          onOpenQueueSettings,
          onOpenRateSettings,
        },
      };
    });
  }, [topology.nodes, latestSnapshot, onOpenQueueSettings, onOpenRateSettings]);

  // Map topology links into ReactFlow Edges
  const initialEdges: Edge[] = useMemo(() => {
    return topology.links.map((l) => ({
      id: l.id,
      source: l.source,
      target: l.target,
      type: 'custom',
      markerEnd: { type: MarkerType.ArrowClosed, color: '#64748b', width: 12, height: 12 },
      data: {
        ...l,
        linkStats: latestSnapshot?.links?.[l.id],
      },
    }));
  }, [topology.links, latestSnapshot]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Sync state when props change
  React.useEffect(() => {
    setNodes(initialNodes);
  }, [initialNodes, setNodes]);

  React.useEffect(() => {
    setEdges(initialEdges);
  }, [initialEdges, setEdges]);

  // Handle node drag stop -> update positions in topology
  const onNodeDragStop = useCallback(
    (_: any, node: Node) => {
      const updatedNodes = topology.nodes.map((n) =>
        n.id === node.id ? { ...n, x: node.position.x, y: node.position.y } : n
      );
      onTopologyChange({ ...topology, nodes: updatedNodes });
    },
    [topology, onTopologyChange]
  );

  // Handle new edge connection with validation
  const onConnect = useCallback(
    (params: Connection) => {
      if (!params.source || !params.target) return;
      if (params.source === params.target) {
        console.warn('Cannot connect a node to itself.');
        return;
      }

      // Check if duplicate edge already exists
      const exists = topology.links.some(
        (l) => l.source === params.source && l.target === params.target
      );
      if (exists) {
        console.warn('Connection already exists in this direction.');
        return;
      }

      const newLinkId = `L_${params.source}_${params.target}`;
      const newLink: LinkConfig = {
        id: newLinkId,
        source: params.source,
        target: params.target,
        bandwidth_bps: 10_000_000.0,
        propagation_delay_s: 0.02,
        loss_rate: 0.0,
        is_active: true,
        is_bottleneck: false,
        cost: 1.0,
      };

      onTopologyChange({
        ...topology,
        links: [...topology.links, newLink],
      });
    },
    [topology, onTopologyChange]
  );

  return (
    <div className="w-full h-full relative bg-slate-950">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={onNodeDragStop}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeClick={(_, node) => onSelectElement({ type: 'node', id: node.id })}
        onEdgeClick={(_, edge) => onSelectElement({ type: 'edge', id: edge.id })}
        onPaneClick={() => onSelectElement(null)}
        onNodeContextMenu={(event, node) => {
          event.preventDefault();
          onSelectElement({ type: 'node', id: node.id });
          onContextMenu?.(event, {
            type: 'node',
            id: node.id,
            nodeData: topology.nodes.find((n) => n.id === node.id),
          });
        }}
        onEdgeContextMenu={(event, edge) => {
          event.preventDefault();
          onSelectElement({ type: 'edge', id: edge.id });
          onContextMenu?.(event, {
            type: 'edge',
            id: edge.id,
            linkData: topology.links.find((l) => l.id === edge.id),
          });
        }}
        fitView
        minZoom={0.2}
        maxZoom={2.0}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#1e293b" gap={20} size={1} />
        <Controls className="!bg-slate-900 !border-slate-800 !text-slate-300 fill-slate-300" />
        <MiniMap
          nodeColor={(node) => {
            if (node.data.type === 'sender') return '#3b82f6';
            if (node.data.type === 'receiver') return '#10b981';
            if (node.data.type === 'router') return '#a855f7';
            return '#64748b';
          }}
          maskColor="rgba(15, 23, 42, 0.7)"
          className="!bg-slate-900 !border-slate-800 rounded-lg overflow-hidden"
        />
      </ReactFlow>
    </div>
  );
};
