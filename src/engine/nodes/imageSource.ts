import * as THREE from 'three';
import { registerNode } from '../graph/registry';
import { getFallbackTexture } from './textureUtils';

interface ImageSourceState {
  loadedKey: string;
  texture: THREE.Texture | null;
  objectUrl: string | null;
}

function clear(state: ImageSourceState): void {
  state.texture?.dispose();
  state.texture = null;
  if (state.objectUrl) {
    URL.revokeObjectURL(state.objectUrl);
    state.objectUrl = null;
  }
}

registerNode<ImageSourceState>({
  type: 'imageSource',
  label: 'Image',
  category: 'input',
  inputs: [],
  outputs: [{ id: 'texture', type: 'texture', label: 'Texture' }],
  params: [
    { id: 'file', kind: 'file', label: 'Image', default: '', accept: 'image/*' },
    // url lets demo patches reference bundled assets — ctx.files is never serialized
    { id: 'url', kind: 'string', label: 'URL', default: '' },
  ],
  init() {
    return { loadedKey: '', texture: null, objectUrl: null };
  },
  compute({ node, state, outputs, params, ctx }) {
    const fileName = params.file as string;
    const url = params.url as string;
    const key = fileName ? `file:${fileName}` : url ? `url:${url}` : '';

    if (key !== state.loadedKey) {
      state.loadedKey = key;
      clear(state);
      const file = ctx.files.get(`${node.id}:file`);
      const src = fileName && file ? URL.createObjectURL(file) : !fileName && url ? url : null;
      if (src) {
        if (src !== url) state.objectUrl = src;
        const loadKey = key;
        new THREE.TextureLoader().load(src, (tex) => {
          if (state.loadedKey !== loadKey) {
            tex.dispose(); // stale load — source changed while in flight
            return;
          }
          tex.colorSpace = THREE.SRGBColorSpace;
          state.texture = tex;
          ctx.invalidate(node.id);
        });
      }
    }

    outputs.texture = state.texture ?? getFallbackTexture();
  },
  dispose(state) {
    clear(state);
  },
});
