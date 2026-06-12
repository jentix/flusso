// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseSvgToPath } from './svgPath';
import { splitGraphemes } from './textSource';

const starSvg = readFileSync(`${process.cwd()}/public/demo/star.svg`, 'utf-8');

describe('parseSvgToPath', () => {
  it('samples the demo star into a centered, normalized path', () => {
    const path = parseSvgToPath(starSvg, 128, 5, true);
    expect(path.count).toBeGreaterThan(64);
    expect(path.points.length).toBe(path.count * 3);
    expect(path.tangents.length).toBe(path.count * 3);

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (let i = 0; i < path.count; i++) {
      minX = Math.min(minX, path.points[i * 3]);
      maxX = Math.max(maxX, path.points[i * 3]);
      minY = Math.min(minY, path.points[i * 3 + 1]);
      maxY = Math.max(maxY, path.points[i * 3 + 1]);
    }
    // centered around origin, widest extent ≈ scale
    expect(Math.abs(minX + maxX)).toBeLessThan(0.5);
    expect(Math.abs(minY + maxY)).toBeLessThan(0.5);
    expect(Math.max(maxX - minX, maxY - minY)).toBeCloseTo(5, 1);
  });
});

describe('splitGraphemes', () => {
  it('keeps ZWJ emoji whole and drops whitespace', () => {
    expect(splitGraphemes('🔥🎵')).toEqual(['🔥', '🎵']);
    expect(splitGraphemes('👨‍👩‍👧 a')).toEqual(['👨‍👩‍👧', 'a']);
  });
});
