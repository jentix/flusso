import { useRef, useState } from 'react';
import { useEngine } from '../engineContext';
import type { PatchJSON } from '../../engine/graph/serialize';

const STORAGE_KEY = 'flusso-patch';

export function TopBar() {
  const engine = useEngine();
  const fileInput = useRef<HTMLInputElement>(null);
  const [audioState, setAudioState] = useState<'off' | 'on' | 'error'>('off');

  // WebAudio needs a user gesture; this click resumes/creates the context.
  const enableAudio = async () => {
    try {
      await engine.audio.useMic();
      setAudioState('on');
    } catch {
      setAudioState('error');
    }
  };

  const save = () => {
    const patch = engine.save();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(patch));
    const blob = new Blob([JSON.stringify(patch, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'flusso-patch.json';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const loadFromStorage = () => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) engine.load(JSON.parse(raw) as PatchJSON);
  };

  const loadFromFile = async (file: File) => {
    engine.load(JSON.parse(await file.text()) as PatchJSON);
  };

  const loadDemo = async (file: string) => {
    const res = await fetch(`/demo/${file}`);
    engine.load((await res.json()) as PatchJSON);
  };

  const DEMOS: { file: string; label: string }[] = [
    { file: 'patch.json', label: 'Demo patch' },
    { file: 'text-equalizer.json', label: 'Text equalizer' },
    { file: 'halftone.json', label: 'Halftone' },
    { file: 'halftone-motion.json', label: 'Halftone motion' },
  ];

  return (
    <div className="topbar">
      <strong>Flusso</strong>
      <select
        className="demo-select"
        value=""
        onChange={(e) => {
          if (e.target.value) loadDemo(e.target.value);
        }}
      >
        <option value="" disabled>
          Demos…
        </option>
        {DEMOS.map((d) => (
          <option key={d.file} value={d.file}>
            {d.label}
          </option>
        ))}
      </select>
      <button onClick={save}>Save</button>
      <button onClick={loadFromStorage}>Load saved</button>
      <button onClick={() => fileInput.current?.click()}>Load file…</button>
      <input
        ref={fileInput}
        type="file"
        accept=".json"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) loadFromFile(f);
        }}
      />
      <span className="spacer" />
      <button onClick={enableAudio} className={`audio-btn ${audioState}`}>
        {audioState === 'on' ? '🎤 Audio on' : audioState === 'error' ? 'Audio error' : 'Enable audio (mic)'}
      </button>
    </div>
  );
}
