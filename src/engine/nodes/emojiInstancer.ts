import * as THREE from 'three';
import { registerNode } from '../graph/registry';
import { splitGraphemes } from './textSource';
import type { TransformsData } from '../graph/types';

interface EmojiInstancerState {
  group: THREE.Group;
  meshes: THREE.InstancedMesh[];
  textures: THREE.CanvasTexture[];
  geometries: THREE.PlaneGeometry[];
  builtKey: string;
  glyphs: string[];
  cursors: number[];
  scratchMatrix: THREE.Matrix4;
  scratchPos: THREE.Vector3;
  scratchQuat: THREE.Quaternion;
  scratchScale: THREE.Vector3;
}

const TEX_SIZE = 256;

/**
 * Glyphs are rasterized to canvas textures (emoji are color bitmaps — no
 * outline extrusion possible; plain text gets `color`). Canvas width follows
 * the glyph's advance so quads are tight and undistorted.
 */
function rasterizeGlyph(
  glyph: string,
  font: string,
  color: string,
): { tex: THREE.CanvasTexture; aspect: number } {
  const canvas = document.createElement('canvas');
  const fontPx = TEX_SIZE * 0.8;
  const fontSpec = `${fontPx}px ${font}`;
  const measure = canvas.getContext('2d')!;
  measure.font = fontSpec;
  // small horizontal padding so italics/overhangs don't clip
  const width = (measure.measureText(glyph).width || fontPx) + fontPx * 0.1;
  const aspect = Math.min(4, Math.max(0.2, width / TEX_SIZE));
  canvas.width = Math.ceil(TEX_SIZE * aspect);
  canvas.height = TEX_SIZE;
  const ctx = canvas.getContext('2d')!;
  ctx.font = fontSpec;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(glyph, canvas.width / 2, TEX_SIZE / 2 + TEX_SIZE * 0.04);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return { tex, aspect };
}

function disposeMeshes(state: EmojiInstancerState): void {
  for (const mesh of state.meshes) {
    (mesh.material as THREE.Material).dispose();
    state.group.remove(mesh);
    mesh.dispose();
  }
  for (const tex of state.textures) tex.dispose();
  for (const geo of state.geometries) geo.dispose();
  state.meshes = [];
  state.textures = [];
  state.geometries = [];
}

registerNode<EmojiInstancerState>({
  type: 'emojiInstancer',
  label: 'Glyph Instancer',
  category: 'geometry',
  inputs: [
    { id: 'transforms', type: 'transforms', label: 'Transforms' },
    { id: 'text', type: 'string', label: 'Text', defaultValue: '🎵' },
  ],
  outputs: [{ id: 'object', type: 'sceneObject', label: 'Object' }],
  params: [
    { id: 'size', kind: 'number', label: 'Size', default: 1, min: 0.05, max: 10, step: 0.05 },
    { id: 'billboard', kind: 'boolean', label: 'Billboard', default: true },
    { id: 'font', kind: 'string', label: 'Font', default: 'sans-serif' },
    { id: 'color', kind: 'color', label: 'Color', default: '#ffffff' },
    { id: 'anchorY', kind: 'select', label: 'Anchor', default: 'center', options: ['center', 'bottom'] },
  ],
  hot: true,
  init() {
    return {
      group: new THREE.Group(),
      meshes: [],
      textures: [],
      geometries: [],
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
    const font = params.font as string;
    const color = params.color as string;
    const anchorY = params.anchorY as string;
    const key = `${text}|${count}|${font}|${color}|${anchorY}`;

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
        const { tex, aspect } = rasterizeGlyph(state.glyphs[g], font, color);
        const geometry = new THREE.PlaneGeometry(aspect, 1);
        // bottom anchor: scaleY grows upward from the baseline (equalizer bars)
        if (anchorY === 'bottom') geometry.translate(0, 0.5, 0);
        const mesh = new THREE.InstancedMesh(
          geometry,
          new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.1, side: THREE.DoubleSide }),
          Math.max(1, n),
        );
        mesh.count = n;
        state.textures.push(tex);
        state.geometries.push(geometry);
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
    state.group.removeFromParent();
  },
});
