import { describe, it, expect, beforeEach } from "vitest";
import { useAppStore } from "./store";
import type { CanvasRepository } from "./lib/canvas-repository";
import type { Note } from "./lib/room";

/** Minimal Note fixture for store actions that only touch `bookmarked`. */
function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: "n1",
    surface_id: "s1",
    owner_id: "u1",
    u: 0.5,
    v: 0.5,
    width_cm: 12,
    height_cm: 9,
    body: "",
    color_id: "paper",
    bookmarked: false,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("store — toggleBookmark (issue #55)", () => {
  beforeEach(() => {
    useAppStore.setState({ notes: [], repo: null });
  });

  it("optimistically flips the flag and persists via the repo", async () => {
    let persisted: { id: string; bookmarked: boolean } | null = null;
    const repo = {
      async setNoteBookmark(id: string, bookmarked: boolean) {
        persisted = { id, bookmarked };
        return makeNote({ id, bookmarked });
      },
    } as unknown as CanvasRepository;

    useAppStore.setState({ notes: [makeNote()], repo });
    await useAppStore.getState().toggleBookmark("n1");

    expect(useAppStore.getState().notes[0].bookmarked).toBe(true);
    expect(persisted).toEqual({ id: "n1", bookmarked: true });
  });

  it("rolls back the optimistic flip when the repo throws", async () => {
    const repo = {
      async setNoteBookmark() {
        throw new Error("offline");
      },
    } as unknown as CanvasRepository;

    useAppStore.setState({ notes: [makeNote()], repo });
    await useAppStore.getState().toggleBookmark("n1");

    expect(useAppStore.getState().notes[0].bookmarked).toBe(false);
  });
});
