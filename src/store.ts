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

type AppState = {
  session: Session | null;
  repo: CanvasRepository | null;
  ready: boolean;

  currentRoom: Room | null;
  surfaces: Surface[];
  notes: Note[];

  setSession: (session: Session | null) => void;
  setRepo: (repo: CanvasRepository) => void;
  setRoom: (room: Room, surfaces: Surface[], notes: Note[]) => void;

  /**
   * Insert a Note Pinned to `surfaceId` at the hit `(u, v)`. Default
   * dimensions and Palette colour from ADR-0010 / ADR-0008.
   */
  createNoteAt: (surfaceId: string, u: number, v: number) => Promise<void>;
};

export const useAppStore = create<AppState>((set, get) => ({
  session: null,
  repo: null,
  ready: false,

  currentRoom: null,
  surfaces: [],
  notes: [],

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
}));
