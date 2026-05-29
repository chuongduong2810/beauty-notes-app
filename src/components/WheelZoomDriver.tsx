import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Raycaster, Vector2, Vector3 } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { useDebugStore } from "../lib/debug-store";

/**
 * Scene-aware wheel zoom that replaces OrbitControls' built-in dolly.
 *
 * Why we can't use OrbitControls' `zoomToCursor`: with a perspective
 * camera, its dolly math is `camera += dollyDirection * (prevRadius -
 * newRadius)` where `prevRadius * scale → newRadius` decays
 * geometrically. After the tick `screenSpacePanning` snaps target to
 * `camera + forward * newRadius`, so the next `prevRadius =
 * newRadius`. Total camera movement over infinite ticks =
 * initialRadius — the camera asymptotes to a point in mid-air at most
 * initialRadius along the cursor ray from the start, never the wall.
 *
 * This driver does two things:
 *
 * 1) **Scene-hit targeting** — on each wheel event, raycast the
 *    cursor into the scene and find the actual mesh under it. The
 *    dolly target is the hit point; each tick moves a fraction of
 *    the REMAINING distance, so the asymptote is the wall itself —
 *    not a bounded fraction of starting radius.
 *
 * 2) **Damped follow** — wheel events accumulate into `pendingDelta`,
 *    a Vector3 that represents the unapplied camera+target movement.
 *    Each frame, `useFrame` consumes a fraction (LERP) of pendingDelta
 *    and applies it to camera + orbit target. Multiple fast wheel
 *    ticks stack into one smooth glide — same feel as OrbitControls'
 *    `enableDamping` for rotation, just on the zoom axis.
 *
 * Camera and target move by the same delta so the orbit pivot stays
 * at a fixed offset from the camera — rotation around your current
 * vantage keeps working naturally.
 */
const ZOOM_IN_FRACTION_PER_TICK = 0.35;
/** Out-zoom backs off by a fixed distance per tick — there's no
 *  "remaining distance" target for outward motion. */
const ZOOM_OUT_STEP_M = 0.5;
/** Don't dolly closer than this to the hit point, so the camera
 *  doesn't pass through geometry. */
const MIN_HIT_GAP_M = 0.02;
/** Per-frame interpolation rate used to apply pendingDelta. 0.18 is
 *  comparable to OrbitControls' default damping feel. */
const LERP_PER_FRAME = 0.18;
/** Stop the per-frame loop once pendingDelta is below this length. */
const SETTLE_EPS_M = 0.0005;

export function WheelZoomDriver({
  orbitRef,
}: {
  orbitRef: React.MutableRefObject<OrbitControlsImpl | null>;
}) {
  const { camera, scene, gl } = useThree();
  const raycaster = useMemo(() => new Raycaster(), []);
  const pendingDelta = useRef(new Vector3());
  const update = useDebugStore((s) => s.update);

  useFrame(() => {
    const c = orbitRef.current;
    if (!c) return;
    if (pendingDelta.current.lengthSq() < SETTLE_EPS_M * SETTLE_EPS_M) {
      if (pendingDelta.current.lengthSq() > 0) pendingDelta.current.set(0, 0, 0);
      return;
    }
    const step = pendingDelta.current.clone().multiplyScalar(LERP_PER_FRAME);
    camera.position.add(step);
    c.target.add(step);
    pendingDelta.current.sub(step);
    c.update();
  });

  useEffect(() => {
    const dom = gl.domElement;
    const onWheel = (e: WheelEvent) => {
      const c = orbitRef.current;
      // FocusDriver disables controls while animating focus in/out —
      // don't fight it.
      if (!c || !c.enabled) return;
      e.preventDefault();

      const rect = dom.getBoundingClientRect();
      const ndc = new Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(ndc, camera);
      const hits = raycaster.intersectObjects(scene.children, true);
      if (hits.length === 0) return;
      const hitPoint = hits[0].point;

      const direction = new Vector3().subVectors(hitPoint, camera.position);
      const distToHit = direction.length();
      direction.normalize();

      let stepM: number;
      if (e.deltaY < 0) {
        // Zoom in — fraction of remaining gap, capped so we don't
        // overshoot the geometry.
        const maxAllowed = Math.max(0, distToHit - MIN_HIT_GAP_M);
        stepM = Math.min(distToHit * ZOOM_IN_FRACTION_PER_TICK, maxAllowed);
      } else {
        stepM = -ZOOM_OUT_STEP_M;
      }
      if (stepM === 0) return;

      pendingDelta.current.add(
        direction.clone().multiplyScalar(stepM),
      );

      update({
        lastWheelDelta: e.deltaY,
        lastWheelCursor: [ndc.x, ndc.y],
        lastDistBefore: camera.position.distanceTo(c.target),
        lastDistAfter: camera.position
          .clone()
          .add(pendingDelta.current)
          .distanceTo(c.target.clone().add(pendingDelta.current)),
      });
    };
    dom.addEventListener("wheel", onWheel, { passive: false });
    return () => dom.removeEventListener("wheel", onWheel);
  }, [camera, scene, gl, raycaster, orbitRef, update]);

  return null;
}
