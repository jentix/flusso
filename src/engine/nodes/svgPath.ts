import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import { registerNode } from '../graph/registry';
import type { PathData } from '../graph/types';

interface SvgPathState {
  loadedKey: string;
  path: PathData | null;
}

const FALLBACK_CIRCLE = makeCircle(2);

function makeCircle(radius: number, samples = 128): PathData {
  const points = new Float32Array(samples * 3);
  const tangents = new Float32Array(samples * 3);
  for (let i = 0; i < samples; i++) {
    const a = (i / samples) * Math.PI * 2;
    points[i * 3] = Math.cos(a) * radius;
    points[i * 3 + 1] = Math.sin(a) * radius;
    tangents[i * 3] = -Math.sin(a);
    tangents[i * 3 + 1] = Math.cos(a);
  }
  return { points, tangents, count: samples, length: Math.PI * 2 * radius };
}

export function parseSvgToPath(svgText: string, samples: number, scale: number, center: boolean): PathData {
  const { paths } = new SVGLoader().parse(svgText);
  const subPaths = paths.flatMap((p) => p.subPaths).filter((sp) => sp.getLength() > 0);
  if (subPaths.length === 0) return FALLBACK_CIRCLE;

  const totalLength = subPaths.reduce((sum, sp) => sum + sp.getLength(), 0);
  const points: number[] = [];
  const tangents: number[] = [];
  for (const sp of subPaths) {
    const n = Math.max(2, Math.round((sp.getLength() / totalLength) * samples));
    for (let i = 0; i < n; i++) {
      const t = i / n;
      const pt = sp.getPointAt(t);
      const tan = sp.getTangentAt(t);
      // SVG is Y-down; flip to Y-up
      points.push(pt.x, -pt.y, 0);
      tangents.push(tan.x, -tan.y, 0);
    }
  }

  const pos = new Float32Array(points);
  const tan = new Float32Array(tangents);
  const count = pos.length / 3;

  // center + normalize to ~`scale` world units wide
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < count; i++) {
    minX = Math.min(minX, pos[i * 3]);
    maxX = Math.max(maxX, pos[i * 3]);
    minY = Math.min(minY, pos[i * 3 + 1]);
    maxY = Math.max(maxY, pos[i * 3 + 1]);
  }
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const extent = Math.max(maxX - minX, maxY - minY) || 1;
  const k = scale / extent;
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (pos[i * 3] - (center ? cx : 0)) * k;
    pos[i * 3 + 1] = (pos[i * 3 + 1] - (center ? cy : 0)) * k;
  }
  return { points: pos, tangents: tan, count, length: totalLength * k };
}

registerNode<SvgPathState>({
  type: 'svgPath',
  label: 'SVG Path',
  category: 'input',
  inputs: [],
  outputs: [{ id: 'path', type: 'path', label: 'Path' }],
  params: [
    { id: 'file', kind: 'file', label: 'SVG file', default: '', accept: '.svg,image/svg+xml' },
    { id: 'samples', kind: 'number', label: 'Samples', default: 256, min: 16, max: 2048, step: 16 },
    { id: 'scale', kind: 'number', label: 'Scale', default: 5, min: 0.1, max: 50, step: 0.1 },
    { id: 'center', kind: 'boolean', label: 'Center', default: true },
  ],
  init() {
    return { loadedKey: '', path: null };
  },
  compute({ node, state, outputs, params, ctx }) {
    const samples = params.samples as number;
    const scale = params.scale as number;
    const center = params.center as boolean;
    const fileName = params.file as string;
    const key = `${fileName}|${samples}|${scale}|${center}`;

    if (key !== state.loadedKey) {
      state.loadedKey = key;
      const file = ctx.files.get(`${node.id}:file`);
      if (file) {
        file.text().then((text) => {
          state.path = parseSvgToPath(text, samples, scale, center);
          ctx.invalidate(node.id); // async load finished — recompute output
        });
      } else {
        state.path = null;
      }
    }

    outputs.path = state.path ?? makeCircle((scale as number) / 2, Math.min(samples, 256));
  },
});
