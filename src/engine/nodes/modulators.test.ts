import { describe, expect, it } from 'vitest';
import { Graph } from '../graph/graph';
import { Evaluator } from '../graph/evaluator';
import { registerNode, registry, type EvalContext } from '../graph/registry';
import { AudioEngine } from '../audio/audioEngine';
import type { Spectrum } from '../graph/types';
import './index';

if (!registry.has('t-num-src')) {
  registerNode({
    type: 't-num-src',
    label: 'TNumSrc',
    category: 'input',
    inputs: [],
    outputs: [{ id: 'v', type: 'number', label: 'v' }],
    params: [{ id: 'value', kind: 'number', label: 'value', default: 0 }],
    compute({ outputs, params }) {
      outputs.v = params.value;
    },
  });
}

function makeContext(): EvalContext {
  return {
    audio: new AudioEngine(),
    three: null,
    frame: { time: 0, dt: 0, index: 0 },
    files: new Map(),
    invalidate: () => {},
  };
}

/** Steps n frames of dt=1/60, continuing from `from` frames already run. */
function frames(ev: Evaluator, n: number, from = 0): void {
  for (let i = 0; i < n; i++) {
    const index = from + i;
    ev.evalFrame({ time: (index + 1) / 60, dt: 1 / 60, index });
  }
}

describe('lfo', () => {
  it('sine tracks phase through quarter cycles', () => {
    const graph = new Graph();
    const ev = new Evaluator(graph, makeContext());
    const lfo = graph.addNode('lfo');
    graph.setParam(lfo.id, 'bipolar', true);

    ev.evalFrame({ time: 0, dt: 0, index: 0 });
    expect(ev.peekOutput(lfo.id, 'value')).toBeCloseTo(0, 6);

    frames(ev, 15); // phase = 0.25
    expect(ev.peekOutput(lfo.id, 'value')).toBeCloseTo(1, 4);

    frames(ev, 15, 15); // phase = 0.5
    expect(ev.peekOutput(lfo.id, 'value')).toBeCloseTo(0, 4);
  });

  it('square and triangle shapes; unipolar maps to 0..1', () => {
    const graph = new Graph();
    const ev = new Evaluator(graph, makeContext());
    const lfo = graph.addNode('lfo');

    graph.setParam(lfo.id, 'shape', 'square');
    frames(ev, 15); // phase 0.25 → square = 1 → unipolar 1
    expect(ev.peekOutput(lfo.id, 'value')).toBeCloseTo(1, 6);

    graph.setParam(lfo.id, 'shape', 'triangle');
    ev.evalFrame({ time: 0, dt: 0, index: 99 }); // phase still 0.25 → triangle 0 → unipolar 0.5
    expect(ev.peekOutput(lfo.id, 'value')).toBeCloseTo(0.5, 4);
  });

  it('amplitude and offset scale the output', () => {
    const graph = new Graph();
    const ev = new Evaluator(graph, makeContext());
    const lfo = graph.addNode('lfo');
    graph.setParam(lfo.id, 'shape', 'square');
    graph.setParam(lfo.id, 'amplitude', 3);
    graph.setParam(lfo.id, 'offset', 2);
    frames(ev, 15); // unipolar square = 1 → 2 + 3*1
    expect(ev.peekOutput(lfo.id, 'value')).toBeCloseTo(5, 6);
  });

  it('rising edge on retrigger resets phase', () => {
    const graph = new Graph();
    const ev = new Evaluator(graph, makeContext());
    const src = graph.addNode('t-num-src');
    const lfo = graph.addNode('lfo');
    graph.setParam(lfo.id, 'bipolar', true);
    graph.connect({ nodeId: src.id, portId: 'v' }, { nodeId: lfo.id, portId: 'retrigger' });

    frames(ev, 20); // phase = 1/3 → sin(2π/3) ≈ 0.866
    expect(ev.peekOutput(lfo.id, 'value') as number).toBeGreaterThan(0.5);

    graph.setParam(src.id, 'value', 1);
    ev.evalFrame({ time: 21 / 60, dt: 0, index: 20 });
    expect(ev.peekOutput(lfo.id, 'value')).toBeCloseTo(0, 6);
  });
});

describe('noise', () => {
  function run(seed: number, n: number): { value: number; spectrum: Spectrum; values: number[] } {
    const graph = new Graph();
    const ev = new Evaluator(graph, makeContext());
    const node = graph.addNode('noise');
    graph.setParam(node.id, 'seed', seed);
    const values: number[] = [];
    for (let i = 0; i < n; i++) {
      ev.evalFrame({ time: i / 60, dt: 1 / 60, index: i });
      values.push(ev.peekOutput(node.id, 'value') as number);
    }
    return {
      value: ev.peekOutput(node.id, 'value') as number,
      spectrum: ev.peekOutput(node.id, 'spectrum') as Spectrum,
      values,
    };
  }

  it('is deterministic per seed', () => {
    expect(run(7, 30).value).toBe(run(7, 30).value);
    expect(run(7, 30).value).not.toBe(run(8, 30).value);
  });

  it('spectrum has the configured bin count with values in [0,1]', () => {
    const graph = new Graph();
    const ev = new Evaluator(graph, makeContext());
    const node = graph.addNode('noise');
    graph.setParam(node.id, 'bins', 24);
    ev.evalFrame({ time: 1.234, dt: 1 / 60, index: 0 });
    const spec = ev.peekOutput(node.id, 'spectrum') as Spectrum;
    expect(spec.binCount).toBe(24);
    expect(spec.bins.length).toBe(24);
    for (let i = 0; i < spec.binCount; i++) {
      expect(spec.bins[i]).toBeGreaterThanOrEqual(0);
      expect(spec.bins[i]).toBeLessThanOrEqual(1);
    }
  });

  it('varies smoothly frame to frame', () => {
    const { values } = run(3, 120);
    let changed = false;
    for (let i = 1; i < values.length; i++) {
      expect(Math.abs(values[i] - values[i - 1])).toBeLessThan(0.3);
      if (values[i] !== values[i - 1]) changed = true;
    }
    expect(changed).toBe(true);
  });
});
