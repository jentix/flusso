import { useCallback, useEffect, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  applyNodeChanges,
  type Connection as RFConnection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type IsValidConnection,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useEngine } from '../engineContext';
import { useEditorStore, type FlowNodeData } from '../store';
import { FlowNode } from './FlowNode';
import { Palette } from './Palette';

const nodeTypes = { flussoNode: FlowNode };

export function GraphEditor() {
  const engine = useEngine();
  const nodes = useEditorStore((s) => s.nodes);
  const edges = useEditorStore((s) => s.edges);
  const sync = useEditorStore((s) => s.sync);

  // Engine graph → React Flow, one direction.
  useEffect(() => {
    sync(engine);
    return engine.graph.onChange(() => sync(engine));
  }, [engine, sync]);

  const onNodesChange = useCallback(
    (changes: NodeChange<Node<FlowNodeData>>[]) => {
      // Position/selection changes are presentation-only: apply locally,
      // write positions through to the engine for persistence.
      for (const ch of changes) {
        if (ch.type === 'position' && ch.position) engine.graph.setPosition(ch.id, ch.position);
        if (ch.type === 'remove') engine.graph.removeNode(ch.id);
      }
      const remaining = changes.filter((c) => c.type !== 'remove');
      if (remaining.length) {
        useEditorStore.setState((s) => ({ nodes: applyNodeChanges(remaining, s.nodes) }));
      }
    },
    [engine],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange<Edge>[]) => {
      for (const ch of changes) {
        if (ch.type === 'remove') engine.graph.disconnect(ch.id);
      }
    },
    [engine],
  );

  const onConnect = useCallback(
    (conn: RFConnection) => {
      if (!conn.source || !conn.target || !conn.sourceHandle || !conn.targetHandle) return;
      engine.graph.connect(
        { nodeId: conn.source, portId: conn.sourceHandle },
        { nodeId: conn.target, portId: conn.targetHandle },
      );
    },
    [engine],
  );

  const isValidConnection: IsValidConnection = useCallback(
    (conn) => {
      if (!conn.source || !conn.target || !conn.sourceHandle || !conn.targetHandle) return false;
      return engine.graph.canConnect(
        { nodeId: conn.source, portId: conn.sourceHandle },
        { nodeId: conn.target, portId: conn.targetHandle },
      );
    },
    [engine],
  );

  const addNode = useCallback(
    (type: string) => {
      engine.graph.addNode(type, { x: 60 + Math.random() * 200, y: 60 + Math.random() * 200 });
    },
    [engine],
  );

  const defaultEdgeOptions = useMemo(() => ({ animated: false }), []);

  return (
    <div className="graph-editor">
      <Palette onAdd={addNode} />
      <ReactFlow
        style={{ width: '100%', height: '100%' }}
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        isValidConnection={isValidConnection}
        defaultEdgeOptions={defaultEdgeOptions}
        deleteKeyCode={['Backspace', 'Delete']}
        fitView
        colorMode="dark"
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={20} />
        <Controls />
      </ReactFlow>
    </div>
  );
}
