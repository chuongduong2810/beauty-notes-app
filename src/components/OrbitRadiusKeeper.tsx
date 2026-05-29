import { useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Vector3 } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

/**
 * Defeats OrbitControls' built-in zoom asymptote without replacing
 * its wheel handler.
 *
 * The asymptote: with a perspective camera + zoomToCursor +
 * screenSpacePanning, each wheel tick does
 *   camera += dollyDirection * (prevRadius − newRadius)
 *   target  = camera + forward * newRadius
 * with `newRadius = prevRadius * scale`. So the next `prevRadius =
 * newRadius`, decaying geometrically. Total camera movement over
 * infinite ticks is capped at `initialRadius` along the cursor ray —
 * the camera asymptotes to a point in mid-air, never the wall.
 *
 * The fix here is mechanical: every frame, AFTER OrbitControls
 * applies its dolly + damping, check the camera-to-target distance.
 * If it dropped below `MIN_ORBIT_RADIUS`, push the target back out
 * along the camera's forward direction so the radius is restored.
 * This means the NEXT wheel tick's `prevRadius` is always ≥
 * MIN_ORBIT_RADIUS — the per-tick dolly amount stays roughly
 * constant and the cap disappears. Wheel as many ticks as you like
 * and you can press the camera right up to a wall.
 *
 * OrbitControls' damping handles the smoothness; this component
 * only nudges the target between frames.
 */
const MIN_ORBIT_RADIUS = 1.0;

export function OrbitRadiusKeeper({
  orbitRef,
}: {
  orbitRef: React.MutableRefObject<OrbitControlsImpl | null>;
}) {
  const tmpForward = useMemo(() => new Vector3(), []);

  // Priority 0 → runs AFTER drei's OrbitControls update at priority
  // -1, so we observe the post-dolly state and correct it.
  useFrame(() => {
    const c = orbitRef.current;
    if (!c) return;
    // While FocusDriver is animating focus in/out it disables
    // controls and owns the camera pose — don't interfere.
    if (!c.enabled) return;
    const radius = c.object.position.distanceTo(c.target);
    if (radius >= MIN_ORBIT_RADIUS) return;
    // Push target out along the camera's current forward direction
    // so the orbit pivot sits MIN_ORBIT_RADIUS in front of the
    // camera — orbit rotation stays anchored to whatever the camera
    // is looking at.
    tmpForward.set(0, 0, -1).transformDirection(c.object.matrix);
    c.target
      .copy(c.object.position)
      .addScaledVector(tmpForward, MIN_ORBIT_RADIUS);
  });

  return null;
}
