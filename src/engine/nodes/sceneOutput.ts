import * as THREE from 'three';
import { registerNode } from '../graph/registry';

interface SceneOutputState {
  attached: THREE.Object3D | null;
}

/**
 * The single chokepoint that touches the three.js scene.
 * Diffs its input against what it previously attached.
 */
registerNode<SceneOutputState>({
  type: 'sceneOutput',
  label: 'Scene Output',
  category: 'output',
  inputs: [{ id: 'object', type: 'sceneObject', label: 'Object' }],
  outputs: [],
  params: [{ id: 'background', kind: 'color', label: 'Background', default: '#101014' }],
  hot: true,
  init() {
    return { attached: null };
  },
  compute({ state, inputs, params, ctx }) {
    if (!ctx.three) return;
    const obj = (inputs.object as THREE.Object3D | undefined) ?? null;
    if (obj !== state.attached) {
      if (state.attached) ctx.three.scene.remove(state.attached);
      if (obj) ctx.three.scene.add(obj);
      state.attached = obj;
    }
    const bg = ctx.three.scene.background;
    if (bg instanceof THREE.Color) bg.set(params.background as string);
  },
  dispose(state, ctx) {
    if (state.attached && ctx.three) ctx.three.scene.remove(state.attached);
    state.attached = null;
  },
});
