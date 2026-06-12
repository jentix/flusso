export type PortTypeId =
  | 'number'
  | 'vector3'
  | 'color'
  | 'string'
  | 'geometry'
  | 'texture'
  | 'audio'
  | 'spectrum'
  | 'path'
  | 'transforms'
  | 'sceneObject';

export interface PortDef {
  id: string;
  type: PortTypeId;
  label: string;
  defaultValue?: unknown;
}

export type ParamKind = 'number' | 'string' | 'select' | 'file' | 'boolean' | 'color';

export interface ParamDef {
  id: string;
  kind: ParamKind;
  label: string;
  default: unknown;
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
  accept?: string;
}

export interface NodeInstance {
  id: string;
  type: string;
  params: Record<string, unknown>;
  position: { x: number; y: number };
  /** Private runtime state created by NodeDef.init — never serialized. */
  state?: unknown;
}

export interface Connection {
  id: string;
  from: { nodeId: string; portId: string };
  to: { nodeId: string; portId: string };
}

export interface FrameInfo {
  time: number;
  dt: number;
  index: number;
}

/** Per-frame spectrum data. `bins` is a reused buffer — consume, never retain. */
export interface Spectrum {
  bins: Float32Array;
  binCount: number;
}

/** Sampled path: flat xyz arrays, reused-safe cold data. */
export interface PathData {
  points: Float32Array; // xyz triplets
  tangents: Float32Array; // xyz triplets
  count: number;
  length: number;
}

/** Per-instance transforms. Flat arrays, hot path reuses buffers. */
export interface TransformsData {
  positions: Float32Array; // xyz
  scales: Float32Array; // xyz
  count: number;
}
