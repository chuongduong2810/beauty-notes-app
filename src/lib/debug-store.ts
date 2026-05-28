import { create } from "zustand";

/**
 * Standalone Zustand store for the zoom debug HUD. Kept out of the
 * main `useAppStore` so it can be ripped out cleanly once the zoom
 * investigation is done.
 *
 * `ZoomDebugProbe` (inside `<Canvas>`) writes via `update()` every
 * frame; `ZoomDebugOverlay` (outside `<Canvas>`) subscribes for the
 * read-side render.
 */
export type ZoomDebugStats = {
  cam: [number, number, number];
  target: [number, number, number];
  distance: number;
  minDistance: number;
  maxDistance: number;
  zoomToCursor: boolean;
  cameraNear: number;
  cameraFar: number;
  enabled: boolean;
  lastWheelDelta: number;
  lastWheelCursor: [number, number];
  lastDistBefore: number;
  lastDistAfter: number;
};

export const useDebugStore = create<
  ZoomDebugStats & { update: (s: Partial<ZoomDebugStats>) => void }
>((set) => ({
  cam: [0, 0, 0],
  target: [0, 0, 0],
  distance: 0,
  minDistance: 0,
  maxDistance: 0,
  zoomToCursor: false,
  cameraNear: 0,
  cameraFar: 0,
  enabled: true,
  lastWheelDelta: 0,
  lastWheelCursor: [0, 0],
  lastDistBefore: 0,
  lastDistAfter: 0,
  update: (s) => set(s),
}));
