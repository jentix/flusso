import * as THREE from 'three';
import { registerNode } from '../graph/registry';
import { getFallbackTexture } from './textureUtils';

interface VideoSourceState {
  loadedKey: string;
  video: HTMLVideoElement | null;
  texture: THREE.VideoTexture | null;
  objectUrl: string | null;
}

function clear(state: VideoSourceState): void {
  if (state.video) {
    state.video.pause();
    state.video.removeAttribute('src');
    state.video.load();
    state.video = null;
  }
  state.texture?.dispose();
  state.texture = null;
  if (state.objectUrl) {
    URL.revokeObjectURL(state.objectUrl);
    state.objectUrl = null;
  }
}

/**
 * Video file/url → VideoTexture. The node stays cold: VideoTexture updates
 * itself whenever the renderer samples it, no per-frame recompute needed.
 */
registerNode<VideoSourceState>({
  type: 'videoSource',
  label: 'Video',
  category: 'input',
  inputs: [],
  outputs: [{ id: 'texture', type: 'texture', label: 'Texture' }],
  params: [
    { id: 'file', kind: 'file', label: 'Video', default: '', accept: 'video/*' },
    { id: 'url', kind: 'string', label: 'URL', default: '' },
    { id: 'playing', kind: 'boolean', label: 'Playing', default: true },
  ],
  init() {
    return { loadedKey: '', video: null, texture: null, objectUrl: null };
  },
  compute({ node, state, outputs, params, ctx }) {
    const fileName = params.file as string;
    const url = params.url as string;
    const playing = params.playing as boolean;
    const key = fileName ? `file:${fileName}` : url ? `url:${url}` : '';

    if (key !== state.loadedKey) {
      state.loadedKey = key;
      clear(state);
      const file = ctx.files.get(`${node.id}:file`);
      const src = fileName && file ? URL.createObjectURL(file) : !fileName && url ? url : null;
      if (src) {
        if (src !== url) state.objectUrl = src;
        const video = document.createElement('video');
        // muted+playsInline: required for autoplay without a user gesture
        video.muted = true;
        video.loop = true;
        video.playsInline = true;
        video.crossOrigin = 'anonymous';
        video.src = src;
        video.addEventListener('loadedmetadata', () => {
          ctx.invalidate(node.id); // downstream picks up real aspect
        });
        state.video = video;
        state.texture = new THREE.VideoTexture(video);
        state.texture.colorSpace = THREE.SRGBColorSpace;
      }
    }

    if (state.video) {
      if (playing && state.video.paused) void state.video.play().catch(() => {});
      else if (!playing && !state.video.paused) state.video.pause();
    }

    outputs.texture = state.texture ?? getFallbackTexture();
  },
  dispose(state) {
    clear(state);
  },
});
