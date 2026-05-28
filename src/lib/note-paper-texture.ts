import { CanvasTexture, SRGBColorSpace } from "three";

/**
 * Procedural ruled-paper texture for Note meshes. Runs once at module
 * load (one shared CanvasTexture instance) — every NoteMesh sets it as
 * the material's `map`, which is multiplied against the material's
 * `color`. Because the texture is mostly white with darker rules and
 * grain, the result on a per-palette base hue is palette-coherent:
 *
 *   - cream Note → tan-tinted rules + cream paper grain
 *   - mint Note  → dark-mint rules + mint paper grain
 *
 * The texture is built on a `<canvas>` element so this module is a
 * no-op in non-DOM environments (vitest unit tests, SSR). Callers
 * should treat the return value as nullable.
 */

const TEXTURE_SIZE = 1024;
/** ~7 mm rule spacing on an 18 cm note — matches real ruled paper. */
const HORIZONTAL_LINE_COUNT = 26;
/**
 * Line alpha is intentionally high so that after the texture is
 * multiplied by the material's palette colour and washed by the
 * postprocessing chain (Bloom, ACES tone mapping), the rules are still
 * clearly visible. 0.10 was invisible on pastel bases; 0.40 reads as
 * classic ruled notebook on every palette entry.
 */
const HORIZONTAL_LINE_ALPHA = 0.65;
const MARGIN_LINE_ALPHA = 0.75;
const MARGIN_LINE_OFFSET_RATIO = 0.085;
const GRAIN_AMPLITUDE = 8;
const TOP_HIGHLIGHT_ALPHA = 0.06;
const BOTTOM_SHADOW_ALPHA = 0.04;

export function createPaperTexture(): CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = TEXTURE_SIZE;
  canvas.height = TEXTURE_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // White base — the material's `color` multiplies on top so the final
  // hue is the palette base.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);

  // Subtle vertical gradient: lighter at the top, slightly darker at
  // the bottom. Reads as a paper page lit from above.
  const grad = ctx.createLinearGradient(0, 0, 0, TEXTURE_SIZE);
  grad.addColorStop(0, `rgba(255, 255, 255, ${TOP_HIGHLIGHT_ALPHA})`);
  grad.addColorStop(0.5, "rgba(255, 255, 255, 0)");
  grad.addColorStop(1, `rgba(40, 30, 20, ${BOTTOM_SHADOW_ALPHA})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);

  // Horizontal ruled lines. Near-black + high alpha so the rules
  // survive the postprocessing washes (Bloom + ACES tone-map).
  ctx.strokeStyle = `rgba(15, 12, 8, ${HORIZONTAL_LINE_ALPHA})`;
  ctx.lineWidth = 2.5;
  const lineSpacing = TEXTURE_SIZE / HORIZONTAL_LINE_COUNT;
  for (let i = 1; i < HORIZONTAL_LINE_COUNT; i++) {
    const y = i * lineSpacing;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(TEXTURE_SIZE, y);
    ctx.stroke();
  }

  // Single red margin line, classic notebook-page accent.
  ctx.strokeStyle = `rgba(200, 60, 60, ${MARGIN_LINE_ALPHA})`;
  ctx.lineWidth = 2.5;
  const marginX = TEXTURE_SIZE * MARGIN_LINE_OFFSET_RATIO;
  ctx.beginPath();
  ctx.moveTo(marginX, 0);
  ctx.lineTo(marginX, TEXTURE_SIZE);
  ctx.stroke();

  // Paper grain — per-pixel noise on each channel, very subtle.
  const imgData = ctx.getImageData(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * GRAIN_AMPLITUDE * 2;
    data[i] = Math.max(0, Math.min(255, data[i] + noise));
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise));
  }
  ctx.putImageData(imgData, 0, 0);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}
