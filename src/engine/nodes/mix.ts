import { registerNode } from '../graph/registry';
import type { Spectrum } from '../graph/types';

interface MixState {
  bins: Float32Array;
  out: Spectrum;
}

const BLEND: Record<string, (a: number, b: number, t: number) => number> = {
  mix: (a, b, t) => a + (b - a) * t,
  add: (a, b) => a + b,
  multiply: (a, b) => a * b,
  max: (a, b) => Math.max(a, b),
};

/**
 * Blends two numbers and/or two spectra with one operator, so noise and
 * audio can drive the same target together. Spectra with different bin
 * counts are index-resampled to the larger one; result stays in [0,1].
 * Cold — upstream version bumps (hot sources) trigger recompute.
 */
registerNode<MixState>({
  type: 'mix',
  label: 'Mix',
  category: 'math',
  inputs: [
    { id: 'a', type: 'number', label: 'A', defaultValue: 0 },
    { id: 'b', type: 'number', label: 'B', defaultValue: 0 },
    { id: 'specA', type: 'spectrum', label: 'Spectrum A' },
    { id: 'specB', type: 'spectrum', label: 'Spectrum B' },
    // optional override of the mix param — lets an LFO drive the crossfade
    { id: 'mix', type: 'number', label: 'Mix' },
  ],
  outputs: [
    { id: 'value', type: 'number', label: 'Value' },
    { id: 'spectrum', type: 'spectrum', label: 'Spectrum' },
  ],
  params: [
    { id: 'mode', kind: 'select', label: 'Mode', default: 'mix', options: ['mix', 'add', 'multiply', 'max'] },
    { id: 'mix', kind: 'number', label: 'Mix', default: 0.5, min: 0, max: 1, step: 0.01 },
  ],
  init() {
    const bins = new Float32Array(0);
    return { bins, out: { bins, binCount: 0 } };
  },
  compute({ state, inputs, outputs, params }) {
    const blend = BLEND[params.mode as string] ?? BLEND.mix;
    const t = (inputs.mix as number) ?? (params.mix as number);

    outputs.value = blend((inputs.a as number) ?? 0, (inputs.b as number) ?? 0, t);

    const sa = inputs.specA as Spectrum | undefined;
    const sb = inputs.specB as Spectrum | undefined;
    const n = Math.max(sa?.binCount ?? 0, sb?.binCount ?? 0);
    if (state.bins.length !== n) state.bins = new Float32Array(n);
    for (let c = 0; c < n; c++) {
      const va = sa && sa.binCount > 0 ? sa.bins[Math.floor((c / n) * sa.binCount)] : 0;
      const vb = sb && sb.binCount > 0 ? sb.bins[Math.floor((c / n) * sb.binCount)] : 0;
      state.bins[c] = Math.min(1, Math.max(0, blend(va, vb, t)));
    }
    state.out.bins = state.bins;
    state.out.binCount = n;
    outputs.spectrum = state.out;
  },
});
