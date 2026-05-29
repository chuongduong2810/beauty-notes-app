/**
 * Pure layout helpers for the Window + City set-dressing (issue #42,
 * ADR-0015).
 *
 * Per ADR-0015 the Window is decoration rendered in FRONT of `wall_west`
 * (like the desk / lamp / plant in `RoomFurniture`) — it is NOT a Surface,
 * NOT persisted, and NOT a seventh member of the six Surfaces. The City
 * is a procedural skyline that lives OUTSIDE the Room boundary, beyond the
 * west wall plane, so that orbiting the Camera produces real parallax.
 *
 * All geometry here is deterministic: variety comes from a seeded PRNG,
 * never `Math.random`, so the skyline is identical on every render and
 * across reloads (the codebase forbids module/render-time nondeterminism).
 *
 * NOTE: every transform is computed from the Room's `width_m / depth_m /
 * height_m` so the layout already scales if Rooms ever become resizable.
 * The consuming component hard-codes the default 6 × 6 × 3 m Room.
 */

export type Vec3 = [number, number, number];

/**
 * A single City building, expressed as an axis-aligned box in world
 * coordinates (Three.js, Y up, metres). The Room centre on the floor is
 * the origin; the west wall plane is at x = -width_m / 2.
 */
export type Building = {
  /** World position of the box centre, in metres. */
  position: Vec3;
  /** Box dimensions: [width along X, height along Y, depth along Z]. */
  size: Vec3;
  /** Which parallax layer this building belongs to (0 = nearest). */
  depthLayer: number;
  /** Index into the building palette, for deterministic colour variety. */
  colorIndex: number;
};

/** Placement of the set-dressing Window within the wall_west plane. */
export type WindowPlacement = {
  /** Opening width, along the wall's local X (the Room's depth axis), m. */
  width: number;
  /** Opening height, along the wall's local Y (the Room's height axis), m. */
  height: number;
  /** Centre of the opening in the wall's local (x, y) plane, metres. */
  center: [number, number];
};

/** Number of parallax depth layers in the skyline. */
export const CITY_DEPTH_LAYERS = 4;

/** Buildings per depth layer. */
const BUILDINGS_PER_LAYER = 5;

/** Gap between the west wall plane and the nearest layer of buildings, m. */
const NEAR_GAP_M = 4;

/** Extra distance pushed behind the wall for each successive layer, m. */
const LAYER_SPACING_M = 7;

/**
 * Deterministic [0, 1) pseudo-random generator (mulberry32). Seeded so the
 * skyline is stable — no `Math.random` at module or render time.
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

/** Map a [0, 1) sample to [min, max). */
function lerp(rand: number, min: number, max: number): number {
  return min + rand * (max - min);
}

/**
 * Compute the set-dressing Window's placement on the wall_west plane.
 *
 * The wall plane spans `depth_m` along its local X and `height_m` along
 * its local Y. The Window is centred horizontally, sits at eye level, and
 * keeps a comfortable margin on every edge so the frame never clips the
 * Surface boundary.
 *
 * @param _width_m Room width (metres) — unused for the Window itself but
 *   kept in the signature so all set-dressing helpers share one shape and
 *   scale uniformly if Rooms become resizable.
 * @param depth_m  Room depth (metres) — the wall_west plane's local width.
 * @param height_m Room height (metres) — the wall_west plane's local height.
 */
export function windowPlacement(
  _width_m: number,
  depth_m: number,
  height_m: number,
): WindowPlacement {
  // Fill ~70% of the wall width and ~55% of its height, centred, with the
  // sill a little above eye level so the skyline reads through it.
  const width = depth_m * 0.7;
  const height = height_m * 0.55;
  const centerY = height_m * 0.55;
  return {
    width,
    height,
    center: [0, centerY],
  };
}

/**
 * Generate the procedural City skyline behind the west wall.
 *
 * Buildings are arranged in {@link CITY_DEPTH_LAYERS} layers receding from
 * the wall along -X. Each successive layer sits further behind the wall
 * (so near and far buildings separate under camera orbit) and spans the
 * full width of the wall along Z, scaled by `width_m` so a wider Room gets
 * a wider skyline. Heights, widths, depths, lateral offsets and colours
 * all vary via a fixed seed for a calm-but-non-repeating silhouette.
 *
 * @param width_m Room width (metres). Sets the west wall plane at
 *   x = -width_m / 2 (the Room boundary) and the Z-spread of the skyline.
 * @returns One {@link Building} per slot, every one strictly beyond the
 *   west wall plane (outside the Room volume).
 */
export function buildingLayout(width_m: number): Building[] {
  const wallX = -width_m / 2;
  // Spread buildings along Z proportionally to the wall width so the
  // skyline always fills the view through the window.
  const zSpread = width_m * 2.5;
  const rand = seededRandom(0x42_0c17);
  const buildings: Building[] = [];

  for (let layer = 0; layer < CITY_DEPTH_LAYERS; layer++) {
    // The far face of THIS layer (its centre minus half-depth) recedes by
    // NEAR_GAP_M + layer * LAYER_SPACING_M behind the wall. We anchor each
    // building's NEAR face at that distance so deeper layers never poke in
    // front of nearer ones, then the box extends further away (-X).
    const layerSetback = NEAR_GAP_M + layer * LAYER_SPACING_M;
    for (let i = 0; i < BUILDINGS_PER_LAYER; i++) {
      const depth = lerp(rand(), 1.5, 3.5);
      const buildingWidth = lerp(rand(), 1.2, 2.8);
      // Far layers are taller on average — exaggerates the depth cue.
      const minH = 2 + layer * 1.5;
      const maxH = 5 + layer * 3;
      const height = lerp(rand(), minH, maxH);

      // Even lateral distribution along Z with a jittered offset so the
      // grid never looks like a regular comb.
      const slot = (i + 0.5) / BUILDINGS_PER_LAYER; // 0..1 across the span
      const jitter = lerp(rand(), -0.4, 0.4) * (zSpread / BUILDINGS_PER_LAYER);
      const z = (slot - 0.5) * zSpread + jitter;

      // Near face anchored at the layer setback; box extends away (-X).
      const nearFaceX = wallX - layerSetback;
      const x = nearFaceX - depth / 2;

      buildings.push({
        position: [x, height / 2, z],
        size: [depth, height, buildingWidth],
        depthLayer: layer,
        colorIndex: Math.floor(rand() * 1000),
      });
    }
  }

  return buildings;
}
