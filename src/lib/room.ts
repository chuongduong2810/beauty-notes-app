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
  /** Orbit camera state, persisted per Room (ADR-0009). */
  camera_yaw: number;
  camera_pitch: number;
  camera_distance: number;
  created_at: string;
  updated_at: string;
};

/** Default orbit camera pose for a freshly-created Room. */
export const DEFAULT_CAMERA_YAW = 0;
export const DEFAULT_CAMERA_PITCH = Math.PI / 2; // horizontal, eye level
export const DEFAULT_CAMERA_DISTANCE = 1.8;

export type Surface = {
  id: string;
  room_id: string;
  owner_id: string;
  kind: SurfaceKind;
  color_id: string;
};

/**
 * A Note Pinned to exactly one Surface at normalized `(u, v) ∈ [0, 1]²`
 * (ADR-0010). Dimensions in centimetres.
 */
export type Note = {
  id: string;
  surface_id: string;
  owner_id: string;
  u: number;
  v: number;
  width_cm: number;
  height_cm: number;
  body: string;
  color_id: string;
  created_at: string;
  updated_at: string;
};

export type NewNote = Omit<Note, "id" | "created_at" | "updated_at">;

/**
 * Default Note dimensions on create (centimetres).
 *
 * Real sticky notes are ~7–12 cm, but at that physical scale inside a
 * 6 × 6 × 3 m Room they read as a single visible square from across the
 * room. We bump the default to a paper-page-ish size so a freshly-Pinned
 * Note is legible at default zoom; users can resize later.
 */
export const DEFAULT_NOTE_WIDTH_CM = 24;
export const DEFAULT_NOTE_HEIGHT_CM = 18;

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
