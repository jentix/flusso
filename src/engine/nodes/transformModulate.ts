import { registerNode } from '../graph/registry';
import type { PathData, Spectrum, TransformsData } from '../graph/types';

interface ModulateState {
  out: TransformsData;
}

/**
 * Maps spectrum bands onto path points → per-instance transforms.
 * Hot but cheap: writes into reused flat arrays.
 */
registerNode<ModulateState>({
  type: 'transformModulate',
  label: 'Transform Modulate',
  category: 'math',
  inputs: [
    { id: 'points', type: 'path', label: 'Points' },
    { id: 'spectrum', type: 'spectrum', label: 'Spectrum' },
    // optional number overrides — undefined when unconnected, falls back to param
    { id: 'amount', type: 'number', label: 'Amount' },
    { id: 'baseScale', type: 'number', label: 'Base' },
  ],
  outputs: [{ id: 'transforms', type: 'transforms', label: 'Transforms' }],
  params: [
    {
      id: 'mode',
      kind: 'select',
      label: 'Mode',
      default: 'scaleUniform',
      options: ['scaleUniform', 'scaleY', 'translateNormal'],
    },
    { id: 'amount', kind: 'number', label: 'Amount', default: 1.5, min: 0, max: 10, step: 0.05 },
    { id: 'baseScale', kind: 'number', label: 'Base scale', default: 0.5, min: 0.01, max: 5, step: 0.01 },
  ],
  hot: true,
  init() {
    return { out: { positions: new Float32Array(0), scales: new Float32Array(0), count: 0 } };
  },
  compute({ state, inputs, outputs, params }) {
    const points = inputs.points as PathData | undefined;
    const spectrum = inputs.spectrum as Spectrum | undefined;
    const count = points?.count ?? 0;
    if (state.out.count !== count) {
      state.out.positions = new Float32Array(count * 3);
      state.out.scales = new Float32Array(count * 3);
      state.out.count = count;
    }
    if (!points || count === 0) {
      outputs.transforms = state.out;
      return;
    }

    const mode = params.mode as string;
    const amount = (inputs.amount as number) ?? (params.amount as number);
    const base = (inputs.baseScale as number) ?? (params.baseScale as number);
    const bins = spectrum?.bins;
    const binCount = spectrum?.binCount ?? 0;

    for (let i = 0; i < count; i++) {
      const level = bins && binCount > 0 ? bins[Math.floor((i / count) * binCount)] : 0;
      let px = points.points[i * 3];
      let py = points.points[i * 3 + 1];
      let pz = points.points[i * 3 + 2];
      let sx = base, sy = base, sz = base;

      if (mode === 'scaleUniform') {
        const s = base * (1 + level * amount);
        sx = sy = sz = s;
      } else if (mode === 'scaleY') {
        sy = base * (1 + level * amount);
      } else if (mode === 'translateNormal') {
        // 2D normal of tangent = (-ty, tx)
        const tx = points.tangents[i * 3];
        const ty = points.tangents[i * 3 + 1];
        px += -ty * level * amount;
        py += tx * level * amount;
      }

      state.out.positions[i * 3] = px;
      state.out.positions[i * 3 + 1] = py;
      state.out.positions[i * 3 + 2] = pz;
      state.out.scales[i * 3] = sx;
      state.out.scales[i * 3 + 1] = sy;
      state.out.scales[i * 3 + 2] = sz;
    }
    outputs.transforms = state.out;
  },
});
