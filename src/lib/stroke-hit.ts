/**
 * Pure, GPU-free hit test for the Eraser tool (issue #132). Given an
 * eraser point and a Stroke's polyline (both in Surface-normalized
 * `(u, v)` space, 0..1), decides whether the eraser is close enough to
 * the Stroke to remove it.
 *
 * Erase granularity is whole-Stroke (matching the repo's `deleteStroke`):
 * touching ANY part of a Stroke's polyline removes the entire Stroke —
 * there is no pixel- or segment-level splitting. So the test measures the
 * minimum distance from the eraser point to the Stroke's polyline (the
 * point-to-SEGMENT distance over each consecutive pair of points, not
 * just the vertices) and compares it against the eraser radius.
 */

/**
 * Eraser hit radius in Surface-normalized `(u, v)` units (~3% of a
 * Surface edge). Small enough to feel precise, large enough that a quick
 * drag across a Stroke reliably catches it without pixel-perfect aim.
 */
export const ERASER_RADIUS_UV = 0.03;

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
