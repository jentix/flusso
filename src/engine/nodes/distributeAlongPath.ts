import { registerNode } from '../graph/registry';
import type { PathData } from '../graph/types';

interface DistributeState {
  out: PathData;
}

/** Subsample a path into N evenly spaced placement points. */
registerNode<DistributeState>({
  type: 'distributeAlongPath',
  label: 'Distribute Along Path',
  category: 'geometry',
  inputs: [{ id: 'path', type: 'path', label: 'Path' }],
  outputs: [{ id: 'points', type: 'path', label: 'Points' }],
  params: [
    { id: 'count', kind: 'number', label: 'Count', default: 24, min: 1, max: 512, step: 1 },
  ],
  init() {
    return { out: { points: new Float32Array(0), tangents: new Float32Array(0), count: 0, length: 0 } };
  },
  compute({ state, inputs, outputs, params }) {
    const path = inputs.path as PathData | undefined;
    const count = Math.max(1, Math.floor(params.count as number));
    if (!path || path.count === 0) {
      outputs.points = state.out;
      return;
    }
    if (state.out.count !== count) {
      state.out.points = new Float32Array(count * 3);
      state.out.tangents = new Float32Array(count * 3);
      state.out.count = count;
    }
    for (let i = 0; i < count; i++) {
      const src = Math.floor((i / count) * path.count);
      state.out.points[i * 3] = path.points[src * 3];
      state.out.points[i * 3 + 1] = path.points[src * 3 + 1];
      state.out.points[i * 3 + 2] = path.points[src * 3 + 2];
      state.out.tangents[i * 3] = path.tangents[src * 3];
      state.out.tangents[i * 3 + 1] = path.tangents[src * 3 + 1];
      state.out.tangents[i * 3 + 2] = path.tangents[src * 3 + 2];
    }
    state.out.length = path.length;
    outputs.points = state.out;
  },
});
