import type { NoteRow } from "./canvas-repository";

/**
 * In-memory LIFO of delete actions. A delete action is the batch of Notes
 * removed by a single `Delete` press or trash click. Both the toast Undo
 * affordance and Ctrl/⌘Z pop from the same stack.
 *
 * Per PRD §5.3 and the issue #2 acceptance criteria the stack is session-only
 * — it intentionally does not survive a refresh.
 */
export class DeleteUndoStack {
  private actions: NoteRow[][] = [];

  push(deletedRows: NoteRow[]): void {
    if (deletedRows.length === 0) return;
    this.actions.push(deletedRows);
  }

  pop(): NoteRow[] | null {
    return this.actions.pop() ?? null;
  }

  get size(): number {
    return this.actions.length;
  }
}
