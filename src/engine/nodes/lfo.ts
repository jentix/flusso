import { registerNode } from '../graph/registry';

interface LfoState {
  phase: number;
  lastRetrigger: number;
}

const WAVES: Record<string, (t: number) => number> = {
  sine: (t) => Math.sin(t * Math.PI * 2),
  square: (t) => (t < 0.5 ? 1 : -1),
  saw: (t) => t * 2 - 1,
  triangle: (t) => 1 - 4 * Math.abs(t - 0.5),
};

/**
 * Free-running low-frequency oscillator. Phase is dt-integrated so
 * changing freq mid-run never jumps the output.
 */
registerNode<LfoState>({
  type: 'lfo',
  label: 'LFO',
  category: 'input',
  inputs: [{ id: 'retrigger', type: 'number', label: 'Retrigger', defaultValue: 0 }],
  outputs: [{ id: 'value', type: 'number', label: 'Value' }],
  params: [
    { id: 'shape', kind: 'select', label: 'Shape', default: 'sine', options: ['sine', 'square', 'saw', 'triangle'] },
    { id: 'freq', kind: 'number', label: 'Freq (Hz)', default: 1, min: 0.01, max: 20, step: 0.01 },
    { id: 'phase', kind: 'number', label: 'Phase', default: 0, min: 0, max: 1, step: 0.01 },
    { id: 'amplitude', kind: 'number', label: 'Amplitude', default: 1, min: 0, max: 10, step: 0.05 },
    { id: 'offset', kind: 'number', label: 'Offset', default: 0, min: -10, max: 10, step: 0.05 },
    { id: 'bipolar', kind: 'boolean', label: 'Bipolar', default: false },
  ],
  hot: true,
  init() {
    return { phase: 0, lastRetrigger: 0 };
  },
  compute({ state, inputs, outputs, params, ctx }) {
    const retrigger = (inputs.retrigger as number) ?? 0;
    if (retrigger > 0.5 && state.lastRetrigger <= 0.5) state.phase = 0;
    state.lastRetrigger = retrigger;

    state.phase += (params.freq as number) * ctx.frame.dt;
    state.phase -= Math.floor(state.phase);

    const t = state.phase + (params.phase as number);
    const wave = (WAVES[params.shape as string] ?? WAVES.sine)(t - Math.floor(t));
    const base = (params.bipolar as boolean) ? wave : (wave + 1) / 2;
    outputs.value = (params.offset as number) + (params.amplitude as number) * base;
  },
});
