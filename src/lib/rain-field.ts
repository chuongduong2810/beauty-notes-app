/**
 * The City's falling-rain VOLUME (issue #43, ADR-0015, ADR-0024).
 *
 * Per CONTEXT.md the **Weather** is a fixed, always-rainy ambient mood: not
 * user-configurable, not persisted. This module owns only *where the rain
 * lives* — the world-space slab the downpour is confined to. Since ADR-0024
 * the motion belongs to the three.quarks particle engine (`CityRain`), which
 * owns its own RNG; this module no longer steps individual drops. Keeping the
 * slab here (pure and testable, no GPU) preserves the ADR-0015 containment
 * invariant: the whole volume sits beyond the west wall, so no drop can ever
 * enter the Room interior.
 *
 * Coordinate frame: Three.js world metres, Y up, Room centre on the floor
 * at the origin. The west wall plane (the Room boundary) is at
 * x = -width_m / 2; the City — and therefore the rain — lives strictly
 * beyond it (x < -width_m / 2), so no drop ever enters the Room interior.
 */

/** An axis-aligned slab of world space the rain falls within (metres). */
export type RainBounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
};

/** Gap (m) kept clear in front of the nearest buildings for near rain. */
const NEAR_GAP_M = 3;
/** Depth (m) of the rain slab, receding from the near edge into the City. */
const SLAB_DEPTH_M = 26;
/** Sky ceiling the rain falls from (m above the ground). */
const SKY_TOP_M = 30;

/**
 * The rain volume for a Room of the given width, derived so the slab sits
 * wholly beyond the west wall (outside the Room) yet within the camera's
 * view through the Window. Z-spread tracks the skyline width, matching
 * `buildingLayout`'s `width_m * 2.5` spread.
 *
 * @param width_m Room width (metres); the west wall plane is at -width_m/2.
 */
export function RAIN_BOUNDS(width_m: number): RainBounds {
  const wallX = -width_m / 2;
  const nearX = wallX - NEAR_GAP_M;
  const zSpread = width_m * 2.5;
  return {
    minX: nearX - SLAB_DEPTH_M,
    maxX: nearX,
    minY: 0,
    maxY: SKY_TOP_M,
    minZ: -zSpread / 2,
    maxZ: zSpread / 2,
  };
}
