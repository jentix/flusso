import { nanoid } from 'nanoid';
import type { Connection, NodeInstance } from './types';
import { canConnect } from './portTypes';
import { defaultParams, getNodeDef } from './registry';

export type GraphListener = () => void;
export type ParamListener = (nodeId: string, paramId: string) => void;
export type NodeRemovedListener = (node: NodeInstance) => void;

/**
 * Single source of truth for graph topology and params.
 * Framework-free; the editor mirrors this, never the other way around.
 */
export class Graph {
  readonly nodes = new Map<string, NodeInstance>();
  connections: Connection[] = [];

  private changeListeners = new Set<GraphListener>();
  private paramListeners = new Set<ParamListener>();
  private removeListeners = new Set<NodeRemovedListener>();

  onChange(fn: GraphListener): () => void {
    this.changeListeners.add(fn);
    return () => this.changeListeners.delete(fn);
  }

  onParamChange(fn: ParamListener): () => void {
    this.paramListeners.add(fn);
    return () => this.paramListeners.delete(fn);
  }

  onNodeRemoved(fn: NodeRemovedListener): () => void {
    this.removeListeners.add(fn);
    return () => this.removeListeners.delete(fn);
  }

  private emitChange(): void {
    for (const fn of this.changeListeners) fn();
  }

  addNode(type: string, position = { x: 0, y: 0 }, id?: string): NodeInstance {
    const def = getNodeDef(type);
    const node: NodeInstance = {
      id: id ?? nanoid(8),
      type,
      params: defaultParams(def),
      position,
    };
    this.nodes.set(node.id, node);
    this.emitChange();
    return node;
  }

  removeNode(nodeId: string): void {
    const node = this.nodes.get(nodeId);
    if (!node) return;
    this.connections = this.connections.filter(
      (c) => c.from.nodeId !== nodeId && c.to.nodeId !== nodeId,
    );
    this.nodes.delete(nodeId);
    for (const fn of this.removeListeners) fn(node);
    this.emitChange();
  }

  setPosition(nodeId: string, position: { x: number; y: number }): void {
    const node = this.nodes.get(nodeId);
    if (node) node.position = position; // editor-only data; no change event needed
  }

  setParam(nodeId: string, paramId: string, value: unknown): void {
    const node = this.nodes.get(nodeId);
    if (!node) return;
    node.params[paramId] = value;
    for (const fn of this.paramListeners) fn(nodeId, paramId);
  }

  canConnect(from: { nodeId: string; portId: string }, to: { nodeId: string; portId: string }): boolean {
    const fromNode = this.nodes.get(from.nodeId);
    const toNode = this.nodes.get(to.nodeId);
    if (!fromNode || !toNode || from.nodeId === to.nodeId) return false;
    const fromPort = getNodeDef(fromNode.type).outputs.find((p) => p.id === from.portId);
    const toPort = getNodeDef(toNode.type).inputs.find((p) => p.id === to.portId);
    if (!fromPort || !toPort) return false;
    if (!canConnect(fromPort.type, toPort.type)) return false;
    return !this.wouldCycle(from.nodeId, to.nodeId);
  }

  connect(from: { nodeId: string; portId: string }, to: { nodeId: string; portId: string }, id?: string): Connection | null {
    if (!this.canConnect(from, to)) return null;
    // one connection per input: replace existing
    this.connections = this.connections.filter(
      (c) => !(c.to.nodeId === to.nodeId && c.to.portId === to.portId),
    );
    const conn: Connection = { id: id ?? nanoid(8), from, to };
    this.connections.push(conn);
    this.emitChange();
    return conn;
  }

  disconnect(connectionId: string): void {
    const before = this.connections.length;
    this.connections = this.connections.filter((c) => c.id !== connectionId);
    if (this.connections.length !== before) this.emitChange();
  }

  inputConnection(nodeId: string, portId: string): Connection | undefined {
    return this.connections.find((c) => c.to.nodeId === nodeId && c.to.portId === portId);
  }

  /** Would adding fromId→toId create a cycle? (Is fromId reachable from toId?) */
  private wouldCycle(fromId: string, toId: string): boolean {
    const stack = [toId];
    const seen = new Set<string>();
    while (stack.length) {
      const id = stack.pop()!;
      if (id === fromId) return true;
      if (seen.has(id)) continue;
      seen.add(id);
      for (const c of this.connections) if (c.from.nodeId === id) stack.push(c.to.nodeId);
    }
    return false;
  }

  clear(): void {
    for (const node of this.nodes.values()) {
      for (const fn of this.removeListeners) fn(node);
    }
    this.nodes.clear();
    this.connections = [];
    this.emitChange();
  }
}
