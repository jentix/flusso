import type { Graph } from './graph';

export interface PatchJSON {
  version: 1;
  nodes: Array<{
    id: string;
    type: string;
    params: Record<string, unknown>;
    position: { x: number; y: number };
  }>;
  connections: Array<{
    id: string;
    from: { nodeId: string; portId: string };
    to: { nodeId: string; portId: string };
  }>;
}

export function serializeGraph(graph: Graph): PatchJSON {
  return {
    version: 1,
    nodes: [...graph.nodes.values()].map((n) => ({
      id: n.id,
      type: n.type,
      // File objects are not serializable — persist only serializable params.
      params: Object.fromEntries(
        Object.entries(n.params).filter(([, v]) => !(typeof File !== 'undefined' && v instanceof File)),
      ),
      position: n.position,
    })),
    connections: graph.connections.map((c) => ({ id: c.id, from: c.from, to: c.to })),
  };
}

export function loadGraph(graph: Graph, patch: PatchJSON): void {
  if (patch.version !== 1) throw new Error(`Unsupported patch version: ${patch.version}`);
  graph.clear();
  for (const n of patch.nodes) {
    const node = graph.addNode(n.type, n.position, n.id);
    Object.assign(node.params, n.params);
  }
  for (const c of patch.connections) {
    graph.connect(c.from, c.to, c.id);
  }
}
