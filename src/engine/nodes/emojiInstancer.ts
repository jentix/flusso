import * as THREE from 'three';
import { registerNode } from '../graph/registry';
import { splitGraphemes } from './textSource';
import type { TransformsData } from '../graph/types';

interface EmojiInstancerState {
  group: THREE.Group;
  meshes: THREE.InstancedMesh[];
  textures: THREE.CanvasTexture[];
  geometry: THREE.PlaneGeometry;
  builtKey: string;
  glyphs: string[];
  cursors: number[];
  scratchMatrix: THREE.Matrix4;
  scratchPos: THREE.Vector3;
  scratchQuat: THREE.Quaternion;
  scratchScale: THREE.Vector3;
}

const TEX_SIZE = 128;

/** Emoji are color bitmap glyphs — rasterize to canvas, no outline extrusion possible. */
function rasterizeGlyph(glyph: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = TEX_SIZE;
  const ctx = canvas.getContext('2d')!;
  ctx.font = `${TEX_SIZE * 0.8}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(glyph, TEX_SIZE / 2, TEX_SIZE / 2 + TEX_SIZE * 0.04);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function disposeMeshes(state: EmojiInstancerState): void {
  for (const mesh of state.meshes) {
    (mesh.material as THREE.Material).dispose();
    state.group.remove(mesh);
    mesh.dispose();
  }
  for (const tex of state.textures) tex.dispose();
  state.meshes = [];
  state.textures = [];
}

registerNode<EmojiInstancerState>({
  type: 'emojiInstancer',
  label: 'Emoji Instancer',
  category: 'geometry',
  inputs: [
    { id: 'transforms', type: 'transforms', label: 'Transforms' },
    { id: 'text', type: 'string', label: 'Text', defaultValue: '🎵' },
  ],
  outputs: [{ id: 'object', type: 'sceneObject', label: 'Object' }],
  params: [
    { id: 'size', kind: 'number', label: 'Size', default: 1, min: 0.05, max: 10, step: 0.05 },
    { id: 'billboard', kind: 'boolean', label: 'Billboard', default: true },
  ],
  hot: true,
  init() {
    return {
      group: new THREE.Group(),
      meshes: [],
      textures: [],
      geometry: new THREE.PlaneGeometry(1, 1),
      builtKey: '',
      glyphs: [],
      cursors: [],
      scratchMatrix: new THREE.Matrix4(),
      scratchPos: new THREE.Vector3(),
      scratchQuat: new THREE.Quaternion(),
      scratchScale: new THREE.Vector3(),
    };
  },
  compute({ state, inputs, outputs, params, ctx }) {
    const transforms = inputs.transforms as TransformsData | undefined;
    const text = ((inputs.text as string) ?? '🎵') || '🎵';
    const count = transforms?.count ?? 0;
    const key = `${text}|${count}`;

    // Cold rebuild: re-rasterize textures / re-create instanced meshes only
    // when text or instance count changes. Dispose old GPU resources first.
    if (key !== state.builtKey) {
      state.builtKey = key;
      disposeMeshes(state);
      state.glyphs = splitGraphemes(text);
      if (state.glyphs.length === 0) state.glyphs = ['🎵'];
      // instances assigned round-robin: glyph g gets ceil-ish share of count
      for (let g = 0; g < state.glyphs.length; g++) {
        const n = Math.floor(count / state.glyphs.length) + (g < count % state.glyphs.length ? 1 : 0);
        const tex = rasterizeGlyph(state.glyphs[g]);
        const mesh = new THREE.InstancedMesh(
          state.geometry,
          new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.1, side: THREE.DoubleSide }),
          Math.max(1, n),
        );
        mesh.count = n;
        state.textures.push(tex);
        state.meshes.push(mesh);
        state.group.add(mesh);
      }
    }

    // Hot path: write instance matrices only.
    if (transforms && count > 0) {
      const size = params.size as number;
      const billboard = params.billboard as boolean;
      if (billboard && ctx.three) state.scratchQuat.copy(ctx.three.camera.quaternion);
      else state.scratchQuat.identity();

      const glyphCount = state.glyphs.length;
      if (state.cursors.length !== glyphCount) state.cursors.length = glyphCount;
      const cursor = state.cursors;
      cursor.fill(0);
      for (let i = 0; i < count; i++) {
        const g = i % glyphCount;
        const mesh = state.meshes[g];
        if (!mesh) continue;
        state.scratchPos.set(
          transforms.positions[i * 3],
          transforms.positions[i * 3 + 1],
          transforms.positions[i * 3 + 2],
        );
        state.scratchScale.set(
          transforms.scales[i * 3] * size,
          transforms.scales[i * 3 + 1] * size,
          transforms.scales[i * 3 + 2] * size,
        );
        state.scratchMatrix.compose(state.scratchPos, state.scratchQuat, state.scratchScale);
        mesh.setMatrixAt(cursor[g]++, state.scratchMatrix);
      }
      for (const mesh of state.meshes) mesh.instanceMatrix.needsUpdate = true;
    }

    outputs.object = state.group;
  },
  dispose(state) {
    disposeMeshes(state);
    state.geometry.dispose();
    state.group.removeFromParent();
  },
});
