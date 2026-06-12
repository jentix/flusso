import { describe, expect, it } from 'vitest';
import { layoutDither, levelForLum } from './ditherHalftone';

describe('layoutDither', () => {
  it('original mode keeps square cells on a landscape source', () => {
    const l = layoutDither(48, 6, 2, 'original');
    expect(l.gridX).toBe(48);
    expect(l.gridY).toBe(24);
    expect(l.quadW).toBe(12);
    expect(l.quadH).toBe(6);
    expect(l.uvScaleX).toBe(1);
    expect(l.uvOffsetX).toBe(0);
  });

  it('original mode puts the grid count on the longer axis for portrait', () => {
    const l = layoutDither(48, 6, 0.5, 'original');
    expect(l.gridY).toBe(48);
    expect(l.gridX).toBe(24);
    expect(l.quadW).toBe(3);
    expect(l.quadH).toBe(6);
  });

  it('square mode center-crops a landscape source', () => {
    const l = layoutDither(40, 6, 2, 'square');
    expect(l.gridX).toBe(40);
    expect(l.gridY).toBe(40);
    expect(l.quadW).toBe(6);
    expect(l.quadH).toBe(6);
    expect(l.uvScaleX).toBeCloseTo(0.5);
    expect(l.uvScaleY).toBe(1);
    expect(l.uvOffsetX).toBeCloseTo(0.25);
    expect(l.uvOffsetY).toBe(0);
  });

  it('square mode center-crops a portrait source', () => {
    const l = layoutDither(40, 6, 0.5, 'square');
    expect(l.uvScaleX).toBe(1);
    expect(l.uvScaleY).toBeCloseTo(0.5);
    expect(l.uvOffsetX).toBe(0);
    expect(l.uvOffsetY).toBeCloseTo(0.25);
  });

  it('never produces a zero-cell axis', () => {
    const l = layoutDither(4, 6, 100, 'original');
    expect(l.gridY).toBeGreaterThanOrEqual(1);
  });
});

describe('levelForLum', () => {
  it('maps the full range onto 7 levels', () => {
    expect(levelForLum(0, 0, false)).toBe(0);
    expect(levelForLum(0.5, 0, false)).toBe(3);
    expect(levelForLum(1, 0, false)).toBe(6);
  });

  it('applies threshold bias before quantizing', () => {
    expect(levelForLum(0.5, 0.5, false)).toBe(6);
    expect(levelForLum(0.5, -0.5, false)).toBe(0);
  });

  it('inverts after the bias', () => {
    expect(levelForLum(0, 0, true)).toBe(6);
    expect(levelForLum(1, 0, true)).toBe(0);
    expect(levelForLum(0.9, 0.2, true)).toBe(0);
  });

  it('clamps out-of-range luminance', () => {
    expect(levelForLum(2, 0, false)).toBe(6);
    expect(levelForLum(-1, 0, false)).toBe(0);
  });
});
