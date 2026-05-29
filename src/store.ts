import type { Session } from "@supabase/supabase-js";
import { create } from "zustand";
import type { CanvasRepository } from "./lib/canvas-repository";
import { DebouncedSaver } from "./lib/debounced-saver";
import { DEFAULT_NOTE_COLOR_ID } from "./lib/palette";
import {
  appendStrokePoint as appendStrokePointReducer,
  beginStroke as beginStrokeReducer,
  endStroke as endStrokeReducer,
  initialPenState,
  setCurrentTool as setCurrentToolReducer,
  type PenState,
  type Tool,
} from "./lib/pen-tool";
import { loadRoom } from "./lib/load-room";
import type { ScreenRect } from "./lib/project-note-rect";
import { roomPath } from "./lib/room-route";
import {
  DEFAULT_NOTE_HEIGHT_CM,
  DEFAULT_NOTE_WIDTH_CM,
  type Note,
  type Room,
  type Surface,
} from "./lib/room";
import type { Annotation, Stroke, StrokePoint } from "./lib/stroke";

/** Tiny non-cryptographic id for optimistic Annotation / Stroke rows
 *  that exist in local state before the repo round-trip resolves. */
function tempId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

const NOTE_BODY_DEBOUNCE_MS = 500;
/**
 * How long the crumple-then-delete animation plays before the Note is
 * actually removed from state. Matches the spring settle time in
 * NoteMesh's crumple useEffect. Slightly longer to be safe.
 */
const CRUMPLE_DURATION_MS = 900;

/**
 * Push `/room/<id>` to the browser history when the active Room
 * changes inside a store action (issue #22). Guarded for SSR /
 * non-DOM environments and no-ops when the URL already matches so
 * back/forward popstate doesn't loop back into our own push.
 */
function pushRoomUrl(roomId: string): void {
  if (typeof window === "undefined") return;
  const target = roomPath(roomId);
  if (window.location.pathname === target) return;
  window.history.pushState(null, "", target);
}

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
  /**
   * All Rooms owned by the current User, most-recently-updated first.
   * Drives the RoomPicker dropdown (issue #22). Refreshed when the
   * user switches Rooms or creates one.
   */
  rooms: Room[];
  surfaces: Surface[];
  notes: Note[];
  annotations: Annotation[];

  /**
   * Pen-tool state machine (issue #35). `currentTool`, `pen`, and the
   * in-progress Stroke live in a sub-object so the pure reducer in
   * `lib/pen-tool.ts` can be tested in isolation.
   */
  penState: PenState;
  /**
   * Where on a wall the cursor is currently hitting while in Pen mode
   * but not actively drawing — drives the 3D pen-cursor follower so
   * the pen tracks the wall the moment the user picks it up, instead
   * of only appearing once they pen-down (#35 follow-up). Cleared
   * when the cursor leaves any wall or when Pen mode exits.
   */
  penHoverPoint: { surface_id: string; u: number; v: number } | null;
  /** Whether the floating ToolPalette chrome is shown. Hidden via the
   *  "×" pill on the toolbar; restored via the small show-affordance
   *  in its place. Defaults to true. */
  toolbarVisible: boolean;
  /**
   * Per-Surface Annotation id for the current Pen-mode session. When a
   * User pen-downs on a Surface for the first time after entering Pen
   * mode, we create one Annotation and reuse it for every Stroke on
   * that Surface until the mode changes (ADR-0014). Cleared on mode
   * switch and on Room load.
   */
  penSessionAnnotations: Record<string, string>;

  drag: DragPin | null;
  /** True while the active drag's cursor is over the trash bin mesh.
   *  Set by RoomScene's window-pointermove raycast; consumed by
   *  endNoteDrag to switch from "re-pin" to "delete". */
  dragOverTrash: boolean;
  /** While set, the NoteMesh for this id plays the crumple-shrink
   *  animation. Cleared (and the Note removed from state) once the
   *  animation finishes. */
  crumplingNoteId: string | null;
  focusedNoteId: string | null;
  beforeFocus: CameraPose | null;

  /** Issue #18: invisible-textarea editing for the focused Note. */
  editingNoteId: string | null;
  editingRect: ScreenRect | null;

  setSession: (session: Session | null) => void;
  setRepo: (repo: CanvasRepository) => void;
  setRoom: (
    room: Room,
    surfaces: Surface[],
    notes: Note[],
    annotations: Annotation[],
  ) => void;
  setRooms: (rooms: Room[]) => void;
  /** Switch to a different Room owned by the current User. No-op if
   *  already on the requested Room or the Room doesn't exist. Clears
   *  focus / editing state — per #22 spec we don't auto-resume Focus
   *  on reopen. */
  switchRoom: (roomId: string) => Promise<void>;
  /** Create a new Room owned by the current User, refresh the rooms
   *  list, and switch to it. */
  createRoom: (name?: string) => Promise<Room | null>;

  setCurrentTool: (tool: Tool) => void;
  setPenHoverPoint: (
    point: { surface_id: string; u: number; v: number } | null,
  ) => void;
  setToolbarVisible: (visible: boolean) => void;
  beginStroke: (surface_id: string, point: StrokePoint) => void;
  appendStrokePoint: (point: StrokePoint) => void;
  commitStroke: () => Promise<void>;

  createNoteAt: (surfaceId: string, u: number, v: number) => Promise<void>;

  beginNoteDrag: (noteId: string) => void;
  setDragPin: (pin: Omit<DragPin, "noteId">) => void;
  setDragOverTrash: (over: boolean) => void;
  endNoteDrag: () => Promise<void>;
  deleteNote: (noteId: string) => Promise<void>;
  crumpleAndDelete: (noteId: string) => Promise<void>;

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
  rooms: [],
  surfaces: [],
  notes: [],
  annotations: [],

  penState: initialPenState,
  penHoverPoint: null,
  toolbarVisible: true,
  penSessionAnnotations: {},

  drag: null,
  dragOverTrash: false,
  crumplingNoteId: null,
  focusedNoteId: null,
  beforeFocus: null,

  editingNoteId: null,
  editingRect: null,

  setSession: (session) => set({ session }),
  setRepo: (repo) => set({ repo }),
  setRoom: (room, surfaces, notes, annotations) =>
    set({
      currentRoom: room,
      surfaces,
      notes,
      annotations,
      ready: true,
      // Entering a Room resets the Pen-tool state to "Note" mode (per
      // ADR-0014 — mode-based input is global per session but resets
      // on Room open). Focus + editing reset too — per #22 spec a
      // reopened Room doesn't auto-resume the prior Focus session.
      penState: initialPenState,
      penSessionAnnotations: {},
      focusedNoteId: null,
      beforeFocus: null,
      editingNoteId: null,
      editingRect: null,
    }),

  setRooms: (rooms) => set({ rooms }),

  switchRoom: async (roomId) => {
    const { repo, currentRoom } = get();
    if (!repo) return;
    if (currentRoom?.id === roomId) return;
    const bundle = await loadRoom(repo, roomId);
    if (!bundle) return;
    get().setRoom(
      bundle.room,
      bundle.surfaces,
      bundle.notes,
      bundle.annotations,
    );
    pushRoomUrl(bundle.room.id);
  },

  createRoom: async (name = "Untitled") => {
    const { repo, session } = get();
    if (!repo || !session) return null;
    const room = await repo.insertRoom(session.user.id, name);
    const surfaces = await repo.listSurfaces(room.id);
    // Refresh the rooms list so the picker dropdown shows the new
    // Room straight away.
    const rooms = await repo.listRooms(session.user.id);
    set({ rooms });
    get().setRoom(room, surfaces, [], []);
    pushRoomUrl(room.id);
    return room;
  },

  setCurrentTool: (tool) =>
    set((s) => ({
      penState: setCurrentToolReducer(s.penState, tool),
      penSessionAnnotations: {},
      // Leaving Pen mode drops the hover point so a stale ghost pen
      // doesn't render on the wall after the user switches tools.
      penHoverPoint: tool === "pen" ? s.penHoverPoint : null,
    })),

  setPenHoverPoint: (point) => set({ penHoverPoint: point }),

  setToolbarVisible: (visible) => set({ toolbarVisible: visible }),

  beginStroke: (surface_id, point) =>
    set((s) => ({
      penState: beginStrokeReducer(s.penState, surface_id, point),
    })),

  appendStrokePoint: (point) =>
    set((s) => ({
      penState: appendStrokePointReducer(s.penState, point),
    })),

  commitStroke: async () => {
    const { penState, annotations, penSessionAnnotations, repo, session } =
      get();
    const surfaceId = penState.inProgressStroke?.surface_id;
    const existingAnnotationId = surfaceId
      ? penSessionAnnotations[surfaceId]
      : undefined;
    const existingStrokeCount = existingAnnotationId
      ? (annotations.find((a) => a.id === existingAnnotationId)?.strokes
          .length ?? 0)
      : 0;
    const { next, committed } = endStrokeReducer(penState, {
      index: existingStrokeCount,
    });

    // Optimistic insert: synchronously add the just-drawn Stroke (and
    // its Annotation, if the session doesn't have one yet) so the
    // polyline stays on screen between pointer-up and the repo
    // round-trip — fixes the "flicker on save" UX.
    //
    // We swap in the real ids when the repo calls resolve, and roll
    // back the optimistic rows on persistence failure.
    if (!committed || !surfaceId) {
      set({ penState: next });
      return;
    }

    const optimisticStrokeId = tempId("pending-stroke");
    const isNewAnnotation = !existingAnnotationId;
    const optimisticAnnotationId = isNewAnnotation
      ? tempId("pending-annotation")
      : existingAnnotationId!;
    const now = new Date().toISOString();
    const optimisticStroke: Stroke = {
      id: optimisticStrokeId,
      annotation_id: optimisticAnnotationId,
      points: committed.points,
      color_id: committed.color_id,
      width_id: committed.width_id,
      index: committed.index,
      created_at: now,
    };

    set((s) => {
      if (isNewAnnotation) {
        const placeholder: Annotation = {
          id: optimisticAnnotationId,
          surface_id: surfaceId,
          owner_id: session?.user.id ?? "local",
          strokes: [optimisticStroke],
          created_at: now,
          updated_at: now,
        };
        return {
          penState: next,
          annotations: [...s.annotations, placeholder],
          penSessionAnnotations: {
            ...s.penSessionAnnotations,
            [surfaceId]: optimisticAnnotationId,
          },
        };
      }
      return {
        penState: next,
        annotations: s.annotations.map((a) =>
          a.id === optimisticAnnotationId
            ? { ...a, strokes: [...a.strokes, optimisticStroke] }
            : a,
        ),
      };
    });

    if (!repo || !session) return;

    try {
      let realAnnotationId = existingAnnotationId;
      if (isNewAnnotation) {
        const ann = await repo.insertAnnotation({
          surface_id: surfaceId,
          owner_id: session.user.id,
        });
        realAnnotationId = ann.id;
        // Reconcile placeholder Annotation id → real id.
        set((s) => ({
          annotations: s.annotations.map((a) =>
            a.id === optimisticAnnotationId
              ? {
                  ...a,
                  id: ann.id,
                  created_at: ann.created_at,
                  updated_at: ann.updated_at,
                  strokes: a.strokes.map((st) =>
                    st.annotation_id === optimisticAnnotationId
                      ? { ...st, annotation_id: ann.id }
                      : st,
                  ),
                }
              : a,
          ),
          penSessionAnnotations: {
            ...s.penSessionAnnotations,
            [surfaceId]: ann.id,
          },
        }));
      }
      const realStroke = await repo.insertStroke(realAnnotationId!, {
        points: committed.points,
        color_id: committed.color_id,
        width_id: committed.width_id,
        index: committed.index,
      });
      // Reconcile placeholder Stroke → real Stroke.
      set((s) => ({
        annotations: s.annotations.map((a) =>
          a.id === realAnnotationId
            ? {
                ...a,
                strokes: a.strokes.map((st) =>
                  st.id === optimisticStrokeId ? realStroke : st,
                ),
              }
            : a,
        ),
      }));
    } catch (err) {
      console.warn("commitStroke persistence failed; rolling back", err);
      set((s) => ({
        annotations: isNewAnnotation
          ? s.annotations.filter((a) => a.id !== optimisticAnnotationId)
          : s.annotations.map((a) => ({
              ...a,
              strokes: a.strokes.filter((st) => st.id !== optimisticStrokeId),
            })),
        penSessionAnnotations: isNewAnnotation && surfaceId
          ? Object.fromEntries(
              Object.entries(s.penSessionAnnotations).filter(
                ([k]) => k !== surfaceId,
              ),
            )
          : s.penSessionAnnotations,
      }));
    }
  },

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

  setDragOverTrash: (over) => set({ dragOverTrash: over }),

  deleteNote: async (noteId) => {
    const { repo } = get();
    // Optimistic remove from local state first so the Note disappears
    // immediately; on persistence failure we roll back.
    const previous = get().notes.find((n) => n.id === noteId);
    if (!previous) return;
    set((s) => ({ notes: s.notes.filter((n) => n.id !== noteId) }));
    if (!repo) return;
    try {
      await repo.deleteNote(noteId);
    } catch (err) {
      console.warn("deleteNote failed; rolling back", err);
      set((s) => ({ notes: [...s.notes, previous] }));
    }
  },

  crumpleAndDelete: async (noteId) => {
    // Drive the crumple animation in NoteMesh by setting the flag,
    // then wait for the spring to settle, then remove the Note from
    // local state + persist. Clearing the flag before the remove
    // doesn't matter because the component unmounts on remove anyway.
    set({ crumplingNoteId: noteId });
    await new Promise((resolve) => setTimeout(resolve, CRUMPLE_DURATION_MS));
    set({ crumplingNoteId: null });
    await get().deleteNote(noteId);
  },

  endNoteDrag: async () => {
    const { drag, repo, notes, dragOverTrash } = get();
    if (!drag) return;
    const note = notes.find((n) => n.id === drag.noteId);
    set({ drag: null, dragOverTrash: false });
    if (!note || !repo) return;

    // Dropped on the trash → crumple animation, then delete.
    if (dragOverTrash) {
      await get().crumpleAndDelete(drag.noteId);
      return;
    }

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
