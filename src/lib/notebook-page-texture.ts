import { CanvasTexture, SRGBColorSpace } from "three";

/**
 * Procedural ruled-paper texture for the open Notebook's pages
 * (issue #57 follow-up). Distinct from the Note `createPaperTexture`:
 * the Notes' rules are pushed near-black + thick to survive close-up
 * focus-mode postprocessing, which reads heavy and grey at the
 * Notebook's normal viewing distance. These pages instead use a warm
 * cream base with thin, soft blue-grey rules and a faded red margin —
 * matching the cosy "real ruled notebook" reference.
 *
 * Built on a `<canvas>` so this is a no-op (null) in non-DOM test/SSR
 * environments; callers treat the result as nullable.
 */

const TEXTURE_SIZE = 1024;
/** Rule count across the page — finer than the Note paper. */
const LINE_COUNT = 30;

export function createNotebookPageTexture(): CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = TEXTURE_SIZE;
  canvas.height = TEXTURE_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // Warm cream base.
  ctx.fillStyle = "#f7f1e1";
  ctx.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);

  // Soft top-lit gradient — lighter at the top, a touch warmer-dark at
  // the bottom so the page reads as paper lit from above.
  const grad = ctx.createLinearGradient(0, 0, 0, TEXTURE_SIZE);
  grad.addColorStop(0, "rgba(255, 255, 255, 0.10)");
  grad.addColorStop(0.5, "rgba(255, 255, 255, 0)");
  grad.addColorStop(1, "rgba(70, 52, 32, 0.05)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);

  // Thin, soft blue-grey horizontal rules.
  ctx.strokeStyle = "rgba(78, 100, 132, 0.5)";
  ctx.lineWidth = 2;
  const lineSpacing = TEXTURE_SIZE / LINE_COUNT;
  for (let i = 1; i < LINE_COUNT; i++) {
    const y = i * lineSpacing;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(TEXTURE_SIZE, y);
    ctx.stroke();
  }

  // Faded red margin line near the left edge.
  ctx.strokeStyle = "rgba(196, 84, 72, 0.6)";
  ctx.lineWidth = 2.5;
  const marginX = TEXTURE_SIZE * 0.1;
  ctx.beginPath();
  ctx.moveTo(marginX, 0);
  ctx.lineTo(marginX, TEXTURE_SIZE);
  ctx.stroke();

  // Very subtle paper grain.
  const imgData = ctx.getImageData(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 8;
    data[i] = Math.max(0, Math.min(255, data[i] + noise));
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise));
  }
  ctx.putImageData(imgData, 0, 0);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 16;
  texture.needsUpdate = true;
  return texture;
}
