import type { Note, SurfaceKind } from "./room";

/**
 * Pure full-text Note search for the command-palette Search overlay
 * (issue #66, ADR-0017). Scope is the *current Room only* and the only
 * searchable text is the Note `body` — v2 Notes have no titles or tags,
 * so the first non-empty body line stands in as the "title".
 *
 * Kept renderer-free and side-effect-free so the matching, ranking, and
 * cap rules are unit-testable without an R3F canvas or the store.
 */

/** Default max results surfaced by the palette — a quick jump list, not a browser. */
export const SEARCH_RESULT_LIMIT = 12;

/** Human-readable label for each SurfaceKind, e.g. "North wall" / "Floor". */
const SURFACE_LABELS: Record<SurfaceKind, string> = {
  wall_north: "North wall",
  wall_south: "South wall",
  wall_east: "East wall",
  wall_west: "West wall",
  floor: "Floor",
  ceiling: "Ceiling",
};

/**
 * Map a Surface's `kind` to its human-readable label for the result
 * row's spatial hint (which wall the Note lives on).
 *
 * @param kind - the Surface's discriminant.
 * @returns a label such as "North wall" or "Ceiling".
 */
export function surfaceLabel(kind: SurfaceKind): string {
  return SURFACE_LABELS[kind];
}

/** First non-empty (trimmed) line of a body — the stand-in "title". */
function titleLine(body: string): string {
  return body.split("\n").find((l) => l.trim().length > 0)?.trim() ?? "";
}

/**
 * Find the current Room's Notes whose body contains `query`
 * (case-insensitive substring). Notes whose title line matches rank
 * above body-only matches; ties keep input order (a stable sort).
 *
 * @param notes - the current Room's Notes (any order).
 * @param query - the raw search text; empty/whitespace yields `[]`.
 * @param limit - max results returned (defaults to {@link SEARCH_RESULT_LIMIT}).
 * @returns the matching Notes, ranked and capped at `limit`.
 */
export function searchNotes(
  notes: readonly Note[],
  query: string,
  limit: number = SEARCH_RESULT_LIMIT,
): Note[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];

  const matches: Array<{ note: Note; titleHit: boolean; order: number }> = [];
  notes.forEach((note, order) => {
    if (!note.body.toLowerCase().includes(needle)) return;
    const titleHit = titleLine(note.body).toLowerCase().includes(needle);
    matches.push({ note, titleHit, order });
  });

  matches.sort((a, b) => {
    if (a.titleHit !== b.titleHit) return a.titleHit ? -1 : 1;
    return a.order - b.order;
  });

  return matches.slice(0, limit).map((m) => m.note);
}
