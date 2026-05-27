import { create } from "zustand";
import type { Session } from "@supabase/supabase-js";
import type { CanvasRow, NoteRow } from "./lib/canvas-repository";

type AppState = {
  session: Session | null;
  currentCanvas: CanvasRow | null;
  notes: NoteRow[];
  ready: boolean;
  setSession: (session: Session | null) => void;
  setCanvas: (canvas: CanvasRow, notes: NoteRow[]) => void;
};

export const useAppStore = create<AppState>((set) => ({
  session: null,
  currentCanvas: null,
  notes: [],
  ready: false,
  setSession: (session) => set({ session }),
  setCanvas: (canvas, notes) =>
    set({ currentCanvas: canvas, notes, ready: true }),
}));
