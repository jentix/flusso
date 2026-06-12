import * as THREE from 'three';

/** Width/height aspect of a texture's backing image (1 when unknown). */
export function textureAspect(tex: THREE.Texture | null | undefined): number {
  const img = tex?.image as
    | { width?: number; height?: number; videoWidth?: number; videoHeight?: number }
    | undefined;
  if (!img) return 1;
  const w = img.videoWidth || img.width || 0;
  const h = img.videoHeight || img.height || 0;
  return w > 0 && h > 0 ? w / h : 1;
}

let fallback: THREE.CanvasTexture | null = null;

/**
 * Shared placeholder source: a radial gradient covering the full luminance
 * range, so texture consumers always render something meaningful before a
 * file/url is loaded. Never disposed — it is a module-lifetime singleton.
 */
export function getFallbackTexture(): THREE.Texture {
  if (fallback) return fallback;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(128, 110, 10, 128, 128, 180);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.55, '#777777');
  grad.addColorStop(1, '#000000');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);
  fallback = new THREE.CanvasTexture(canvas);
  fallback.colorSpace = THREE.SRGBColorSpace;
  return fallback;
}
