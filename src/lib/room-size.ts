/**
 * Curated Room-size presets (room resize, a Studio Entitlement).
 *
 * Resizing the Room is premium Customization. In keeping with the product's
 * "no raw values" philosophy (the Palette stores `color_id`s, the Catalog
 * stores Item ids — never raw hex or model paths), the User picks from a
 * small curated set of named sizes rather than typing dimensions. A Room
 * stores its actual `width_m/depth_m/height_m` (those columns predate this
 * feature, ADR-0008); a preset is just a friendly bundle of dimensions and
 * the applied preset is derived from the Room's current dimensions.
 *
 * Kept renderer-free and side-effect-free so the resolve/compare rules are
 * unit-testable without the store or an R3F canvas.
 */

/** A named Room size. `id` is stable; dimensions are in metres. */
export type RoomSizePreset = {
  id: string;
  label: string;
  /** Short descriptor shown under the label in the picker. */
  blurb: string;
  width_m: number;
  depth_m: number;
  height_m: number;
};

/**
 * The curated sizes, in ascending floor-area order. `standard` matches the
 * default 6 × 6 × 3 Room (ADR-0008), so an un-resized Room reads as
 * "Standard" rather than "Custom".
 */
export const ROOM_SIZE_PRESETS: readonly RoomSizePreset[] = [
  {
    id: "cozy",
    label: "Cozy",
    blurb: "Snug & intimate",
    width_m: 4.5,
    depth_m: 4.5,
    height_m: 2.7,
  },
  {
    id: "standard",
    label: "Standard",
    blurb: "The classic room",
    width_m: 6,
    depth_m: 6,
    height_m: 3,
  },
  {
    id: "grand",
    label: "Grand",
    blurb: "Airy & spacious",
    width_m: 8,
    depth_m: 8,
    height_m: 3.6,
  },
] as const;

/** The dimensions the resolver compares against, a subset of a Room. */
export type RoomDimensions = {
  width_m: number;
  depth_m: number;
  height_m: number;
};

/**
 * Look up a size preset by id.
 *
 * @param id - a preset id (e.g. `"standard"`).
 * @returns the matching preset, or `undefined` if the id is unknown.
 */
export function roomSizePresetById(id: string): RoomSizePreset | undefined {
  return ROOM_SIZE_PRESETS.find((p) => p.id === id);
}

/** Float tolerance for matching stored dimensions to a preset. */
const DIM_EPSILON = 1e-3;

/**
 * Resolve which preset a Room's dimensions currently match.
 *
 * @param dims - the Room's `width_m/depth_m/height_m`.
 * @returns the matching preset id, or `null` when the dimensions match no
 *   preset (a "Custom"-sized Room — possible for legacy/edited Rooms).
 */
export function appliedRoomSizePresetId(dims: RoomDimensions): string | null {
  const match = ROOM_SIZE_PRESETS.find(
    (p) =>
      Math.abs(p.width_m - dims.width_m) < DIM_EPSILON &&
      Math.abs(p.depth_m - dims.depth_m) < DIM_EPSILON &&
      Math.abs(p.height_m - dims.height_m) < DIM_EPSILON,
  );
  return match ? match.id : null;
}
