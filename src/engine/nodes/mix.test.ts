import { describe, expect, it } from 'vitest';
import { Graph } from '../graph/graph';
import { Evaluator } from '../graph/evaluator';
import { registerNode, registry, type EvalContext } from '../graph/registry';
import { AudioEngine } from '../audio/audioEngine';
import type { Spectrum } from '../graph/types';
import './index';

if (!registry.has('t-mix-num')) {
  registerNode({
    type: 't-mix-num',
    label: 'TMixNum',
    category: 'input',
    inputs: [],
    outputs: [{ id: 'v', type: 'number', label: 'v' }],
    params: [{ id: 'value', kind: 'number', label: 'value', default: 0 }],
    compute({ outputs, params }) {
      outputs.v = params.value;
    },
  });

  registerNode({
    type: 't-mix-spec',
    label: 'TMixSpec',
    category: 'input',
    inputs: [],
    outputs: [{ id: 'spectrum', type: 'spectrum', label: 'spectrum' }],
    params: [{ id: 'bins', kind: 'string', label: 'bins', default: '0,1' }],
    compute({ outputs, params }) {
      const values = (params.bins as string).split(',').map(Number);
      outputs.spectrum = { bins: new Float32Array(values), binCount: values.length } satisfies Spectrum;
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

function setup() {
  const graph = new Graph();
  const ev = new Evaluator(graph, makeContext());
  const mix = graph.addNode('mix');
  return { graph, ev, mix };
}

describe('mix — numbers', () => {
  it.each([
    ['mix', 2.5], // 2 + (4-2)*0.25
    ['add', 6],
    ['multiply', 8],
    ['max', 4],
  ])('%s mode blends two numbers', (mode, expected) => {
    const { graph, ev, mix } = setup();
    const a = graph.addNode('t-mix-num');
    const b = graph.addNode('t-mix-num');
    graph.setParam(a.id, 'value', 2);
    graph.setParam(b.id, 'value', 4);
    graph.setParam(mix.id, 'mode', mode);
    graph.setParam(mix.id, 'mix', 0.25);
    graph.connect({ nodeId: a.id, portId: 'v' }, { nodeId: mix.id, portId: 'a' });
    graph.connect({ nodeId: b.id, portId: 'v' }, { nodeId: mix.id, portId: 'b' });
    ev.evalFrame({ time: 0, dt: 1 / 60, index: 0 });
    expect(ev.peekOutput(mix.id, 'value')).toBeCloseTo(expected, 6);
  });

  it('connected mix input overrides the mix param', () => {
    const { graph, ev, mix } = setup();
    const a = graph.addNode('t-mix-num');
    const b = graph.addNode('t-mix-num');
    const fader = graph.addNode('t-mix-num');
    graph.setParam(a.id, 'value', 0);
    graph.setParam(b.id, 'value', 10);
    graph.setParam(fader.id, 'value', 1);
    graph.setParam(mix.id, 'mix', 0.5);
    graph.connect({ nodeId: a.id, portId: 'v' }, { nodeId: mix.id, portId: 'a' });
    graph.connect({ nodeId: b.id, portId: 'v' }, { nodeId: mix.id, portId: 'b' });
    graph.connect({ nodeId: fader.id, portId: 'v' }, { nodeId: mix.id, portId: 'mix' });
    ev.evalFrame({ time: 0, dt: 1 / 60, index: 0 });
    expect(ev.peekOutput(mix.id, 'value')).toBeCloseTo(10, 6); // full B, not 5
  });
});

describe('mix — spectra', () => {
  it('add sums per bin, resamples mismatched bin counts, clamps to [0,1]', () => {
    const { graph, ev, mix } = setup();
    const sa = graph.addNode('t-mix-spec');
    const sb = graph.addNode('t-mix-spec');
    graph.setParam(sa.id, 'bins', '0.2,0.9,0.5,0.5'); // 4 bins
    graph.setParam(sb.id, 'bins', '0.4,0.4'); // 2 bins → resampled to 4
    graph.setParam(mix.id, 'mode', 'add');
    graph.connect({ nodeId: sa.id, portId: 'spectrum' }, { nodeId: mix.id, portId: 'specA' });
    graph.connect({ nodeId: sb.id, portId: 'spectrum' }, { nodeId: mix.id, portId: 'specB' });
    ev.evalFrame({ time: 0, dt: 1 / 60, index: 0 });
    const out = ev.peekOutput(mix.id, 'spectrum') as Spectrum;
    expect(out.binCount).toBe(4);
    expect(out.bins[0]).toBeCloseTo(0.6, 6); // 0.2 + 0.4
    expect(out.bins[1]).toBeCloseTo(1, 6); // 0.9 + 0.4 clamped
    expect(out.bins[2]).toBeCloseTo(0.9, 6); // 0.5 + 0.4 (sb bin 1)
  });

  it('add passes one source through when the other is unconnected', () => {
    const { graph, ev, mix } = setup();
    const sa = graph.addNode('t-mix-spec');
    graph.setParam(sa.id, 'bins', '0.3,0.7');
    graph.setParam(mix.id, 'mode', 'add');
    graph.connect({ nodeId: sa.id, portId: 'spectrum' }, { nodeId: mix.id, portId: 'specA' });
    ev.evalFrame({ time: 0, dt: 1 / 60, index: 0 });
    const out = ev.peekOutput(mix.id, 'spectrum') as Spectrum;
    expect(out.binCount).toBe(2);
    expect(out.bins[0]).toBeCloseTo(0.3, 6);
    expect(out.bins[1]).toBeCloseTo(0.7, 6);
  });
});
