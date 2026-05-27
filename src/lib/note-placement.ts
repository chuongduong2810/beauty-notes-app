/**
 * Compute the local transform of a Note inside its parent Surface mesh
 * (ADR-0010, issue #15).
 *
 * The Note lives in the Surface's local frame: the Surface's `planeGeometry`
 * is centred at its own origin with [width, height] from `surfaceTransform`,
 * so `(u, v) = (0, 0)` maps to the bottom-left corner `(-W/2, -H/2)` and
 * `(1, 1)` maps to the top-right `(+W/2, +H/2)`. The Note is offset 1 mm
 * forward along the Surface's local +Z (out of the wall, toward the room
 * interior) to avoid z-fighting.
 */
export type NotePlacement = {
  u: number;
  v: number;
  width_cm: number;
  height_cm: number;
  /** [width_m, height_m] of the parent Surface plane in metres. */
  surface_size_m: [number, number];
};

const NOTE_STANDOFF_M = 0.001;
const CM_PER_M = 100;

export function noteLocalTransform(p: NotePlacement): {
  position: [number, number, number];
  size_m: [number, number];
} {
  const [W, H] = p.surface_size_m;
  return {
    position: [(p.u - 0.5) * W, (p.v - 0.5) * H, NOTE_STANDOFF_M],
    size_m: [p.width_cm / CM_PER_M, p.height_cm / CM_PER_M],
  };
}
