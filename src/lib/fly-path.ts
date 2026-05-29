import { Quaternion, Vector3 } from "three";

type Vec3 = [number, number, number];

/**
 * Smoothstep ease-in-out over [0, 1]. Eases the raw transition progress
 * so the fly starts and ends gently — `3t² − 2t³`.
 */
export function smoothstep(t: number): number {
  const c = t < 0 ? 0 : t > 1 ? 1 : t;
  return c * c * (3 - 2 * c);
}

/**
 * Pure, renderer-free camera pose interpolation for the cinematic
 * fly-to-Note transition (issue #67, ADR-0017).
 *
 * Rather than lerping `camera.position` straight to the focus pose — a
 * line that cuts through the room centre for a Note on a wall *behind*
 * the user — we interpolate the camera **relative to its orbit target**:
 *
 *  - decompose `camPos − target` and `focusCamPos − focusTarget` into a
 *    unit direction + a magnitude (distance from target),
 *  - **slerp the direction** so the camera swings around the target on
 *    an arc, **lerp the magnitude** so it dollies in/out smoothly,
 *  - **lerp the orbit target itself** toward the Note centre,
 *  - everything under a smoothstep ease so the motion starts/ends gently.
 *
 * The result is an orbit arc that keeps the camera at a sane radius from
 * the Note (never collapsing through it or the room centre) and stays
 * oriented throughout.
 *
 * @param camPos      Current camera world position `[x, y, z]`.
 * @param target      Current orbit target world position `[x, y, z]`.
 * @param focusCamPos Destination camera world position (from `focusPose`).
 * @param focusTarget Destination orbit target (the Note world centre).
 * @param t           Raw transition progress in `[0, 1]` (eased internally).
 * @returns The interpolated `{ camPos, target }` at progress `t`.
 */
export function flyPose({
  camPos,
  target,
  focusCamPos,
  focusTarget,
  t,
}: {
  camPos: Vec3;
  target: Vec3;
  focusCamPos: Vec3;
  focusTarget: Vec3;
  t: number;
}): { camPos: Vec3; target: Vec3 } {
  const e = smoothstep(t);

  const startTarget = new Vector3(...target);
  const endTarget = new Vector3(...focusTarget);

  // Camera offset vectors relative to each end's orbit target.
  const startOffset = new Vector3(...camPos).sub(startTarget);
  const endOffset = new Vector3(...focusCamPos).sub(endTarget);

  const startDist = startOffset.length();
  const endDist = endOffset.length();

  // Slerp the offset DIRECTION via a rotation between the two unit
  // vectors. If either offset is degenerate (camera sitting on its
  // target) there's no meaningful direction to swing through, so fall
  // back to the non-degenerate end's direction.
  const startDir =
    startDist > 1e-9 ? startOffset.clone().divideScalar(startDist) : null;
  const endDir = endDist > 1e-9 ? endOffset.clone().divideScalar(endDist) : null;

  let dir: Vector3;
  if (startDir && endDir) {
    const q = new Quaternion().slerp(
      new Quaternion().setFromUnitVectors(startDir, endDir),
      e,
    );
    dir = startDir.clone().applyQuaternion(q);
  } else {
    dir = (endDir ?? startDir ?? new Vector3(0, 0, 1)).clone();
  }

  // Lerp distance and the orbit target independently.
  const dist = startDist + (endDist - startDist) * e;
  const tgt = startTarget.clone().lerp(endTarget, e);
  const cam = tgt.clone().add(dir.multiplyScalar(dist));

  return {
    camPos: [cam.x, cam.y, cam.z],
    target: [tgt.x, tgt.y, tgt.z],
  };
}
