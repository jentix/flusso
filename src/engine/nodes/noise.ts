import { registerNode } from '../graph/registry';
import type { Spectrum } from '../graph/types';

interface NoiseState {
  bins: Float32Array;
  out: Spectrum;
}

/** Integer lattice hash → [0,1). Deterministic per (i, seed). */
function hash(i: number, seed: number): number {
  let h = (i | 0) * 374761393 + (seed | 0) * 668265263;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** 1D value noise with smoothstep interpolation, output [0,1). */
function noise1d(x: number, seed: number): number {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return hash(i, seed) + (hash(i + 1, seed) - hash(i, seed)) * u;
}

/** fBm: `octaves` layers of value noise, normalized back to [0,1). */
function fbm(x: number, seed: number, octaves: number): number {
  let sum = 0;
  let amp = 1;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += noise1d(x * (1 << o), seed + o * 101) * amp;
    norm += amp;
    amp *= 0.5;
  }
  return sum / norm;
}

/**
 * Smooth random modulation. `value` is a single stream for number inputs;
 * `spectrum` is N independent streams — a drop-in audio replacement for
 * anything that consumes a spectrum (no mic needed).
 */
registerNode<NoiseState>({
  type: 'noise',
  label: 'Noise',
  category: 'input',
  inputs: [],
  outputs: [
    { id: 'value', type: 'number', label: 'Value' },
    { id: 'spectrum', type: 'spectrum', label: 'Spectrum' },
  ],
  params: [
    { id: 'speed', kind: 'number', label: 'Speed', default: 1, min: 0, max: 10, step: 0.05 },
    { id: 'seed', kind: 'number', label: 'Seed', default: 0, min: 0, max: 999, step: 1 },
    { id: 'octaves', kind: 'number', label: 'Octaves', default: 2, min: 1, max: 4, step: 1 },
    { id: 'amplitude', kind: 'number', label: 'Amplitude', default: 1, min: 0, max: 10, step: 0.05 },
    { id: 'offset', kind: 'number', label: 'Offset', default: 0, min: -10, max: 10, step: 0.05 },
    { id: 'bins', kind: 'number', label: 'Bins', default: 16, min: 2, max: 64, step: 1 },
  ],
  hot: true,
  init() {
    const bins = new Float32Array(16);
    return { bins, out: { bins, binCount: 16 } };
  },
  compute({ state, outputs, params, ctx }) {
    const binCount = Math.max(2, Math.floor(params.bins as number));
    if (state.bins.length !== binCount) state.bins = new Float32Array(binCount);

    const seed = Math.floor(params.seed as number);
    const octaves = Math.max(1, Math.floor(params.octaves as number));
    const t = ctx.frame.time * (params.speed as number);

    // channel c is decorrelated by a large irrational-ish offset
    for (let c = 0; c < binCount; c++) {
      state.bins[c] = fbm(t + c * 137.31 + seed * 1024, seed, octaves);
    }
    state.out.bins = state.bins;
    state.out.binCount = binCount;

    outputs.value = (params.offset as number) + (params.amplitude as number) * state.bins[0];
    outputs.spectrum = state.out;
  },
});
