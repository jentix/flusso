import { describe, expect, it } from 'vitest';
import { Graph } from '../graph/graph';
import { Evaluator } from '../graph/evaluator';
import { registerNode, registry, type EvalContext } from '../graph/registry';
import { AudioEngine } from '../audio/audioEngine';
import { layoutGlyphs } from './textLayout';
import type { Spectrum, TransformsData } from '../graph/types';
import './index';

describe('layoutGlyphs', () => {
  const glyphs = ['F', 'L', 'U', 'X'];

  it('emits one centered anchor per glyph with +X tangents', () => {
    const path = layoutGlyphs(glyphs, [60, 50, 70, 80], { width: 8, spacing: 0 });
    expect(path.count).toBe(4);
    expect(path.length).toBe(8);

    for (let i = 0; i < path.count; i++) {
      expect(path.points[i * 3 + 1]).toBe(0); // baseline
      expect(path.tangents[i * 3]).toBe(1);
    }
    // run is centered: leftmost edge ≈ -width/2, rightmost ≈ +width/2
    const scale = 8 / (60 + 50 + 70 + 80);
    expect(path.points[0] - (60 / 2) * scale).toBeCloseTo(-4, 6);
    expect(path.points[3 * 3] + (80 / 2) * scale).toBeCloseTo(4, 6);
  });

  it('equal advances give equal deltas (monospace grid)', () => {
    const path = layoutGlyphs(glyphs, [100, 100, 100, 100], { width: 6, spacing: 0 });
    const dx1 = path.points[3] - path.points[0];
    const dx2 = path.points[6] - path.points[3];
    const dx3 = path.points[9] - path.points[6];
    expect(dx1).toBeCloseTo(1.5, 6);
    expect(dx2).toBeCloseTo(dx1, 6);
    expect(dx3).toBeCloseTo(dx1, 6);
  });

  it('spacing spreads glyph centers toward the edges', () => {
    const tight = layoutGlyphs(glyphs, [100, 100, 100, 100], { width: 6, spacing: 0 });
    const spaced = layoutGlyphs(glyphs, [100, 100, 100, 100], { width: 6, spacing: 0.5 });
    // same total width, but tracking pushes outer glyph centers outward
    expect(Math.abs(spaced.points[0])).toBeGreaterThan(Math.abs(tight.points[0]));
  });

  it('handles empty input', () => {
    const path = layoutGlyphs([], [], { width: 8, spacing: 0 });
    expect(path.count).toBe(0);
    expect(path.length).toBe(0);
  });
});

// --- integration: textLayout → transformModulate (the text-equalizer core) --

if (!registry.has('t-num-src2')) {
  registerNode({
    type: 't-num-src2',
    label: 'TNumSrc2',
    category: 'input',
    inputs: [],
    outputs: [{ id: 'v', type: 'number', label: 'v' }],
    params: [{ id: 'value', kind: 'number', label: 'value', default: 0 }],
    compute({ outputs, params }) {
      outputs.v = params.value;
    },
  });
}

if (!registry.has('t-spectrum-src')) {
  registerNode({
    type: 't-spectrum-src',
    label: 'TSpectrumSrc',
    category: 'input',
    inputs: [],
    outputs: [{ id: 'spectrum', type: 'spectrum', label: 'spectrum' }],
    params: [],
    compute({ outputs }) {
      outputs.spectrum = { bins: new Float32Array([0, 1]), binCount: 2 } satisfies Spectrum;
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

describe('textLayout → transformModulate', () => {
  it('spectrum bins drive per-character scaleY from the layout anchors', () => {
    const graph = new Graph();
    const ev = new Evaluator(graph, makeContext());

    const layout = graph.addNode('textLayout'); // default text 'FLUSSO' (6 glyphs)
    graph.setParam(layout.id, 'monospace', true);
    const spec = graph.addNode('t-spectrum-src');
    const mod = graph.addNode('transformModulate');
    graph.setParam(mod.id, 'mode', 'scaleY');
    graph.setParam(mod.id, 'amount', 4);
    graph.setParam(mod.id, 'baseScale', 1);
    graph.connect({ nodeId: layout.id, portId: 'points' }, { nodeId: mod.id, portId: 'points' });
    graph.connect({ nodeId: spec.id, portId: 'spectrum' }, { nodeId: mod.id, portId: 'spectrum' });

    ev.evalFrame({ time: 0, dt: 1 / 60, index: 0 });
    const out = ev.peekOutput(mod.id, 'transforms') as TransformsData;

    expect(out.count).toBe(6);
    // first half maps to bin 0 (level 0), second half to bin 1 (level 1)
    expect(out.scales[0 * 3 + 1]).toBeCloseTo(1, 6);
    expect(out.scales[5 * 3 + 1]).toBeCloseTo(1 + 4, 6);
    // positions come straight from the layout: baseline y stays 0
    expect(out.positions[5 * 3 + 1]).toBe(0);
    // x increases monotonically along the line
    expect(out.positions[5 * 3]).toBeGreaterThan(out.positions[0]);
  });

  it('connected amount input overrides the amount param (LFO-style modulation)', () => {
    const graph = new Graph();
    const ev = new Evaluator(graph, makeContext());

    const layout = graph.addNode('textLayout');
    graph.setParam(layout.id, 'monospace', true);
    const spec = graph.addNode('t-spectrum-src');
    const amt = graph.addNode('t-num-src2');
    graph.setParam(amt.id, 'value', 2);
    const mod = graph.addNode('transformModulate');
    graph.setParam(mod.id, 'mode', 'scaleY');
    graph.setParam(mod.id, 'amount', 4);
    graph.setParam(mod.id, 'baseScale', 1);
    graph.connect({ nodeId: layout.id, portId: 'points' }, { nodeId: mod.id, portId: 'points' });
    graph.connect({ nodeId: spec.id, portId: 'spectrum' }, { nodeId: mod.id, portId: 'spectrum' });
    graph.connect({ nodeId: amt.id, portId: 'v' }, { nodeId: mod.id, portId: 'amount' });

    ev.evalFrame({ time: 0, dt: 1 / 60, index: 0 });
    const out = ev.peekOutput(mod.id, 'transforms') as TransformsData;
    // bin 1 level = 1 → sy = base * (1 + level * connectedAmount) = 1 * (1 + 2)
    expect(out.scales[5 * 3 + 1]).toBeCloseTo(3, 6);
  });
});
