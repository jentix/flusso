import { registerNode } from '../graph/registry';
import type { AudioEngine } from '../audio/audioEngine';
import type { Spectrum } from '../graph/types';

interface SpectrumState {
  raw: Float32Array;
  bands: Float32Array;
  smoothed: Float32Array;
  out: Spectrum;
}

/**
 * Downsamples raw FFT bins into N bands (log-spaced option so bass
 * doesn't dominate) with per-band attack/release smoothing.
 * All buffers reused — zero per-frame allocation.
 */
registerNode<SpectrumState>({
  type: 'spectrum',
  label: 'Spectrum',
  category: 'audio',
  inputs: [{ id: 'audio', type: 'audio', label: 'Audio' }],
  outputs: [{ id: 'spectrum', type: 'spectrum', label: 'Spectrum' }],
  params: [
    { id: 'bands', kind: 'number', label: 'Bands', default: 16, min: 2, max: 64, step: 1 },
    { id: 'gain', kind: 'number', label: 'Gain', default: 1, min: 0, max: 5, step: 0.05 },
    { id: 'attack', kind: 'number', label: 'Attack', default: 0.6, min: 0, max: 1, step: 0.01 },
    { id: 'release', kind: 'number', label: 'Release', default: 0.12, min: 0, max: 1, step: 0.01 },
    { id: 'logScale', kind: 'boolean', label: 'Log scale', default: true },
  ],
  hot: true,
  init() {
    const bands = new Float32Array(16);
    return {
      raw: new Float32Array(1024),
      bands,
      smoothed: new Float32Array(16),
      out: { bins: bands, binCount: 16 },
    };
  },
  compute({ state, inputs, outputs, params }) {
    const audio = inputs.audio as AudioEngine | undefined;
    const bandCount = Math.max(2, Math.floor(params.bands as number));
    if (state.bands.length !== bandCount) {
      state.bands = new Float32Array(bandCount);
      state.smoothed = new Float32Array(bandCount);
    }

    if (audio) audio.getSpectrum(state.raw);
    else state.raw.fill(0);

    const gain = params.gain as number;
    const logScale = params.logScale as boolean;
    const n = state.raw.length;
    // ignore top quarter of bins — usually near-silent, wastes bands
    const usable = Math.floor(n * 0.75);
    for (let b = 0; b < bandCount; b++) {
      let lo: number, hi: number;
      if (logScale) {
        lo = Math.floor(Math.pow(usable, b / bandCount));
        hi = Math.max(lo + 1, Math.floor(Math.pow(usable, (b + 1) / bandCount)));
      } else {
        lo = Math.floor((b / bandCount) * usable);
        hi = Math.max(lo + 1, Math.floor(((b + 1) / bandCount) * usable));
      }
      let sum = 0;
      for (let i = lo; i < hi && i < n; i++) sum += state.raw[i];
      state.bands[b] = Math.min(1, (sum / (hi - lo)) * gain);
    }

    const attack = params.attack as number;
    const release = params.release as number;
    for (let b = 0; b < bandCount; b++) {
      const target = state.bands[b];
      const cur = state.smoothed[b];
      const k = target > cur ? attack : release;
      state.smoothed[b] = cur + (target - cur) * k;
    }

    state.out.bins = state.smoothed;
    state.out.binCount = bandCount;
    outputs.spectrum = state.out;
  },
});
