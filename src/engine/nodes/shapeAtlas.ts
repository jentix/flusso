export const SHAPE_SLOTS = 7;

export const DEFAULT_SHAPE_URLS = Array.from(
  { length: SHAPE_SLOTS },
  (_, i) => `/demo/shapes/shape${i}.svg`,
);

/** Inject explicit width/height — Firefox can't decode SVGs without an intrinsic size. */
function withExplicitSize(svgText: string, size: number): string {
  return svgText.replace(/<svg\b/, `<svg width="${size}" height="${size}"`);
}

async function loadSvgImage(svgText: string, size: number): Promise<HTMLImageElement | null> {
  const blob = new Blob([withExplicitSize(svgText, size)], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function drawFallbackShape(
  ctx: CanvasRenderingContext2D,
  slot: number,
  slotSize: number,
  pad: number,
): void {
  const r = ((slot + 1) / SHAPE_SLOTS) * (slotSize / 2 - pad);
  ctx.beginPath();
  ctx.arc(slot * slotSize + slotSize / 2, slotSize / 2, Math.max(1, r), 0, Math.PI * 2);
  ctx.fillStyle = '#fff';
  ctx.fill();
}

/**
 * Synchronous procedural atlas (growing circles) — immediately usable while
 * the real SVG atlas loads asynchronously.
 */
export function buildProceduralAtlas(slotSize = 128, pad = 8): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = SHAPE_SLOTS * slotSize;
  canvas.height = slotSize;
  const ctx = canvas.getContext('2d')!;
  for (let i = 0; i < SHAPE_SLOTS; i++) drawFallbackShape(ctx, i, slotSize, pad);
  return canvas;
}

/**
 * Rasterize 7 SVGs into a horizontal atlas of pure white+alpha masks
 * (the shader tints them). Null entries fall back to the bundled default
 * shapes; failed loads fall back to procedural circles. `pad` insets each
 * slot so linear filtering never bleeds across neighbors.
 */
export async function buildShapeAtlas(
  svgTexts: (string | null)[],
  slotSize = 128,
  pad = 8,
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  canvas.width = SHAPE_SLOTS * slotSize;
  canvas.height = slotSize;
  const ctx = canvas.getContext('2d')!;

  const texts = await Promise.all(
    Array.from({ length: SHAPE_SLOTS }, async (_, i) => {
      if (svgTexts[i]) return svgTexts[i];
      try {
        const res = await fetch(DEFAULT_SHAPE_URLS[i]);
        return res.ok ? await res.text() : null;
      } catch {
        return null;
      }
    }),
  );

  const inner = slotSize - pad * 2;
  for (let i = 0; i < SHAPE_SLOTS; i++) {
    const img = texts[i] ? await loadSvgImage(texts[i]!, inner) : null;
    if (img) {
      // fit into the slot's inner box, preserving aspect, centered
      const k = Math.min(inner / img.width, inner / img.height);
      const w = img.width * k;
      const h = img.height * k;
      ctx.drawImage(img, i * slotSize + (slotSize - w) / 2, (slotSize - h) / 2, w, h);
    } else {
      drawFallbackShape(ctx, i, slotSize, pad);
    }
  }

  // collapse any SVG colors to a tintable white mask, alpha preserved
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.globalCompositeOperation = 'source-over';
  return canvas;
}
