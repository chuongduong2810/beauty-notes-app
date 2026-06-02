/**
 * Pure, GPU-free hit test for the Eraser tool (issue #132). Given an
 * eraser point and a Stroke's polyline (both in Surface-normalized
 * `(u, v)` space, 0..1), decides whether the eraser is close enough to
 * the Stroke to remove it.
 *
 * The Eraser erases the PORTION of a Stroke it passes over (partial,
 * point-level erasing): {@link splitStrokeByEraser} drops the points within
 * the eraser radius and returns the surviving runs as separate fragments, so
 * a pass through the middle of a line leaves its two ends behind.
 * {@link strokeHitByEraser} (minimum point-to-SEGMENT distance) is the cheaper
 * "does the eraser touch this Stroke at all" yes/no test, kept for callers
 * that only need a boolean.
 */

/**
 * Eraser hit radius in Surface-normalized `(u, v)` units (~3% of a
 * Surface edge). Small enough to feel precise, large enough that a quick
 * drag across a Stroke reliably catches it without pixel-perfect aim.
 */
export const ERASER_RADIUS_UV = 0.03;

/**
 * The selectable Eraser sizes, as radii in Surface-normalized `(u, v)` units.
 * Like the Stroke width palette, the Eraser offers a small fixed set rather
 * than a free slider; the store holds the active `eraserRadius` and the
 * toolbar lets the User switch between these. The medium size equals
 * {@link ERASER_RADIUS_UV}, the default.
 */
export const ERASER_SIZES = [
  { id: "small", label: "S", radius: 0.018 },
  { id: "medium", label: "M", radius: ERASER_RADIUS_UV },
  { id: "large", label: "L", radius: 0.055 },
] as const;

/** The Eraser size selected by default — the medium radius. */
export const DEFAULT_ERASER_RADIUS_UV = ERASER_RADIUS_UV;

/** Squared distance from point `p` to the segment `a`→`b`, in `(u, v)`. */
function distanceSqPointToSegment(
  p: { u: number; v: number },
  a: { u: number; v: number },
  b: { u: number; v: number },
): number {
  const abu = b.u - a.u;
  const abv = b.v - a.v;
  const apu = p.u - a.u;
  const apv = p.v - a.v;
  const lenSq = abu * abu + abv * abv;
  // Degenerate segment (a === b): distance to the shared point.
  if (lenSq === 0) return apu * apu + apv * apv;
  // Project p onto the segment, clamping t to [0, 1] so the nearest
  // point stays on the segment rather than its infinite line.
  let t = (apu * abu + apv * abv) / lenSq;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const du = apu - t * abu;
  const dv = apv - t * abv;
  return du * du + dv * dv;
}

/**
 * Whether an eraser at `eraser` touches the Stroke described by
 * `strokePoints` within `radius` (all in Surface-normalized `(u, v)`).
 *
 * @param strokePoints - the Stroke's ordered polyline points. An empty
 *   array never hits (false); a single point is treated as point-distance.
 * @param eraser - the eraser cursor's `(u, v)` on the same Surface.
 * @param radius - the hit radius in `(u, v)` units (e.g. {@link ERASER_RADIUS_UV}).
 * @returns true when the minimum point-to-polyline distance is ≤ `radius`.
 */
export function strokeHitByEraser(
  strokePoints: { u: number; v: number }[],
  eraser: { u: number; v: number },
  radius: number,
): boolean {
  if (strokePoints.length === 0) return false;
  const radiusSq = radius * radius;
  // Single-point Stroke: no segment to project onto, so compare the
  // point distance directly.
  if (strokePoints.length === 1) {
    const du = eraser.u - strokePoints[0].u;
    const dv = eraser.v - strokePoints[0].v;
    return du * du + dv * dv <= radiusSq;
  }
  for (let i = 0; i < strokePoints.length - 1; i++) {
    const distSq = distanceSqPointToSegment(
      eraser,
      strokePoints[i],
      strokePoints[i + 1],
    );
    if (distSq <= radiusSq) return true;
  }
  return false;
}

/**
 * Split a Stroke's points by an eraser pass: drop the points within `radius`
 * of `eraser` and return the surviving runs of consecutive kept points — each
 * run is a fragment of the original Stroke. This is the "real eraser" model:
 * dragging clears the line where it passes and leaves the parts it didn't
 * touch, rather than deleting the whole Stroke.
 *
 * Point-level removal (real Strokes are densely sampled, so a drag clears the
 * line smoothly). Runs shorter than 2 points are dropped — a single point
 * can't render as a polyline. The generic preserves the caller's point shape,
 * so per-point pressure / time ride along into each fragment.
 *
 * @param points - the Stroke's ordered points (each at least `{ u, v }`).
 * @param eraser - the eraser cursor's `(u, v)` on the same Surface.
 * @param radius - removal radius in `(u, v)` units (e.g. {@link ERASER_RADIUS_UV}).
 * @returns the surviving fragments: `[points]` (one run, every point) when
 *   nothing was erased, `[]` when every point fell inside the eraser. Callers
 *   detect "unchanged" via `runs.length === 1 && runs[0].length === points.length`.
 */
export function splitStrokeByEraser<P extends { u: number; v: number }>(
  points: readonly P[],
  eraser: { u: number; v: number },
  radius: number,
): P[][] {
  const radiusSq = radius * radius;
  const runs: P[][] = [];
  let current: P[] = [];
  for (const pt of points) {
    const du = pt.u - eraser.u;
    const dv = pt.v - eraser.v;
    if (du * du + dv * dv <= radiusSq) {
      // Inside the eraser → drop this point, ending the current run.
      if (current.length > 0) {
        runs.push(current);
        current = [];
      }
    } else {
      current.push(pt);
    }
  }
  if (current.length > 0) runs.push(current);
  return runs.filter((run) => run.length >= 2);
}
