import { memo, useMemo } from "react";
import {
  BufferGeometry,
  Float32BufferAttribute,
  Line,
  LineBasicMaterial,
} from "three";
import { paletteEntry } from "../lib/palette";
import { strokeWidthMeters, type Stroke } from "../lib/stroke";

/**
 * Renders a Stroke as a polyline on its parent Surface mesh's local
 * plane (ADR-0014, issue #35). The Surface mesh lives in the X-Y plane
 * with its origin at centre; `(u, v) ∈ [0, 1]²` maps to
 * `((u - 0.5) * widthM, (v - 0.5) * heightM)`. A small +Z offset keeps
 * the stroke just in front of the wall so it doesn't z-fight.
 *
 * The tracer-bullet renderer uses Three.js's `LineBasicMaterial`, which
 * draws a 1-pixel polyline regardless of `linewidth` (most platforms
 * cap it at 1). Pressure-weighted tessellated ribbons come in a
 * follow-up — this is enough to verify the data flow end-to-end.
 *
 * The colour is taken from the Palette via `color_id`; we use the
 * darker `shadow` channel so warm-white walls don't swallow the line.
 */
function StrokeMeshImpl({
  stroke,
  surfaceWidthM,
  surfaceHeightM,
}: {
  stroke: Stroke;
  surfaceWidthM: number;
  surfaceHeightM: number;
}) {
  const line = useMemo(() => {
    const positions: number[] = [];
    for (const p of stroke.points) {
      const x = (p.u - 0.5) * surfaceWidthM;
      const y = (p.v - 0.5) * surfaceHeightM;
      positions.push(x, y, 0.0008);
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute(
      "position",
      new Float32BufferAttribute(positions, 3),
    );
    const material = new LineBasicMaterial({
      color: paletteEntry(stroke.color_id).shadow,
      // Hint for platforms that respect it (rare). Real thickness lands
      // when we tessellate the polyline into a ribbon mesh.
      linewidth: Math.max(1, strokeWidthMeters(stroke.width_id) * 1000),
    });
    return new Line(geometry, material);
  }, [stroke.points, stroke.color_id, stroke.width_id, surfaceWidthM, surfaceHeightM]);

  return <primitive object={line} />;
}

export const StrokeMesh = memo(StrokeMeshImpl);
