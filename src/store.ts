import { create } from "zustand";
import type { Session } from "@supabase/supabase-js";
import type { CanvasRepository } from "./lib/canvas-repository";
import type { Room, Surface } from "./lib/room";

type AppState = {
  session: Session | null;
  repo: CanvasRepository | null;
  ready: boolean;

  currentRoom: Room | null;
  surfaces: Surface[];

  setSession: (session: Session | null) => void;
  setRepo: (repo: CanvasRepository) => void;
  setRoom: (room: Room, surfaces: Surface[]) => void;
};

export const useAppStore = create<AppState>((set) => ({
  session: null,
  repo: null,
  ready: false,

  currentRoom: null,
  surfaces: [],

  setSession: (session) => set({ session }),
  setRepo: (repo) => set({ repo }),
  setRoom: (room, surfaces) =>
    set({ currentRoom: room, surfaces, ready: true }),
}));
