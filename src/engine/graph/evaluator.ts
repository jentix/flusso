import type { Graph } from './graph';
import type { FrameInfo, NodeInstance } from './types';
import { getNodeDef, type EvalContext, type NodeDef } from './registry';

interface NodeRuntime {
  initialized: boolean;
  dirty: boolean;
  /** Bumped each time this node recomputes. */
  version: number;
  /** Versions of upstream outputs seen at last compute, keyed by input portId. */
  seenVersions: Record<string, number>;
  outputs: Record<string, unknown>;
  inputsScratch: Record<string, unknown>;
}

/**
 * Pull-based lazy evaluator with version/dirty caching.
 * Cold nodes compute once and serve cached outputs; hot nodes recompute
 * every frame, and version propagation makes only their downstream chain re-run.
 */
export class Evaluator {
  private runtimes = new Map<string, NodeRuntime>();
  private order: NodeInstance[] = [];
  private orderStale = true;

  constructor(
    private graph: Graph,
    private ctx: EvalContext,
  ) {
    graph.onChange(() => {
      this.orderStale = true;
    });
    graph.onParamChange((nodeId) => this.invalidateNode(nodeId));
    graph.onNodeRemoved((node) => this.disposeNode(node));
    ctx.invalidate = (nodeId) => this.invalidateNode(nodeId);
  }

  invalidateNode(nodeId: string): void {
    const rt = this.runtimes.get(nodeId);
    if (rt) rt.dirty = true;
  }

  /** Read a node's last computed output (for previews/debug). */
  peekOutput(nodeId: string, portId: string): unknown {
    return this.runtimes.get(nodeId)?.outputs[portId];
  }

  evalFrame(frame: FrameInfo): void {
    this.ctx.frame = frame;
    if (this.orderStale) this.rebuildOrder();
    for (const node of this.order) this.evalNode(node);
  }

  private rebuildOrder(): void {
    // Kahn topological sort over all nodes (graph is acyclic by construction).
    const inDegree = new Map<string, number>();
    for (const id of this.graph.nodes.keys()) inDegree.set(id, 0);
    for (const c of this.graph.connections) {
      inDegree.set(c.to.nodeId, (inDegree.get(c.to.nodeId) ?? 0) + 1);
    }
    const queue: string[] = [];
    for (const [id, deg] of inDegree) if (deg === 0) queue.push(id);
    const order: NodeInstance[] = [];
    while (queue.length) {
      const id = queue.shift()!;
      const node = this.graph.nodes.get(id);
      if (node) order.push(node);
      for (const c of this.graph.connections) {
        if (c.from.nodeId !== id) continue;
        const d = (inDegree.get(c.to.nodeId) ?? 0) - 1;
        inDegree.set(c.to.nodeId, d);
        if (d === 0) queue.push(c.to.nodeId);
      }
    }
    this.order = order;
    this.orderStale = false;
    // New topology can change which inputs feed a node — force re-check of seen versions.
    for (const rt of this.runtimes.values()) rt.dirty = true;
  }

  private runtime(node: NodeInstance): NodeRuntime {
    let rt = this.runtimes.get(node.id);
    if (!rt) {
      rt = {
        initialized: false,
        dirty: true,
        version: 0,
        seenVersions: {},
        outputs: {},
        inputsScratch: {},
      };
      this.runtimes.set(node.id, rt);
    }
    return rt;
  }

  private evalNode(node: NodeInstance): void {
    const def = getNodeDef(node.type);
    const rt = this.runtime(node);

    if (!rt.initialized) {
      node.state = def.init ? def.init(node, this.ctx) : undefined;
      rt.initialized = true;
      rt.dirty = true;
    }

    // Gather inputs and detect upstream changes via version numbers.
    let upstreamChanged = false;
    const inputs = rt.inputsScratch;
    for (const port of def.inputs) {
      const conn = this.graph.inputConnection(node.id, port.id);
      if (conn) {
        const upRt = this.runtimes.get(conn.from.nodeId);
        inputs[port.id] = upRt?.outputs[conn.from.portId];
        const upVersion = upRt?.version ?? -1;
        const key = `${port.id}:${conn.from.nodeId}:${conn.from.portId}`;
        if (rt.seenVersions[key] !== upVersion) {
          rt.seenVersions[key] = upVersion;
          upstreamChanged = true;
        }
      } else {
        inputs[port.id] = port.defaultValue;
      }
    }

    if (!rt.dirty && !upstreamChanged && !def.hot) return;

    def.compute({
      node,
      state: node.state,
      inputs,
      outputs: rt.outputs,
      params: node.params,
      ctx: this.ctx,
    });
    rt.version++;
    rt.dirty = false;
  }

  private disposeNode(node: NodeInstance): void {
    const rt = this.runtimes.get(node.id);
    if (rt?.initialized) {
      const def = getNodeDef(node.type) as NodeDef<unknown>;
      def.dispose?.(node.state, this.ctx);
    }
    this.runtimes.delete(node.id);
  }

  disposeAll(): void {
    for (const node of this.graph.nodes.values()) this.disposeNode(node);
  }
}
