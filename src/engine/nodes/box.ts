import * as THREE from 'three';
import { registerNode } from '../graph/registry';

interface BoxState {
  mesh: THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>;
}

registerNode<BoxState>({
  type: 'box',
  label: 'Box',
  category: 'geometry',
  inputs: [{ id: 'scale', type: 'number', label: 'Scale', defaultValue: 1 }],
  outputs: [{ id: 'object', type: 'sceneObject', label: 'Object' }],
  params: [
    { id: 'color', kind: 'color', label: 'Color', default: '#4dd0e1' },
    { id: 'spin', kind: 'number', label: 'Spin', default: 0.5, min: 0, max: 5, step: 0.1 },
  ],
  hot: true, // spins with time
  init() {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: '#4dd0e1' }),
    );
    return { mesh };
  },
  compute({ state, inputs, outputs, params, ctx }) {
    const s = Math.max(0.01, Math.abs((inputs.scale as number) ?? 1));
    state.mesh.scale.setScalar(s);
    state.mesh.rotation.y = ctx.frame.time * (params.spin as number);
    state.mesh.material.color.set(params.color as string);
    outputs.object = state.mesh;
  },
  dispose(state) {
    state.mesh.geometry.dispose();
    state.mesh.material.dispose();
    state.mesh.removeFromParent();
  },
});
