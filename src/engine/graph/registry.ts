import type * as THREE from 'three';
import type { FrameInfo, NodeInstance, ParamDef, PortDef } from './types';
import type { AudioEngine } from '../audio/audioEngine';

export interface EvalContext {
  audio: AudioEngine;
  three: { scene: THREE.Scene; renderer: THREE.WebGLRenderer; camera: THREE.Camera } | null;
  frame: FrameInfo;
  /** Files picked by the user, keyed by `${nodeId}:${paramId}`. Not serialized. */
  files: Map<string, File>;
  /** Mark a node dirty from outside compute (e.g. async file load finished). */
  invalidate(nodeId: string): void;
}

export interface ComputeArgs<S = unknown> {
  node: NodeInstance;
  state: S;
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
  params: Record<string, unknown>;
  ctx: EvalContext;
}

export type NodeCategory = 'input' | 'audio' | 'geometry' | 'math' | 'output';

export interface NodeDef<S = unknown> {
  type: string;
  label: string;
  category: NodeCategory;
  inputs: PortDef[];
  outputs: PortDef[];
  params: ParamDef[];
  /** Hot nodes recompute every frame (time-varying sources). */
  hot?: boolean;
  init?(node: NodeInstance, ctx: EvalContext): S;
  compute(args: ComputeArgs<S>): void;
  dispose?(state: S, ctx: EvalContext): void;
}

export const registry = new Map<string, NodeDef<unknown>>();

export function registerNode<S>(def: NodeDef<S>): void {
  if (registry.has(def.type)) throw new Error(`Node type already registered: ${def.type}`);
  registry.set(def.type, def as NodeDef<unknown>);
}

export function getNodeDef(type: string): NodeDef<unknown> {
  const def = registry.get(type);
  if (!def) throw new Error(`Unknown node type: ${type}`);
  return def;
}

export function defaultParams(def: NodeDef<unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const p of def.params) out[p.id] = p.default;
  return out;
}
