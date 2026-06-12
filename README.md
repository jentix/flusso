# Flusso

Node-based generative motion graphics in the browser. Connect blocks into a pipeline — audio in, visuals out — like Blender geometry nodes, but for the web, on top of three.js.

## Quick start

```bash
npm install
npm run dev
```

Open the printed URL. The demo patch loads automatically:

1. Click **Enable audio (mic)** in the top bar (browser will ask for mic permission).
2. Make some noise — the emoji ring pulses with the spectrum.
3. In the **SVG Path** node, load `public/demo/star.svg` (or any SVG) — the emoji rearrange along its outline.
4. Edit the **Text** node to change the emoji.
5. Tweak **Spectrum** bands/gain and **Transform Modulate** amount/mode.

Add nodes from the palette (top-left of the graph), drag wires between ports (colors = data types; incompatible ports refuse to connect), delete with Backspace. **Save** downloads the patch as JSON; **Load file…** restores it.

## Scripts

| Command | What |
|---|---|
| `npm run dev` | dev server |
| `npm run build` | typecheck + production build |
| `npm test` | engine unit tests (vitest) |

## Writing a node

One file in `src/engine/nodes/`, registered via `registerNode`, imported from `src/engine/nodes/index.ts`. The editor UI (palette entry, ports, param widgets) is generated from the definition:

```ts
import { registerNode } from '../graph/registry';

registerNode({
  type: 'time',
  label: 'Time',
  category: 'input',
  inputs: [],
  outputs: [{ id: 't', type: 'number', label: 't' }],
  params: [{ id: 'speed', kind: 'number', label: 'Speed', default: 1, min: 0, max: 10, step: 0.1 }],
  hot: true, // recompute every frame
  compute({ outputs, params, ctx }) {
    outputs.t = ctx.frame.time * (params.speed as number);
  },
});
```

Nodes holding GPU resources implement `init`/`dispose`. Cold nodes (no `hot` flag) compute once and are cached until a param or upstream value changes.

## Architecture

See [AGENTS.md](AGENTS.md) for a structural overview.
