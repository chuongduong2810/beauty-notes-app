/**
 * Pure helper for the camera-following shadow frustum (#34).
 *
 * The directional "window" key light is positioned relative to the
 * orbit target rather than the world origin so the shadow camera's
 * bounded frustum always covers what the user is looking at. The light
 * direction stays constant — only the world position of the light and
 * its lookAt change as the orbit target moves.
 */

/**
 * Offset of the key light from the orbit target, in metres. Encodes
 * the "warm window from upper-right" art direction baked into App.tsx
 * before this issue (light at `[1.8, 2.6, 2.2]`, orbit target at
 * `[0, 1.5, 0]` — offset is the difference).
 */
export const KEY_LIGHT_OFFSET_M: readonly [number, number, number] = [
  1.8,
  1.1,
  2.2,
];

export type LightPose = {
  position: [number, number, number];
  lookAt: [number, number, number];
};

export function shadowFollowPose(
  orbitTarget: readonly [number, number, number],
): LightPose {
  return {
    position: [
      orbitTarget[0] + KEY_LIGHT_OFFSET_M[0],
      orbitTarget[1] + KEY_LIGHT_OFFSET_M[1],
      orbitTarget[2] + KEY_LIGHT_OFFSET_M[2],
    ],
    lookAt: [orbitTarget[0], orbitTarget[1], orbitTarget[2]],
  };
}
