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
export function applyDragDelta(
  notes: readonly NoteRow[],
  { leadId, dx, dy }: DragDelta,
): NoteRow[] {
  return notes.map((n) =>
    n.id === leadId ? { ...n, x: n.x + dx, y: n.y + dy } : n,
  );
}
