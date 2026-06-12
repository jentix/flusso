import { describe, expect, it } from 'vitest';
import { Graph } from './graph';
import { Evaluator } from './evaluator';
import { registerNode, registry, type EvalContext } from './registry';
import { serializeGraph, loadGraph } from './serialize';
import { canConnect } from './portTypes';
import { AudioEngine } from '../audio/audioEngine';

// --- test node types -------------------------------------------------------

const counters = { cold: 0, hot: 0, sink: 0 };

if (!registry.has('t-cold')) {
  registerNode({
    type: 't-cold',
    label: 'TCold',
    category: 'input',
    inputs: [],
    outputs: [{ id: 'v', type: 'number', label: 'v' }],
    params: [{ id: 'value', kind: 'number', label: 'value', default: 5 }],
    compute({ outputs, params }) {
      counters.cold++;
      outputs.v = params.value;
    },
  });

  registerNode({
    type: 't-hot',
    label: 'THot',
    category: 'input',
    inputs: [],
    outputs: [{ id: 'v', type: 'number', label: 'v' }],
    params: [],
    hot: true,
    compute({ outputs, ctx }) {
      counters.hot++;
      outputs.v = ctx.frame.time;
    },
  });

  registerNode({
    type: 't-sink',
    label: 'TSink',
    category: 'output',
    inputs: [
      { id: 'a', type: 'number', label: 'a', defaultValue: 0 },
      { id: 'b', type: 'number', label: 'b', defaultValue: 0 },
    ],
    outputs: [{ id: 'sum', type: 'number', label: 'sum' }],
    params: [],
    compute({ inputs, outputs }) {
      counters.sink++;
      outputs.sum = ((inputs.a as number) ?? 0) + ((inputs.b as number) ?? 0);
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

function frames(ev: Evaluator, n: number): void {
  for (let i = 0; i < n; i++) ev.evalFrame({ time: i / 60, dt: 1 / 60, index: i });
}

// --- specs -----------------------------------------------------------------

describe('Evaluator hot/cold caching', () => {
  it('cold node computes once; hot node recomputes every frame', () => {
    const graph = new Graph();
    const ev = new Evaluator(graph, makeContext());
    counters.cold = counters.hot = 0;

    graph.addNode('t-cold');
    graph.addNode('t-hot');
    frames(ev, 10);

    expect(counters.cold).toBe(1);
    expect(counters.hot).toBe(10);
  });

  it('downstream of hot recomputes; downstream of cold does not', () => {
    const graph = new Graph();
    const ev = new Evaluator(graph, makeContext());
    counters.sink = 0;

    const cold = graph.addNode('t-cold');
    const sinkCold = graph.addNode('t-sink');
    graph.connect({ nodeId: cold.id, portId: 'v' }, { nodeId: sinkCold.id, portId: 'a' });
    frames(ev, 10);
    const coldSinkRuns = counters.sink;
    expect(coldSinkRuns).toBeLessThanOrEqual(2); // settles after first propagation

    counters.sink = 0;
    const hot = graph.addNode('t-hot');
    const sinkHot = graph.addNode('t-sink');
    graph.connect({ nodeId: hot.id, portId: 'v' }, { nodeId: sinkHot.id, portId: 'a' });
    frames(ev, 10);
    // sinkHot re-runs every frame (hot upstream); sinkCold re-runs at most once
    // more after the topology change forced a dirty pass.
    expect(counters.sink).toBeGreaterThanOrEqual(10);
    expect(counters.sink).toBeLessThanOrEqual(12);
  });

  it('param change recomputes a cold node exactly once', () => {
    const graph = new Graph();
    const ev = new Evaluator(graph, makeContext());
    counters.cold = 0;

    const cold = graph.addNode('t-cold');
    frames(ev, 5);
    expect(counters.cold).toBe(1);

    graph.setParam(cold.id, 'value', 9);
    frames(ev, 5);
    expect(counters.cold).toBe(2);
    expect(ev.peekOutput(cold.id, 'v')).toBe(9);
  });

  it('values propagate through connections', () => {
    const graph = new Graph();
    const ev = new Evaluator(graph, makeContext());

    const a = graph.addNode('t-cold');
    const b = graph.addNode('t-cold');
    const sink = graph.addNode('t-sink');
    graph.setParam(a.id, 'value', 3);
    graph.setParam(b.id, 'value', 4);
    graph.connect({ nodeId: a.id, portId: 'v' }, { nodeId: sink.id, portId: 'a' });
    graph.connect({ nodeId: b.id, portId: 'v' }, { nodeId: sink.id, portId: 'b' });
    frames(ev, 2);

    expect(ev.peekOutput(sink.id, 'sum')).toBe(7);
  });
});

describe('Graph rules', () => {
  it('rejects type-mismatched and cyclic connections', () => {
    expect(canConnect('number', 'number')).toBe(true);
    expect(canConnect('number', 'spectrum')).toBe(false);

    const graph = new Graph();
    const a = graph.addNode('t-cold');
    const sink = graph.addNode('t-sink');
    graph.connect({ nodeId: a.id, portId: 'v' }, { nodeId: sink.id, portId: 'a' });
    // sink.sum → ... back into anything upstream of itself = cycle
    expect(
      graph.canConnect({ nodeId: sink.id, portId: 'sum' }, { nodeId: sink.id, portId: 'b' }),
    ).toBe(false);
  });

  it('replaces existing connection on the same input', () => {
    const graph = new Graph();
    const a = graph.addNode('t-cold');
    const b = graph.addNode('t-cold');
    const sink = graph.addNode('t-sink');
    graph.connect({ nodeId: a.id, portId: 'v' }, { nodeId: sink.id, portId: 'a' });
    graph.connect({ nodeId: b.id, portId: 'v' }, { nodeId: sink.id, portId: 'a' });
    const incoming = graph.connections.filter((c) => c.to.nodeId === sink.id);
    expect(incoming).toHaveLength(1);
    expect(incoming[0].from.nodeId).toBe(b.id);
  });
});

describe('Serialization', () => {
  it('round-trips nodes, params, and connections', () => {
    const graph = new Graph();
    const a = graph.addNode('t-cold', { x: 10, y: 20 });
    const sink = graph.addNode('t-sink', { x: 30, y: 40 });
    graph.setParam(a.id, 'value', 42);
    graph.connect({ nodeId: a.id, portId: 'v' }, { nodeId: sink.id, portId: 'a' });

    const json = JSON.parse(JSON.stringify(serializeGraph(graph)));
    const graph2 = new Graph();
    loadGraph(graph2, json);

    expect(graph2.nodes.size).toBe(2);
    expect(graph2.nodes.get(a.id)?.params.value).toBe(42);
    expect(graph2.nodes.get(a.id)?.position).toEqual({ x: 10, y: 20 });
    expect(graph2.connections).toHaveLength(1);
  });
});
