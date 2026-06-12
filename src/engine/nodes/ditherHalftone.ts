import * as THREE from 'three';
import { registerNode } from '../graph/registry';
import { buildProceduralAtlas, buildShapeAtlas, SHAPE_SLOTS } from './shapeAtlas';
import { getFallbackTexture, textureAspect } from './textureUtils';

export type AspectMode = 'original' | 'square';

export interface DitherLayout {
  gridX: number;
  gridY: number;
  quadW: number;
  quadH: number;
  uvScaleX: number;
  uvScaleY: number;
  uvOffsetX: number;
  uvOffsetY: number;
}

/**
 * Grid/quad/crop math for the two aspect modes. `grid` counts cells along
 * the longer axis; the shorter axis derives from aspect so cells stay square.
 * `square` mode center-crops the source UVs to a 1:1 window.
 */
export function layoutDither(grid: number, size: number, srcAspect: number, mode: AspectMode): DitherLayout {
  const g = Math.max(1, Math.round(grid));
  if (mode === 'square') {
    const landscape = srcAspect >= 1;
    return {
      gridX: g,
      gridY: g,
      quadW: size,
      quadH: size,
      uvScaleX: landscape ? 1 / srcAspect : 1,
      uvScaleY: landscape ? 1 : srcAspect,
      uvOffsetX: landscape ? (1 - 1 / srcAspect) / 2 : 0,
      uvOffsetY: landscape ? 0 : (1 - srcAspect) / 2,
    };
  }
  const landscape = srcAspect >= 1;
  return {
    gridX: landscape ? g : Math.max(1, Math.round(g * srcAspect)),
    gridY: landscape ? Math.max(1, Math.round(g / srcAspect)) : g,
    quadW: size * srcAspect,
    quadH: size,
    uvScaleX: 1,
    uvScaleY: 1,
    uvOffsetX: 0,
    uvOffsetY: 0,
  };
}

/** CPU mirror of the shader's quantization — level 0 (shadow) … 6 (highlight). */
export function levelForLum(lum: number, threshold: number, invert: boolean): number {
  let l = Math.min(1, Math.max(0, lum + threshold));
  if (invert) l = 1 - l;
  return Math.min(Math.floor(l * SHAPE_SLOTS), SHAPE_SLOTS - 1);
}

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FRAG = /* glsl */ `
uniform sampler2D uSrc;
uniform sampler2D uAtlas;
uniform vec2 uGrid;
uniform vec2 uUvScale;
uniform vec2 uUvOffset;
uniform float uScaleMin;
uniform float uScaleMax;
uniform float uRotStart;
uniform float uRotEnd;
uniform float uRotOffset;
uniform float uThreshold;
uniform float uInvert;
uniform vec3 uBg;
uniform vec3 uTint;
varying vec2 vUv;

void main() {
  vec2 g = vUv * uGrid;
  vec2 cell = floor(g);
  vec2 cellUv = fract(g);
  vec2 srcUv = ((cell + 0.5) / uGrid) * uUvScale + uUvOffset; // sample at cell center
  vec3 c = texture2D(uSrc, srcUv).rgb;
  float lum = clamp(dot(c, vec3(0.2126, 0.7152, 0.0722)) + uThreshold, 0.0, 1.0);
  lum = mix(lum, 1.0 - lum, uInvert);
  float level = min(floor(lum * 7.0), 6.0);
  // mapping from the quantized level makes cells visibly snap between the 7
  // states; use t = lum for a continuous variant
  float t = level / 6.0;
  float s = max(mix(uScaleMin, uScaleMax, t), 1e-4);
  float ang = mix(uRotStart, uRotEnd, t) + uRotOffset;
  vec2 p = cellUv - 0.5;
  float ca = cos(ang), sa = sin(ang);
  p = mat2(ca, sa, -sa, ca) * p;
  p = p / s + 0.5;
  float alpha = 0.0;
  if (all(greaterThanEqual(p, vec2(0.0))) && all(lessThanEqual(p, vec2(1.0)))) {
    alpha = texture2D(uAtlas, vec2((level + p.x) / 7.0, p.y)).a;
  }
  gl_FragColor = vec4(mix(uBg, uTint, alpha), 1.0);
  #include <colorspace_fragment>
}
`;

interface DitherState {
  mesh: THREE.Mesh;
  geometry: THREE.PlaneGeometry;
  material: THREE.ShaderMaterial;
  atlasTexture: THREE.CanvasTexture;
  atlasKey: string;
}

function makeAtlasTexture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  // pure alpha mask — keep linear, no mips (atlas slots would bleed)
  tex.generateMipmaps = false;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  return tex;
}

const DEG = Math.PI / 180;

const SHAPE_PARAM_IDS = Array.from({ length: SHAPE_SLOTS }, (_, i) => `shape${i}`);

registerNode<DitherState>({
  type: 'ditherHalftone',
  label: 'Dither Halftone',
  category: 'geometry',
  inputs: [
    { id: 'texture', type: 'texture', label: 'Texture' },
    { id: 'rotation', type: 'number', label: 'Rotation (°)', defaultValue: 0 },
    { id: 'rotStart', type: 'number', label: 'Rot start (°)', defaultValue: 0 },
    { id: 'rotEnd', type: 'number', label: 'Rot end (°)', defaultValue: 0 },
    { id: 'scaleMin', type: 'number', label: 'Scale min', defaultValue: 0.3 },
    { id: 'scaleMax', type: 'number', label: 'Scale max', defaultValue: 1 },
    { id: 'threshold', type: 'number', label: 'Threshold', defaultValue: 0 },
  ],
  outputs: [{ id: 'object', type: 'sceneObject', label: 'Object' }],
  params: [
    { id: 'grid', kind: 'number', label: 'Grid', default: 48, min: 4, max: 200, step: 1 },
    { id: 'size', kind: 'number', label: 'Size', default: 6, min: 1, max: 20, step: 0.1 },
    { id: 'aspect', kind: 'select', label: 'Aspect', default: 'original', options: ['original', 'square'] },
    { id: 'invert', kind: 'boolean', label: 'Invert', default: false },
    { id: 'bg', kind: 'color', label: 'Background', default: '#101014' },
    { id: 'shapeColor', kind: 'color', label: 'Shape color', default: '#ffffff' },
    ...SHAPE_PARAM_IDS.map((id, i) => ({
      id,
      kind: 'file' as const,
      label: `Shape ${i + 1}${i === 0 ? ' (shadow)' : i === SHAPE_SLOTS - 1 ? ' (highlight)' : ''}`,
      default: '',
      accept: '.svg,image/svg+xml',
    })),
  ],
  init() {
    const atlasTexture = makeAtlasTexture(buildProceduralAtlas());
    const geometry = new THREE.PlaneGeometry(1, 1);
    const material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uSrc: { value: getFallbackTexture() },
        uAtlas: { value: atlasTexture },
        uGrid: { value: new THREE.Vector2(48, 48) },
        uUvScale: { value: new THREE.Vector2(1, 1) },
        uUvOffset: { value: new THREE.Vector2(0, 0) },
        uScaleMin: { value: 0.3 },
        uScaleMax: { value: 1 },
        uRotStart: { value: 0 },
        uRotEnd: { value: 0 },
        uRotOffset: { value: 0 },
        uThreshold: { value: 0 },
        uInvert: { value: 0 },
        uBg: { value: new THREE.Color('#101014') },
        uTint: { value: new THREE.Color('#ffffff') },
      },
    });
    const mesh = new THREE.Mesh(geometry, material);
    return { mesh, geometry, material, atlasTexture, atlasKey: '__procedural__' };
  },
  compute({ node, state, inputs, outputs, params, ctx }) {
    // Cold path: rebuild the shape atlas when any shape file changes.
    const atlasKey = SHAPE_PARAM_IDS.map((id) => params[id] as string).join('|');
    if (atlasKey !== state.atlasKey) {
      state.atlasKey = atlasKey;
      void Promise.all(
        SHAPE_PARAM_IDS.map((id) => ctx.files.get(`${node.id}:${id}`)?.text() ?? null),
      )
        .then((texts) => buildShapeAtlas(texts))
        .then((canvas) => {
          if (state.atlasKey !== atlasKey) return; // stale build — shapes changed again
          state.atlasTexture.dispose();
          state.atlasTexture = makeAtlasTexture(canvas);
          state.material.uniforms.uAtlas.value = state.atlasTexture;
          ctx.invalidate(node.id);
        });
    }

    // Hot path: uniform writes only.
    const src = (inputs.texture as THREE.Texture | null | undefined) ?? getFallbackTexture();
    const layout = layoutDither(
      params.grid as number,
      params.size as number,
      textureAspect(src),
      params.aspect as AspectMode,
    );
    const u = state.material.uniforms;
    u.uSrc.value = src;
    u.uGrid.value.set(layout.gridX, layout.gridY);
    u.uUvScale.value.set(layout.uvScaleX, layout.uvScaleY);
    u.uUvOffset.value.set(layout.uvOffsetX, layout.uvOffsetY);
    u.uScaleMin.value = (inputs.scaleMin as number) ?? 0.3;
    u.uScaleMax.value = (inputs.scaleMax as number) ?? 1;
    u.uRotStart.value = ((inputs.rotStart as number) ?? 0) * DEG;
    u.uRotEnd.value = ((inputs.rotEnd as number) ?? 0) * DEG;
    u.uRotOffset.value = ((inputs.rotation as number) ?? 0) * DEG;
    u.uThreshold.value = (inputs.threshold as number) ?? 0;
    u.uInvert.value = (params.invert as boolean) ? 1 : 0;
    (u.uBg.value as THREE.Color).set(params.bg as string);
    (u.uTint.value as THREE.Color).set(params.shapeColor as string);
    state.mesh.scale.set(layout.quadW, layout.quadH, 1);

    outputs.object = state.mesh;
  },
  dispose(state) {
    state.geometry.dispose();
    state.material.dispose();
    state.atlasTexture.dispose();
    state.mesh.removeFromParent();
  },
});
