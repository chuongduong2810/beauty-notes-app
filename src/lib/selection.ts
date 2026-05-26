/**
 * Pure selection-state transitions. The selection is a set of Note ids that
 * lives in the UI store and is *not* persisted (PRD §5.4).
 */

export type Selection = ReadonlySet<string>;

/**
 * Replace any prior selection with just `id`. Used for a plain (non-shift)
 * click on a Note.
 */
export function selectOne(_prev: Selection, id: string): Selection {
  return new Set([id]);
}
