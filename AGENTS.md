# AGENTS.md

## What this is

Flusso — node-based generative motion graphics in the browser. Users build a visual pipeline by connecting typed blocks (nodes): e.g. audio (mic/file) → FFT spectrum → SVG shape → emoji distributed along its path in 3D, pulsing with the music. Think Blender geometry nodes / TouchDesigner, on top of three.js.

## Structure

```
src/
├── main.tsx          # Engine singleton created here, React mounted around it
├── engine/           # framework-free core — NO React imports allowed here
│   ├── graph/        # data model, typed ports, Graph (source of truth),
│   │                 # Evaluator (pull-based, hot/cold caching), registry, JSON serialize
│   ├── nodes/        # one file per node type; barrel index.ts registers all
│   ├── audio/        # WebAudio: shared AudioContext + AnalyserNode + GainNode
│   ├── render/       # Stage: owns renderer/scene/camera/rAF loop
│   └── engine.ts     # ties Graph + Evaluator + AudioEngine + Stage together
└── editor/           # React UI shell
    ├── store.ts      # zustand adapter: mirrors engine graph → React Flow (one-way)
    ├── graph/        # GraphEditor, generic FlowNode (driven by NodeDef), Palette
    ├── controls/     # inline param widgets mapped from ParamDef.kind
    └── panels/       # ViewportPanel (three.js canvas), TopBar (save/load/audio)
public/demo/          # demo patch.json + star.svg, loaded on startup
```

## Architecture rules (do not break)

1. **Engine graph is the single source of truth.** React Flow state is derived; UI events call engine mutators, never the reverse. Params live in the engine only.
2. **No React imports under `src/engine/`.**
3. **Per-frame data never enters React/zustand state.** The rAF loop lives in `Stage`; hot values flow through the Evaluator only.
4. **No per-frame allocation in hot paths.** Reuse `Float32Array`/scratch `Matrix4` buffers held in node state.
5. **Nodes never touch the scene directly.** They output `Object3D`s they own; only the SceneOutput node attaches/detaches. GPU resources allocated in `init` must be freed in `dispose`.
6. **Cold/hot model:** nodes without `hot: true` compute once and are cached until a param or upstream version changes. Mark a node `hot` only if it is genuinely time-varying.

## Adding a node

One file in `src/engine/nodes/` calling `registerNode({type, label, category, inputs, outputs, params, hot?, init?, compute, dispose?})`, plus an import in `src/engine/nodes/index.ts`. Palette entry, ports, and param widgets are generated from the definition — no editor code needed.

## Develop & verify

```bash
npm run dev    # dev server (vite, port 5173)
npm test       # vitest — evaluator caching spec, SVG parsing, serialization
npm run build  # tsc -b + vite build; must stay clean
```

A task is done when:
1. `npx tsc -b` reports no errors,
2. `npm test` is green (add/extend tests for engine behavior changes),
3. the app runs in the browser with no console errors and the demo patch still works (loads on startup; "Enable audio (mic)" makes the emoji ring react).

Caveats when verifying in a browser: WebAudio requires a user gesture (the TopBar button), mic needs permission, and a hidden/backgrounded tab throttles `requestAnimationFrame` — 0 fps there is not a bug.

## Repo conventions

- `docs/plans/` is local-only scratch space, gitignored — never reference it from committed files.
- Patches serialize to JSON v1 (`{version, nodes, connections}`); bump the version and add migration on breaking format changes.
