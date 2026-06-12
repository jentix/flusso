import * as THREE from 'three';
import { registerNode } from '../graph/registry';

interface TransformObjectState {
  group: THREE.Group;
  child: THREE.Object3D | null;
}

const DEG = Math.PI / 180;

/**
 * Wraps a scene object in a group and applies rotation/position/scale to the
 * wrapper, so the child node keeps full ownership of its own object. All
 * channels are input ports — wire LFO/noise for animated motion.
 */
registerNode<TransformObjectState>({
  type: 'transformObject',
  label: 'Transform Object',
  category: 'geometry',
  inputs: [
    { id: 'object', type: 'sceneObject', label: 'Object' },
    { id: 'rotX', type: 'number', label: 'Rot X (°)', defaultValue: 0 },
    { id: 'rotY', type: 'number', label: 'Rot Y (°)', defaultValue: 0 },
    { id: 'rotZ', type: 'number', label: 'Rot Z (°)', defaultValue: 0 },
    { id: 'posX', type: 'number', label: 'Pos X', defaultValue: 0 },
    { id: 'posY', type: 'number', label: 'Pos Y', defaultValue: 0 },
    { id: 'posZ', type: 'number', label: 'Pos Z', defaultValue: 0 },
    { id: 'scale', type: 'number', label: 'Scale', defaultValue: 1 },
  ],
  outputs: [{ id: 'object', type: 'sceneObject', label: 'Object' }],
  params: [],
  init() {
    return { group: new THREE.Group(), child: null };
  },
  compute({ state, inputs, outputs }) {
    const obj = (inputs.object as THREE.Object3D | undefined) ?? null;
    if (obj !== state.child) {
      if (state.child) state.group.remove(state.child);
      if (obj) state.group.add(obj);
      state.child = obj;
    }

    state.group.rotation.set(
      ((inputs.rotX as number) ?? 0) * DEG,
      ((inputs.rotY as number) ?? 0) * DEG,
      ((inputs.rotZ as number) ?? 0) * DEG,
    );
    state.group.position.set(
      (inputs.posX as number) ?? 0,
      (inputs.posY as number) ?? 0,
      (inputs.posZ as number) ?? 0,
    );
    const s = (inputs.scale as number) ?? 1;
    state.group.scale.setScalar(s === 0 ? 1e-4 : s);

    outputs.object = state.group;
  },
  dispose(state) {
    // release the child so its owning node's object isn't trapped in a dead group
    if (state.child) state.group.remove(state.child);
    state.child = null;
    state.group.removeFromParent();
  },
});
