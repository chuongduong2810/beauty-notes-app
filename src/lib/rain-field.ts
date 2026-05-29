/**
 * Pure, deterministic helpers for the City's falling rain (issue #43,
 * ADR-0015).
 *
 * Per CONTEXT.md the **Weather** is a fixed, always-rainy ambient mood:
 * not user-configurable, not persisted. This module owns only the maths —
 * where the rain volume sits, where each drop starts, and how a drop falls
 * and recycles — so the behaviour is testable without a GPU. The renderer
 * (`CityView`) consumes these and pushes the result into a `Points` cloud.
 *
 * Like `city-layout.ts`, all variety comes from a seeded PRNG (mulberry32),
 * never `Math.random` at module or render time, so the field is identical
 * on every render and across reloads.
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

/**
 * A cloud of raindrops as flat typed arrays, ready to feed a Three.js
 * `BufferAttribute`. `positions` is interleaved `[x, y, z, x, y, z, …]`
 * with `count` drops; `speeds[i]` is drop `i`'s fall rate in m/s.
 */
export type RainField = {
  count: number;
  positions: Float32Array;
  speeds: Float32Array;
};

/** Result of advancing one drop by one frame. */
export type SteppedDrop = {
  x: number;
  y: number;
  z: number;
  /** True when the drop passed the ground and wrapped back to the top. */
  recycled: boolean;
};

/** Gap (m) kept clear in front of the nearest buildings for near rain. */
const NEAR_GAP_M = 3;
/** Depth (m) of the rain slab, receding from the near edge into the City. */
const SLAB_DEPTH_M = 26;
/** Sky ceiling the rain falls from (m above the ground). */
const SKY_TOP_M = 30;
/** Fall speed range (m/s) — calm rain, gently varied per drop. */
const MIN_SPEED = 6;
const MAX_SPEED = 11;

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

/**
 * Deterministic [0, 1) pseudo-random generator (mulberry32), reusing the
 * same approach as `city-layout.ts` so the rain is stable across renders.
 */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Map a [0, 1) sample to [min, max]. */
function lerp(rand: number, min: number, max: number): number {
  return min + rand * (max - min);
}

/**
 * Generate `count` raindrops uniformly scattered through `bounds`, each
 * with a slightly varied fall speed. Deterministic for a given `seed`.
 *
 * @param count  Number of drops (the renderer caps this a few thousand).
 * @param bounds The world-space slab to fill (see {@link RAIN_BOUNDS}).
 * @param seed   PRNG seed; the same seed always yields the same field.
 */
export function createRainField(
  count: number,
  bounds: RainBounds,
  seed: number,
): RainField {
  const rand = seededRandom(seed);
  const positions = new Float32Array(count * 3);
  const speeds = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = lerp(rand(), bounds.minX, bounds.maxX);
    positions[i * 3 + 1] = lerp(rand(), bounds.minY, bounds.maxY);
    positions[i * 3 + 2] = lerp(rand(), bounds.minZ, bounds.maxZ);
    speeds[i] = lerp(rand(), MIN_SPEED, MAX_SPEED);
  }
  return { count, positions, speeds };
}

/**
 * Advance one raindrop by one frame. The drop falls straight down at
 * `speed` m/s; when it passes below `bounds.minY` it is recycled to the
 * top of the slab — keeping its X and Z (same column) so the loop is
 * seamless and the drop count stays constant. The vertical overshoot is
 * folded back from the ceiling so even a very large `dt` lands in-bounds.
 *
 * @param x     Current X (metres) — preserved on recycle.
 * @param y     Current Y (metres).
 * @param z     Current Z (metres) — preserved on recycle.
 * @param speed Fall speed (m/s).
 * @param dt    Frame delta (seconds).
 * @param bounds The rain slab; `minY`/`maxY` bound the fall.
 */
export function stepRaindrop(
  x: number,
  y: number,
  z: number,
  speed: number,
  dt: number,
  bounds: RainBounds,
): SteppedDrop {
  const nextY = y - speed * dt;
  if (nextY >= bounds.minY) {
    return { x, y: nextY, z, recycled: false };
  }
  // Below the ground: wrap the overshoot back down from the ceiling so the
  // column keeps a continuous stream rather than popping to a fixed height.
  const span = bounds.maxY - bounds.minY;
  const overshoot = bounds.minY - nextY; // > 0
  const wrappedY = bounds.maxY - (overshoot % span);
  return { x, y: wrappedY, z, recycled: true };
}
