import { registerNode } from '../graph/registry';
import { splitGraphemes } from './textSource';
import type { PathData } from '../graph/types';

/** Font size used for measurement; advances are in these units (1 em = MEASURE_PX). */
const MEASURE_PX = 100;

let measureCtx: CanvasRenderingContext2D | null | undefined;
function getMeasureCtx(): CanvasRenderingContext2D | null {
  if (measureCtx === undefined) {
    measureCtx =
      typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null;
  }
  return measureCtx;
}

export interface LayoutOpts {
  /** Target world width the whole run is scaled to. */
  width: number;
  /** Extra tracking between glyphs, in em. */
  spacing: number;
}

/**
 * Pure layout: glyph advances → centered baseline anchor points.
 * Points are glyph centers at y=0; tangents all +X; length = `width`.
 */
export function layoutGlyphs(glyphs: string[], advances: number[], opts: LayoutOpts): PathData {
  const count = glyphs.length;
  const points = new Float32Array(count * 3);
  const tangents = new Float32Array(count * 3);
  if (count === 0) return { points, tangents, count: 0, length: 0 };

  const tracking = opts.spacing * MEASURE_PX;
  let total = -tracking;
  for (const a of advances) total += a + tracking;
  const scale = total > 0 ? opts.width / total : 0;

  let cursor = -total / 2;
  for (let i = 0; i < count; i++) {
    points[i * 3] = (cursor + advances[i] / 2) * scale;
    tangents[i * 3] = 1;
    cursor += advances[i] + tracking;
  }
  return { points, tangents, count, length: opts.width };
}

/**
 * Lays a string out as one glyph anchor per character, emitted as PathData
 * so transformModulate / any path consumer drives per-character motion —
 * the text-equalizer building block.
 */
registerNode({
  type: 'textLayout',
  label: 'Text Layout',
  category: 'geometry',
  inputs: [{ id: 'text', type: 'string', label: 'Text', defaultValue: 'FLUSSO' }],
  outputs: [{ id: 'points', type: 'path', label: 'Glyphs' }],
  params: [
    { id: 'width', kind: 'number', label: 'Width', default: 8, min: 0.5, max: 50, step: 0.1 },
    { id: 'spacing', kind: 'number', label: 'Spacing (em)', default: 0, min: -0.5, max: 2, step: 0.01 },
    { id: 'monospace', kind: 'boolean', label: 'Monospace', default: false },
    { id: 'font', kind: 'string', label: 'Font', default: 'sans-serif' },
  ],
  compute({ inputs, outputs, params }) {
    const glyphs = splitGraphemes(((inputs.text as string) ?? '') || 'FLUSSO');
    const ctx2d = getMeasureCtx();
    let advances: number[];
    if (params.monospace as boolean || !ctx2d) {
      advances = glyphs.map(() => MEASURE_PX);
    } else {
      ctx2d.font = `${MEASURE_PX}px ${params.font as string}`;
      advances = glyphs.map((g) => ctx2d.measureText(g).width || MEASURE_PX);
    }
    outputs.points = layoutGlyphs(glyphs, advances, {
      width: params.width as number,
      spacing: params.spacing as number,
    });
  },
});
