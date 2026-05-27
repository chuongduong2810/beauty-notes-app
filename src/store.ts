import { create } from "zustand";
import type { Session } from "@supabase/supabase-js";
import type { CanvasRepository } from "./lib/canvas-repository";
import {
  DEFAULT_NOTE_WIDTH_CM,
  DEFAULT_NOTE_HEIGHT_CM,
  type Room,
  type Surface,
  type Note,
} from "./lib/room";
import { DEFAULT_NOTE_COLOR_ID } from "./lib/palette";
import { DebouncedSaver } from "./lib/debounced-saver";
import type { ScreenRect } from "./lib/project-note-rect";

const NOTE_BODY_DEBOUNCE_MS = 500;

// Module-scope debounced saver for Note bodies (ADR-0005). One channel
// shared across all editing sessions; latest body wins.
const bodySaver = new DebouncedSaver<{ noteId: string; body: string }>(
  NOTE_BODY_DEBOUNCE_MS,
  async ({ noteId, body }) => {
    const repo = useAppStore.getState().repo;
    if (!repo) return;
    try {
      await repo.updateNoteBody(noteId, body);
    } catch (err) {
      console.warn("updateNoteBody failed", err);
    }
  },
);

/**
 * Effective pin of a Note currently being dragged across Surfaces
 * (issue #16). While `drag` is set, the dragged Note's persistent
 * `(surface_id, u, v)` are ignored in favour of these live values so
 * the user sees the Note follow the cursor in realtime.
 */
type DragPin = {
  noteId: string;
  surface_id: string;
  u: number;
  v: number;
};

/**
 * Snapshot of the orbit camera pose taken at focus-start so we can
 * animate the Camera back to where the user was before they focused
 * the Note (issue #17).
 */
type CameraPose = {
  target: [number, number, number];
  position: [number, number, number];
};

type AppState = {
  session: Session | null;
  repo: CanvasRepository | null;
  ready: boolean;

  currentRoom: Room | null;
  surfaces: Surface[];
  notes: Note[];

  drag: DragPin | null;
  focusedNoteId: string | null;
  beforeFocus: CameraPose | null;

  /** Issue #18: invisible-textarea editing for the focused Note. */
  editingNoteId: string | null;
  editingRect: ScreenRect | null;

  setSession: (session: Session | null) => void;
  setRepo: (repo: CanvasRepository) => void;
  setRoom: (room: Room, surfaces: Surface[], notes: Note[]) => void;

  createNoteAt: (surfaceId: string, u: number, v: number) => Promise<void>;

  beginNoteDrag: (noteId: string) => void;
  setDragPin: (pin: Omit<DragPin, "noteId">) => void;
  endNoteDrag: () => Promise<void>;

  focusNote: (noteId: string, beforeFocus: CameraPose) => void;
  unfocusNote: () => Promise<void>;

  setEditingBody: (body: string) => void;
  setEditingRect: (rect: ScreenRect | null) => void;
};

export const useAppStore = create<AppState>((set, get) => ({
  session: null,
  repo: null,
  ready: false,

  currentRoom: null,
  surfaces: [],
  notes: [],

  drag: null,
  focusedNoteId: null,
  beforeFocus: null,

  editingNoteId: null,
  editingRect: null,

  setSession: (session) => set({ session }),
  setRepo: (repo) => set({ repo }),
  setRoom: (room, surfaces, notes) =>
    set({ currentRoom: room, surfaces, notes, ready: true }),

  createNoteAt: async (surfaceId, u, v) => {
    const { repo, session } = get();
    if (!repo || !session) return;
    const note = await repo.insertNote({
      surface_id: surfaceId,
      owner_id: session.user.id,
      u,
      v,
      width_cm: DEFAULT_NOTE_WIDTH_CM,
      height_cm: DEFAULT_NOTE_HEIGHT_CM,
      body: "",
      color_id: DEFAULT_NOTE_COLOR_ID,
    });
    set((s) => ({ notes: [...s.notes, note] }));
  },

  beginNoteDrag: (noteId) => {
    const note = get().notes.find((n) => n.id === noteId);
    if (!note) return;
    set({
      drag: { noteId, surface_id: note.surface_id, u: note.u, v: note.v },
    });
  },

  setDragPin: (pin) =>
    set((s) => (s.drag ? { drag: { ...s.drag, ...pin } } : {})),

  endNoteDrag: async () => {
    const { drag, repo, notes } = get();
    if (!drag) return;
    const note = notes.find((n) => n.id === drag.noteId);
    set({ drag: null });
    if (!note || !repo) return;

    // No-op if the drag never left the original pin.
    if (
      note.surface_id === drag.surface_id &&
      Math.abs(note.u - drag.u) < 1e-4 &&
      Math.abs(note.v - drag.v) < 1e-4
    ) {
      return;
    }

    // Optimistic: update local state, then commit.
    set((s) => ({
      notes: s.notes.map((n) =>
        n.id === drag.noteId
          ? { ...n, surface_id: drag.surface_id, u: drag.u, v: drag.v }
          : n,
      ),
    }));
    try {
      await repo.updateNotePin(drag.noteId, {
        surface_id: drag.surface_id,
        u: drag.u,
        v: drag.v,
      });
    } catch (err) {
      console.warn("updateNotePin failed; rolling back", err);
      set((s) => ({
        notes: s.notes.map((n) =>
          n.id === drag.noteId
            ? { ...n, surface_id: note.surface_id, u: note.u, v: note.v }
            : n,
        ),
      }));
    }
  },

  focusNote: (noteId, beforeFocus) =>
    set({
      focusedNoteId: noteId,
      beforeFocus,
      // Entering focus auto-activates the textarea (ADR-0002 + #18).
      editingNoteId: noteId,
    }),

  unfocusNote: async () => {
    // Flush any in-flight body edits so the latest text is persisted
    // before the Camera animates away.
    await bodySaver.flush();
    set({
      focusedNoteId: null,
      editingNoteId: null,
      editingRect: null,
    });
  },

  setEditingBody: (body) => {
    const id = get().editingNoteId;
    if (!id) return;
    // Mirror into local state immediately so the WebGL text reflects
    // every keystroke within a frame.
    set((s) => ({
      notes: s.notes.map((n) => (n.id === id ? { ...n, body } : n)),
    }));
    bodySaver.push({ noteId: id, body });
  },

  setEditingRect: (rect) => set({ editingRect: rect }),
}));
