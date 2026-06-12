import { Graph } from './graph/graph';
import { Evaluator } from './graph/evaluator';
import { AudioEngine } from './audio/audioEngine';
import { Stage } from './render/stage';
import type { EvalContext } from './graph/registry';
import { serializeGraph, loadGraph, type PatchJSON } from './graph/serialize';
import './nodes'; // register all node types

/**
 * Ties Graph + Evaluator + AudioEngine + Stage together.
 * Created once in main.tsx as a singleton; React gets it via context
 * but never stores engine data in React state.
 */
export class Engine {
  readonly graph = new Graph();
  readonly audio = new AudioEngine();
  readonly ctx: EvalContext;
  readonly evaluator: Evaluator;
  private stage: Stage | null = null;

  constructor() {
    this.ctx = {
      audio: this.audio,
      three: null,
      frame: { time: 0, dt: 0, index: 0 },
      files: new Map(),
      invalidate: () => {},
    };
    this.evaluator = new Evaluator(this.graph, this.ctx);
  }

  attachStage(stage: Stage): void {
    this.stage = stage;
    this.ctx.three = { scene: stage.scene, renderer: stage.renderer, camera: stage.camera };
    stage.start((frame) => this.evaluator.evalFrame(frame));
  }

  detachStage(): void {
    this.stage?.dispose();
    this.stage = null;
    this.ctx.three = null;
  }

  get fps(): number {
    return this.stage?.fps ?? 0;
  }

  setFile(nodeId: string, paramId: string, file: File): void {
    this.ctx.files.set(`${nodeId}:${paramId}`, file);
    this.graph.setParam(nodeId, paramId, file.name);
  }

  save(): PatchJSON {
    return serializeGraph(this.graph);
  }

  load(patch: PatchJSON): void {
    this.evaluator.disposeAll();
    loadGraph(this.graph, patch);
  }

  /** Reset to an empty project: tear down node resources and clear the graph. */
  newProject(): void {
    this.evaluator.disposeAll();
    this.graph.clear();
  }
}
