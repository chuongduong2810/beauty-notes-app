/**
 * Annotation + Stroke domain types for v2 (ADR-0014, issue #35).
 *
 * An Annotation is a list of vector Strokes drawn on one Surface. Each
 * Stroke is a continuous pen-down → pen-up gesture: a polyline of
 * `(u, v)` points (Surface-normalized 0..1) with normalized pressure
 * `p ∈ [0, 1]` and a timestamp `t` (ms since the gesture started).
 *
 * The width palette is fixed at four real-world widths (mm), reused for
 * both rendering thickness and the future Pen sub-menu UI. Storing the
 * id (not the metres value) lets us retune the palette globally without
 * a data migration — same rationale as the colour Palette.
 */

export const STROKE_WIDTH_IDS = ["fine", "medium", "bold", "marker"] as const;

export type StrokeWidthId = (typeof STROKE_WIDTH_IDS)[number];

/** Real-world width per id, in metres, matched at the Surface plane. */
const STROKE_WIDTH_M: Record<StrokeWidthId, number> = {
  fine: 0.001,
  medium: 0.0025,
  bold: 0.005,
  marker: 0.01,
};

export function strokeWidthMeters(id: StrokeWidthId): number {
  return STROKE_WIDTH_M[id];
}

/** One sampled point of a Stroke, in Surface-local `(u, v)` space. */
export type StrokePoint = {
  /** Normalized horizontal coordinate, 0..1. */
  u: number;
  /** Normalized vertical coordinate, 0..1. */
  v: number;
  /** Normalized pressure, 0..1 (0.5 for non-stylus pointers). */
  p: number;
  /** Milliseconds since the Stroke began. */
  t: number;
};

/**
 * A single pen-down → pen-up Stroke. `index` is the Stroke's order
 * within its Annotation; the renderer draws older Strokes first.
 */
export type Stroke = {
  id: string;
  annotation_id: string;
  points: StrokePoint[];
  color_id: string;
  width_id: StrokeWidthId;
  index: number;
  created_at: string;
};

/** Payload accepted by the repository when committing a new Stroke. */
export type NewStroke = Omit<Stroke, "id" | "created_at" | "annotation_id">;

/**
 * One drawing session on one Surface. Groups every Stroke a User
 * committed between a pen-down and the next mode switch / Room close.
 */
export type Annotation = {
  id: string;
  surface_id: string;
  owner_id: string;
  strokes: Stroke[];
  created_at: string;
  updated_at: string;
};
