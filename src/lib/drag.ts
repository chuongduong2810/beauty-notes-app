import type { NoteRow } from "./canvas-repository";

export type DragDelta = {
  selection: ReadonlySet<string>;
  leadId: string;
  dx: number;
  dy: number;
};

/**
 * Apply a drag translation to a list of Notes. The lead Note (the one
 * the user is physically dragging) moves by `(dx, dy)`. If the lead Note
 * is part of a multi-selection, every selected Note moves by the same
 * delta — preserving their relative offsets. Notes outside the
 * selection are returned untouched.
 */
function movingIdsFor(delta: DragDelta): ReadonlySet<string> {
  // The lead Note always moves. If it's part of a multi-selection every
  // selected Note moves with it; otherwise only the lead moves (e.g. the
  // user grabbed a Note that wasn't part of the existing selection).
  return delta.selection.has(delta.leadId)
    ? delta.selection
    : new Set<string>([delta.leadId]);
}

export function applyDragDelta(
  notes: readonly NoteRow[],
  delta: DragDelta,
): NoteRow[] {
  const movingIds = movingIdsFor(delta);
  return notes.map((n) =>
    movingIds.has(n.id)
      ? { ...n, x: n.x + delta.dx, y: n.y + delta.dy }
      : n,
  );
}

/**
 * Derive the repo payload from a finished drag — the list of `{id, x, y}`
 * to ship in one batched `updateNotePositions` call. Only the Notes that
 * actually moved are included.
 */
export function endDragUpdates(
  notes: readonly NoteRow[],
  delta: DragDelta,
): Array<{ id: string; x: number; y: number }> {
  const movingIds = movingIdsFor(delta);
  const updates: Array<{ id: string; x: number; y: number }> = [];
  for (const n of notes) {
    if (!movingIds.has(n.id)) continue;
    updates.push({ id: n.id, x: n.x + delta.dx, y: n.y + delta.dy });
  }
  return updates;
}
