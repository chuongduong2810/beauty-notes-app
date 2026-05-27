import { DEFAULT_PALETTE_COLOR_ID } from "./palette";

/**
 * Room and Surface domain types for v2 (ADR-0008, ADR-0010).
 *
 * A Room is a bounded 3D environment containing exactly six Surfaces.
 * The default Room is a 6 m × 6 m × 3 m cuboid; users do not add or
 * remove Surfaces in v2.
 */

export const SURFACE_KINDS = [
  "wall_north",
  "wall_south",
  "wall_east",
  "wall_west",
  "floor",
  "ceiling",
] as const;

export type SurfaceKind = (typeof SURFACE_KINDS)[number];

export type Room = {
  id: string;
  owner_id: string;
  name: string;
  width_m: number;
  depth_m: number;
  height_m: number;
  camera_yaw: number;
  camera_pitch: number;
  created_at: string;
  updated_at: string;
};

export type Surface = {
  id: string;
  room_id: string;
  owner_id: string;
  kind: SurfaceKind;
  color_id: string;
};

/** Default seed Surfaces for a new Room — one per kind, all warm-white. */
export function defaultSurfaces(): Array<Pick<Surface, "kind" | "color_id">> {
  return SURFACE_KINDS.map((kind) => ({
    kind,
    color_id: DEFAULT_PALETTE_COLOR_ID,
  }));
}

/** Default room dimensions (metres). */
export const DEFAULT_ROOM_WIDTH_M = 6;
export const DEFAULT_ROOM_DEPTH_M = 6;
export const DEFAULT_ROOM_HEIGHT_M = 3;
