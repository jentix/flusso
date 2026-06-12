import { create } from 'zustand';
import type { Edge, Node } from '@xyflow/react';
import type { Engine } from '../engine/engine';

export interface FlowNodeData extends Record<string, unknown> {
  nodeType: string;
  /** Bumped to force FlowNode re-render after engine param changes. */
  paramsVersion: number;
}

interface EditorState {
  nodes: Node<FlowNodeData>[];
  edges: Edge[];
  /** Viewport-only presentation mode; Esc exits. */
  fullscreen: boolean;
  setFullscreen(on: boolean): void;
  sync(engine: Engine): void;
}

/**
 * Thin adapter: mirrors the engine Graph (single source of truth) into
 * React Flow nodes/edges. One-directional — RF events call engine mutators,
 * the engine onChange triggers sync(). Params stay in the engine; FlowNode
 * reads them directly and paramsVersion just invalidates the memo.
 */
export const useEditorStore = create<EditorState>((set, get) => ({
  nodes: [],
  edges: [],
  fullscreen: false,
  setFullscreen(on) {
    set({ fullscreen: on });
  },
  sync(engine: Engine) {
    const prev = new Map(get().nodes.map((n) => [n.id, n]));
    const nodes: Node<FlowNodeData>[] = [...engine.graph.nodes.values()].map((n) => {
      const existing = prev.get(n.id);
      return {
        id: n.id,
        type: 'flussoNode',
        position: n.position,
        selected: existing?.selected,
        data: {
          nodeType: n.type,
          paramsVersion: (existing?.data.paramsVersion ?? 0) + 1,
        },
      };
    });
    const edges: Edge[] = engine.graph.connections.map((c) => ({
      id: c.id,
      source: c.from.nodeId,
      sourceHandle: c.from.portId,
      target: c.to.nodeId,
      targetHandle: c.to.portId,
    }));
    set({ nodes, edges });
  },
}));
