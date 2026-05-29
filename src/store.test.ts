import { describe, it, expect, beforeEach, vi } from "vitest";
import { useAppStore } from "./store";
import type { CanvasRepository } from "./lib/canvas-repository";
import type { Note, Room } from "./lib/room";

// Mock the Supabase client so claimRoom's `updateUser` call is
// controllable and never hits the network (issue #70).
const updateUser = vi.fn();
vi.mock("./lib/supabase", () => ({
  supabase: { auth: { updateUser: (...args: unknown[]) => updateUser(...args) } },
}));

/** Minimal Room fixture for the claim flow (only `id` is read). */
function makeRoom(): Room {
  return { id: "room-1" } as unknown as Room;
}

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

describe("store — claimRoom / resetClaim (issue #70)", () => {
  beforeEach(() => {
    updateUser.mockReset();
    useAppStore.setState({
      currentRoom: null,
      claimStatus: "idle",
      claimError: null,
    });
  });

  it("flips sending → sent and sends a magic link to the Room route", async () => {
    updateUser.mockResolvedValue({ data: {}, error: null });
    useAppStore.setState({ currentRoom: makeRoom() });

    await useAppStore.getState().claimRoom("ada@example.com");

    expect(useAppStore.getState().claimStatus).toBe("sent");
    expect(useAppStore.getState().claimError).toBeNull();
    expect(updateUser).toHaveBeenCalledWith(
      { email: "ada@example.com" },
      {
        emailRedirectTo: `${window.location.origin}/room/room-1`,
      },
    );
  });

  it("flips to error with a message when the update fails", async () => {
    updateUser.mockResolvedValue({ data: {}, error: new Error("rate limited") });
    useAppStore.setState({ currentRoom: makeRoom() });

    await useAppStore.getState().claimRoom("ada@example.com");

    expect(useAppStore.getState().claimStatus).toBe("error");
    expect(useAppStore.getState().claimError).toBe("rate limited");
  });

  it("no-ops with no current Room", async () => {
    await useAppStore.getState().claimRoom("ada@example.com");

    expect(updateUser).not.toHaveBeenCalled();
    expect(useAppStore.getState().claimStatus).toBe("idle");
  });

  it("resetClaim returns to idle and clears the error", () => {
    useAppStore.setState({ claimStatus: "error", claimError: "boom" });

    useAppStore.getState().resetClaim();

    expect(useAppStore.getState().claimStatus).toBe("idle");
    expect(useAppStore.getState().claimError).toBeNull();
  });
});
