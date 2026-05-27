import { create } from "zustand";
import type { Session } from "@supabase/supabase-js";
import type {
  CanvasRepository,
  CanvasRow,
  NoteRow,
} from "./lib/canvas-repository";
import type { Room, Surface } from "./lib/room";
import {
  selectOne as selectOneFn,
  toggleInSelection as toggleInSelectionFn,
  clearSelection as clearSelectionFn,
  type Selection,
} from "./lib/selection";
import { createNoteAt as createNoteAtFn } from "./lib/create-note";
import { DeleteUndoStack } from "./lib/delete-undo-stack";
import { endDragUpdates, type DragDelta } from "./lib/drag";

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
  drag: DragDelta | null;
  undoToast: ToastState | null;
  ready: boolean;
  repo: CanvasRepository | null;

  // v2 (issue #13): Room replaces Canvas as the spatial container.
  currentRoom: Room | null;
  surfaces: Surface[];

  setSession: (session: Session | null) => void;
  setCanvas: (canvas: CanvasRow, notes: NoteRow[]) => void;
  setRepo: (repo: CanvasRepository) => void;
  setRoom: (room: Room, surfaces: Surface[]) => void;

  selectNote: (id: string, shift: boolean) => void;
  clearSelection: () => void;

  createNoteAt: (x: number, y: number) => Promise<void>;
  deleteSelection: () => Promise<void>;
  undoLastDelete: () => Promise<void>;
  dismissUndoToast: () => void;

  beginDrag: (leadId: string) => void;
  updateDrag: (dx: number, dy: number) => void;
  endDrag: () => Promise<void>;
};

const TOAST_LIFETIME_MS = 5000;

// Pending updateNotePositions calls that failed because the network was
// offline at drag-end. Flushed by the `online` event listener installed
// in App.tsx — see useGlobalShortcuts (well, App.tsx).
const pendingPositionUpdates: Array<{ id: string; x: number; y: number }> = [];

export function getPendingPositionUpdates() {
  return pendingPositionUpdates;
}

export const useAppStore = create<AppState>((set, get) => ({
  session: null,
  currentCanvas: null,
  notes: [],
  selection: new Set<string>(),
  drag: null,
  undoToast: null,
  ready: false,
  repo: null,
  currentRoom: null,
  surfaces: [],

  setSession: (session) => set({ session }),
  setCanvas: (canvas, notes) =>
    set({ currentCanvas: canvas, notes, ready: true }),
  setRepo: (repo) => set({ repo }),
  setRoom: (room, surfaces) =>
    set({ currentRoom: room, surfaces, ready: true }),

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

  beginDrag: (leadId) =>
    set((s) => {
      // Grabbing a Note outside the existing selection auto-selects just
      // it — matches the typical desktop interaction model and keeps the
      // selected ring + drag in sync.
      const selection = s.selection.has(leadId)
        ? s.selection
        : new Set<string>([leadId]);
      return {
        drag: { selection, leadId, dx: 0, dy: 0 },
        selection,
      };
    }),

  updateDrag: (dx, dy) =>
    set((s) => (s.drag ? { drag: { ...s.drag, dx, dy } } : {})),

  endDrag: async () => {
    const { drag, notes, repo } = get();
    if (!drag) return;
    const updates = endDragUpdates(notes, drag);
    if (updates.length === 0) {
      set({ drag: null });
      return;
    }
    // Optimistic: commit the final positions to local state first so the
    // UI never visibly snaps back, even if the network is slow / down.
    const byId = new Map(updates.map((u) => [u.id, u]));
    set({
      notes: notes.map((n) => {
        const u = byId.get(n.id);
        return u ? { ...n, x: u.x, y: u.y } : n;
      }),
      drag: null,
    });
    if (!repo) return;
    try {
      await repo.updateNotePositions(updates);
    } catch (err) {
      console.warn("updateNotePositions failed; queued for retry on `online`", err);
      pendingPositionUpdates.push(...updates);
    }
  },
}));

/**
 * Flush position updates that were queued because the network was offline
 * at drag-end. Installed once from App.tsx.
 */
export async function flushPendingPositionUpdates(): Promise<void> {
  if (pendingPositionUpdates.length === 0) return;
  const { repo } = useAppStore.getState();
  if (!repo) return;
  // Collapse multiple updates to the same id — only the most recent
  // (x, y) matters.
  const byId = new Map<string, { id: string; x: number; y: number }>();
  for (const u of pendingPositionUpdates) byId.set(u.id, u);
  const batch = [...byId.values()];
  pendingPositionUpdates.length = 0;
  try {
    await repo.updateNotePositions(batch);
  } catch (err) {
    console.warn("retry of pending position updates failed", err);
    pendingPositionUpdates.push(...batch);
  }
}
