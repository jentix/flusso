import { registerNode } from '../graph/registry';
import type { AudioEngine } from '../audio/audioEngine';

interface AudioSourceState {
  appliedKey: string;
}

/**
 * Activates the shared AudioEngine. Output is a handle (the engine itself);
 * the Spectrum node reads bins from it each frame.
 * Mic/file activation needs a user gesture — the TopBar "Enable audio"
 * button resumes the AudioContext; this node then switches sources.
 */
registerNode<AudioSourceState>({
  type: 'audioSource',
  label: 'Audio Source',
  category: 'audio',
  inputs: [],
  outputs: [{ id: 'audio', type: 'audio', label: 'Audio' }],
  params: [
    { id: 'source', kind: 'select', label: 'Source', default: 'mic', options: ['mic', 'file'] },
    { id: 'file', kind: 'file', label: 'Audio file', default: '', accept: 'audio/*' },
    { id: 'playing', kind: 'boolean', label: 'Playing', default: true },
    { id: 'level', kind: 'number', label: 'Level', default: 1, min: 0, max: 1, step: 0.01 },
  ],
  hot: true,
  init() {
    return { appliedKey: '' };
  },
  compute({ node, state, outputs, params, ctx }) {
    const kind = params.source as string;
    const fileName = params.file as string;
    const key = kind === 'file' ? `file:${fileName}` : 'mic';
    if (key !== state.appliedKey) {
      state.appliedKey = key;
      if (kind === 'mic') {
        ctx.audio.useMic().catch(() => {});
      } else {
        const file = ctx.files.get(`${node.id}:file`);
        if (file) ctx.audio.useFile(file).catch(() => {});
      }
    }
    ctx.audio.setLevel(params.level as number);
    ctx.audio.setPlaying(params.playing as boolean);
    outputs.audio = ctx.audio satisfies AudioEngine;
  },
  dispose(_state, ctx) {
    ctx.audio.stop();
  },
});
