import { memo, useEffect, useReducer } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import { getNodeDef } from '../../engine/graph/registry';
import { PORT_TYPE_COLORS } from '../../engine/graph/portTypes';
import { useEngine } from '../engineContext';
import { ParamControl } from '../controls/controls';
import type { FlowNodeData } from '../store';

/**
 * One generic node component for every node type — fully driven by NodeDef.
 * Params are read straight from the engine graph (source of truth);
 * data.paramsVersion only busts the memo when sync() runs.
 */
export const FlowNode = memo(function FlowNode({ id, data, selected }: NodeProps<Node<FlowNodeData>>) {
  const engine = useEngine();
  const def = getNodeDef(data.nodeType);
  const node = engine.graph.nodes.get(id);

  // Params live in the engine, not React state — re-render this node when they change.
  const [, forceUpdate] = useReducer((n: number) => n + 1, 0);
  useEffect(
    () =>
      engine.graph.onParamChange((nodeId) => {
        if (nodeId === id) forceUpdate();
      }),
    [engine, id],
  );

  if (!node) return null;

  return (
    <div className={`flow-node cat-${def.category}${selected ? ' selected' : ''}`}>
      <header>{def.label}</header>
      <div className="ports">
        <div className="inputs">
          {def.inputs.map((p) => (
            <div className="port" key={p.id}>
              <Handle
                type="target"
                id={p.id}
                position={Position.Left}
                style={{ background: PORT_TYPE_COLORS[p.type] }}
              />
              <span>{p.label}</span>
            </div>
          ))}
        </div>
        <div className="outputs">
          {def.outputs.map((p) => (
            <div className="port out" key={p.id}>
              <span>{p.label}</span>
              <Handle
                type="source"
                id={p.id}
                position={Position.Right}
                style={{ background: PORT_TYPE_COLORS[p.type] }}
              />
            </div>
          ))}
        </div>
      </div>
      {def.params.length > 0 && (
        <div className="params">
          {def.params.map((p) => (
            <ParamControl
              key={p.id}
              def={p}
              value={node.params[p.id]}
              onChange={(v) => engine.graph.setParam(id, p.id, v)}
              onFile={(file) => engine.setFile(id, p.id, file)}
            />
          ))}
        </div>
      )}
    </div>
  );
});
