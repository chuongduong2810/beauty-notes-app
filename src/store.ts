import { create } from "zustand";
import type { Session } from "@supabase/supabase-js";
import type {
  CanvasRepository,
  CanvasRow,
  NoteRow,
} from "./lib/canvas-repository";
import {
  selectOne as selectOneFn,
  toggleInSelection as toggleInSelectionFn,
  clearSelection as clearSelectionFn,
  type Selection,
} from "./lib/selection";
import { createNoteAt as createNoteAtFn } from "./lib/create-note";
import { DeleteUndoStack } from "./lib/delete-undo-stack";

const undoStack = new DeleteUndoStack();

type ToastState = {
  count: number;
  expiresAt: number;
};

type AppState = {
  session: Session | null;
  currentCanvas: CanvasRow | null;
  notes: NoteRow[];
  selection: Selection;
  undoToast: ToastState | null;
  ready: boolean;
  repo: CanvasRepository | null;

  setSession: (session: Session | null) => void;
  setCanvas: (canvas: CanvasRow, notes: NoteRow[]) => void;
  setRepo: (repo: CanvasRepository) => void;

  selectNote: (id: string, shift: boolean) => void;
  clearSelection: () => void;

  createNoteAt: (x: number, y: number) => Promise<void>;
  deleteSelection: () => Promise<void>;
  undoLastDelete: () => Promise<void>;
  dismissUndoToast: () => void;
};

const TOAST_LIFETIME_MS = 5000;

export const useAppStore = create<AppState>((set, get) => ({
  session: null,
  currentCanvas: null,
  notes: [],
  selection: new Set<string>(),
  undoToast: null,
  ready: false,
  repo: null,

  setSession: (session) => set({ session }),
  setCanvas: (canvas, notes) =>
    set({ currentCanvas: canvas, notes, ready: true }),
  setRepo: (repo) => set({ repo }),

  selectNote: (id, shift) =>
    set((s) => ({
      selection: shift
        ? toggleInSelectionFn(s.selection, id)
        : selectOneFn(s.selection, id),
    })),
  clearSelection: () => set((s) => ({ selection: clearSelectionFn(s.selection) })),

  createNoteAt: async (x, y) => {
    const { repo, currentCanvas, session } = get();
    if (!repo || !currentCanvas || !session) return;
    const note = await createNoteAtFn(repo, {
      canvasId: currentCanvas.id,
      ownerId: session.user.id,
      x,
      y,
    });
    set((s) => ({ notes: [...s.notes, note] }));
  },

  deleteSelection: async () => {
    const { repo, selection, notes } = get();
    if (!repo || selection.size === 0) return;
    const ids = [...selection];
    const idSet = new Set(ids);
    // Optimistic UI: remove from local state first, then commit.
    set({
      notes: notes.filter((n) => !idSet.has(n.id)),
      selection: new Set(),
    });
    const deleted = await repo.deleteNotes(ids);
    undoStack.push(deleted);
    set({
      undoToast: { count: deleted.length, expiresAt: Date.now() + TOAST_LIFETIME_MS },
    });
  },

  undoLastDelete: async () => {
    const { repo } = get();
    if (!repo) return;
    const rows = undoStack.pop();
    if (!rows) return;
    const restored: NoteRow[] = [];
    for (const row of rows) {
      const r = await repo.insertNote({
        canvas_id: row.canvas_id,
        owner_id: row.owner_id,
        x: row.x,
        y: row.y,
        depth: row.depth,
        width: row.width,
        height: row.height,
        body: row.body,
        color_id: row.color_id,
      });
      restored.push(r);
    }
    set((s) => ({ notes: [...s.notes, ...restored], undoToast: null }));
  },

  dismissUndoToast: () => set({ undoToast: null }),
}));
