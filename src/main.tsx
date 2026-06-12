import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Engine } from './engine/engine';
import { App } from './editor/App';
import { EngineContext } from './editor/engineContext';
import './styles.css';

// Engine is a module-level singleton — not React state.
const engine = new Engine();

// Start with the demo patch so first load shows something.
fetch('/demo/patch.json')
  .then((r) => r.json())
  .then((patch) => engine.load(patch))
  .catch(() => {
    // fallback: minimal pulsing-box graph built in code
    const time = engine.graph.addNode('time', { x: 40, y: 120 });
    const math = engine.graph.addNode('math', { x: 280, y: 120 });
    const box = engine.graph.addNode('box', { x: 520, y: 120 });
    const out = engine.graph.addNode('sceneOutput', { x: 760, y: 120 });
    engine.graph.connect({ nodeId: time.id, portId: 't' }, { nodeId: math.id, portId: 'a' });
    engine.graph.connect({ nodeId: math.id, portId: 'out' }, { nodeId: box.id, portId: 'scale' });
    engine.graph.connect({ nodeId: box.id, portId: 'object' }, { nodeId: out.id, portId: 'object' });
  });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <EngineContext.Provider value={engine}>
      <App />
    </EngineContext.Provider>
  </StrictMode>,
);
