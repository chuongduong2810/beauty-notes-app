import { describe, it, expect, beforeEach, vi } from "vitest";
import { useAppStore } from "./store";
import type { CanvasRepository } from "./lib/canvas-repository";
import type { Note, Room } from "./lib/room";

// Mock the Supabase client so claimRoom's `updateUser` (issue #70) and
// sendRestoreLink's `signInWithOtp` (issue #82) calls are controllable
// and never hit the network.
const updateUser = vi.fn();
const signInWithOtp = vi.fn();
vi.mock("./lib/supabase", () => ({
  supabase: {
    auth: {
      updateUser: (...args: unknown[]) => updateUser(...args),
      signInWithOtp: (...args: unknown[]) => signInWithOtp(...args),
    },
  },
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

describe("store — restore flow (issue #82, ADR-0019)", () => {
  beforeEach(() => {
    signInWithOtp.mockReset();
    window.localStorage.clear();
    useAppStore.setState({
      restoreStatus: "idle",
      restoreError: null,
      session: null,
      repo: null,
      currentRoom: null,
    });
  });

  it("sendRestoreLink flips sending → sent and signs in with OTP", async () => {
    signInWithOtp.mockResolvedValue({ data: {}, error: null });

    await useAppStore.getState().sendRestoreLink("ada@example.com");

    expect(useAppStore.getState().restoreStatus).toBe("sent");
    expect(useAppStore.getState().restoreError).toBeNull();
    expect(signInWithOtp).toHaveBeenCalledWith({
      email: "ada@example.com",
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${window.location.origin}/`,
      },
    });
  });

  it("sendRestoreLink records the 'restore' auth-intent before sending", async () => {
    signInWithOtp.mockResolvedValue({ data: {}, error: null });

    await useAppStore.getState().sendRestoreLink("ada@example.com");

    expect(window.localStorage.getItem("bn.auth-intent")).toBe("restore");
  });

  it("sendRestoreLink flips to error with a message when the send fails", async () => {
    signInWithOtp.mockResolvedValue({
      data: {},
      error: new Error("not found"),
    });

    await useAppStore.getState().sendRestoreLink("ada@example.com");

    expect(useAppStore.getState().restoreStatus).toBe("error");
    expect(useAppStore.getState().restoreError).toBe("not found");
  });

  it("completeRestore loads the single Room and clears the intent", async () => {
    window.localStorage.setItem("bn.auth-intent", "restore");
    const onlyRoom = { id: "room-1", name: "Studio" } as unknown as Room;
    let loadedRoomId: string | null = null;
    const repo = {
      async listRooms() {
        return [onlyRoom];
      },
      async listSurfaces(roomId: string) {
        loadedRoomId = roomId;
        return [{ id: "s1", owner_id: "u1" }];
      },
      async listNotes() {
        return [];
      },
      async listAnnotations() {
        return [];
      },
    } as unknown as CanvasRepository;

    useAppStore.setState({
      repo,
      session: { user: { id: "u1" } } as never,
    });

    await useAppStore.getState().completeRestore();

    expect(useAppStore.getState().restoreStatus).toBe("done");
    expect(useAppStore.getState().currentRoom?.id).toBe("room-1");
    expect(loadedRoomId).toBe("room-1");
    expect(window.localStorage.getItem("bn.auth-intent")).toBeNull();
  });

  it("completeRestore is 'done' without loading on 0 or >1 Rooms (issues #83/#85)", async () => {
    window.localStorage.setItem("bn.auth-intent", "restore");
    const repo = {
      async listRooms() {
        return [
          { id: "a" } as unknown as Room,
          { id: "b" } as unknown as Room,
        ];
      },
    } as unknown as CanvasRepository;

    useAppStore.setState({
      repo,
      session: { user: { id: "u1" } } as never,
      currentRoom: null,
    });

    await useAppStore.getState().completeRestore();

    expect(useAppStore.getState().restoreStatus).toBe("done");
    expect(useAppStore.getState().currentRoom).toBeNull();
  });

  it("resetRestore returns to idle and clears the error", () => {
    useAppStore.setState({ restoreStatus: "error", restoreError: "boom" });

    useAppStore.getState().resetRestore();

    expect(useAppStore.getState().restoreStatus).toBe("idle");
    expect(useAppStore.getState().restoreError).toBeNull();
  });
});
