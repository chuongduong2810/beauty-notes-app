import { describe, it, expect, beforeEach, vi } from "vitest";
import { useAppStore } from "./store";
import type { CanvasRepository } from "./lib/canvas-repository";
import type { Note, Room } from "./lib/room";

// Mock the Supabase client so claimRoom's `updateUser` (issue #70),
// sendRestoreLink's `signInWithOtp` (issue #82) and restoreWithPassword's
// `signInWithPassword` / session juggling (issue #95) are controllable and
// never hit the network.
const updateUser = vi.fn();
const signInWithOtp = vi.fn();
const signInWithPassword = vi.fn();
const getSession = vi.fn();
const setSession = vi.fn();
vi.mock("./lib/supabase", () => ({
  supabase: {
    auth: {
      updateUser: (...args: unknown[]) => updateUser(...args),
      signInWithOtp: (...args: unknown[]) => signInWithOtp(...args),
      signInWithPassword: (...args: unknown[]) => signInWithPassword(...args),
      getSession: (...args: unknown[]) => getSession(...args),
      setSession: (...args: unknown[]) => setSession(...args),
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

  it("flips sending → sent and sets email + password with a magic link to the Room route", async () => {
    updateUser.mockResolvedValue({ data: {}, error: null });
    useAppStore.setState({ currentRoom: makeRoom() });

    await useAppStore.getState().claimRoom("ada@example.com", "hunter2!secret");

    expect(useAppStore.getState().claimStatus).toBe("sent");
    expect(useAppStore.getState().claimError).toBeNull();
    expect(updateUser).toHaveBeenCalledWith(
      { email: "ada@example.com", password: "hunter2!secret" },
      {
        emailRedirectTo: `${window.location.origin}/room/room-1`,
      },
    );
  });

  it("flips to error with a message when the update fails", async () => {
    updateUser.mockResolvedValue({ data: {}, error: new Error("rate limited") });
    useAppStore.setState({ currentRoom: makeRoom() });

    await useAppStore.getState().claimRoom("ada@example.com", "hunter2!secret");

    expect(useAppStore.getState().claimStatus).toBe("error");
    expect(useAppStore.getState().claimError).toBe("rate limited");
  });

  it("no-ops with no current Room", async () => {
    await useAppStore.getState().claimRoom("ada@example.com", "hunter2!secret");

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

  it("sendRestoreLink hard-deletes the anon User's Rooms after a successful send (issue #84)", async () => {
    signInWithOtp.mockResolvedValue({ data: {}, error: null });
    let deletedOwnerId: string | null = null;
    const repo = {
      async deleteRoomsForOwner(ownerId: string) {
        deletedOwnerId = ownerId;
      },
    } as unknown as CanvasRepository;
    useAppStore.setState({
      repo,
      session: { user: { id: "anon-1" } } as never,
    });

    await useAppStore.getState().sendRestoreLink("ada@example.com");

    expect(deletedOwnerId).toBe("anon-1");
    expect(useAppStore.getState().restoreStatus).toBe("sent");
  });

  it("sendRestoreLink does NOT delete guest Rooms when the send fails (issue #84)", async () => {
    signInWithOtp.mockResolvedValue({
      data: {},
      error: new Error("not found"),
    });
    const deleteRoomsForOwner = vi.fn();
    const repo = { deleteRoomsForOwner } as unknown as CanvasRepository;
    useAppStore.setState({
      repo,
      session: { user: { id: "anon-1" } } as never,
    });

    await useAppStore.getState().sendRestoreLink("ada@example.com");

    expect(deleteRoomsForOwner).not.toHaveBeenCalled();
    expect(useAppStore.getState().restoreStatus).toBe("error");
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

  it("completeRestore flips to 'selecting' with the candidate Rooms on >1 Room (issue #83)", async () => {
    window.localStorage.setItem("bn.auth-intent", "restore");
    const candidates = [
      { id: "a", name: "Studio" } as unknown as Room,
      { id: "b", name: "Workshop" } as unknown as Room,
    ];
    const repo = {
      async listRooms() {
        return candidates;
      },
    } as unknown as CanvasRepository;

    useAppStore.setState({
      repo,
      session: { user: { id: "u1" } } as never,
      currentRoom: null,
      restorableRooms: [],
    });

    await useAppStore.getState().completeRestore();

    // No auto-load: the User chooses on the "Your Rooms" page.
    expect(useAppStore.getState().restoreStatus).toBe("selecting");
    expect(useAppStore.getState().restorableRooms).toEqual(candidates);
    expect(useAppStore.getState().currentRoom).toBeNull();
    expect(window.localStorage.getItem("bn.auth-intent")).toBeNull();
  });

  it("completeRestore flips to 'empty' on 0 Rooms without loading or auto-creating (issue #85)", async () => {
    window.localStorage.setItem("bn.auth-intent", "restore");
    const insertRoom = vi.fn();
    const repo = {
      async listRooms() {
        return [];
      },
      // Should never be reached — the zero-room path must NOT mint a Room.
      insertRoom,
    } as unknown as CanvasRepository;

    useAppStore.setState({
      repo,
      session: { user: { id: "u1" } } as never,
      currentRoom: null,
      restorableRooms: [],
    });

    await useAppStore.getState().completeRestore();

    // Drives the "no room found" page: no Room loaded, none auto-created,
    // no Claim certificate, and the auth-intent is cleared.
    expect(useAppStore.getState().restoreStatus).toBe("empty");
    expect(useAppStore.getState().currentRoom).toBeNull();
    expect(useAppStore.getState().restorableRooms).toEqual([]);
    expect(insertRoom).not.toHaveBeenCalled();
    expect(window.localStorage.getItem("bn.auth-intent")).toBeNull();
  });

  it("restoreIntoRoom loads the chosen Room and clears the candidates (issue #83)", async () => {
    const studio = { id: "a", name: "Studio" } as unknown as Room;
    const chosen = { id: "b", name: "Workshop" } as unknown as Room;
    let loadedRoomId: string | null = null;
    const repo = {
      async listSurfaces(roomId: string) {
        loadedRoomId = roomId;
        return [{ id: "s1", owner_id: "u1" }];
      },
      async listRooms() {
        return [studio, chosen];
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
      currentRoom: null,
      restoreStatus: "selecting",
      restorableRooms: [studio, chosen],
    });

    await useAppStore.getState().restoreIntoRoom("b");

    expect(loadedRoomId).toBe("b");
    expect(useAppStore.getState().currentRoom?.id).toBe("b");
    expect(useAppStore.getState().restoreStatus).toBe("done");
    expect(useAppStore.getState().restorableRooms).toEqual([]);
  });

  it("resetRestore returns to idle and clears the error", () => {
    useAppStore.setState({ restoreStatus: "error", restoreError: "boom" });

    useAppStore.getState().resetRestore();

    expect(useAppStore.getState().restoreStatus).toBe("idle");
    expect(useAppStore.getState().restoreError).toBeNull();
  });
});

describe("store — restoreWithPassword (issue #95, ADR-0020)", () => {
  /** The anon session captured before sign-in, and the permanent session
   *  `signInWithPassword` returns on success. */
  const anonSession = { user: { id: "anon-1", is_anonymous: true } } as never;
  const permanentSession = {
    user: { id: "perm-1", email: "ada@example.com" },
  } as never;

  beforeEach(() => {
    signInWithPassword.mockReset();
    getSession.mockReset();
    setSession.mockReset();
    window.localStorage.clear();
    // getSession returns the saved anon session by default (verify-then-clean).
    getSession.mockResolvedValue({ data: { session: anonSession } });
    setSession.mockResolvedValue({ data: {}, error: null });
    useAppStore.setState({
      restoreStatus: "idle",
      restoreError: null,
      session: anonSession,
      repo: null,
      currentRoom: null,
      restorableRooms: [],
    });
  });

  it("on a wrong password: flips to error, deletes nothing, leaves guest data intact", async () => {
    signInWithPassword.mockResolvedValue({
      data: { session: null },
      error: new Error("Invalid login credentials"),
    });
    const deleteRoomsForOwner = vi.fn();
    const repo = { deleteRoomsForOwner } as unknown as CanvasRepository;
    useAppStore.setState({ repo });

    await useAppStore
      .getState()
      .restoreWithPassword("ada@example.com", "wrong-password");

    expect(useAppStore.getState().restoreStatus).toBe("error");
    expect(useAppStore.getState().restoreError).toBe(
      "Invalid login credentials",
    );
    // No cleanup ran — the anon session was never swapped away.
    expect(deleteRoomsForOwner).not.toHaveBeenCalled();
    expect(setSession).not.toHaveBeenCalled();
    // The anon session is still the store's session: guest data is reachable.
    expect(useAppStore.getState().session).toBe(anonSession);
  });

  it("on the correct password: cleans guest Rooms via the saved anon session, then auto-loads the single Room", async () => {
    signInWithPassword.mockResolvedValue({
      data: { session: permanentSession },
      error: null,
    });
    const onlyRoom = { id: "room-1", name: "Studio" } as unknown as Room;
    let deletedOwnerId: string | null = null;
    let loadedRoomId: string | null = null;
    const repo = {
      async deleteRoomsForOwner(ownerId: string) {
        deletedOwnerId = ownerId;
      },
      async listRooms() {
        return [onlyRoom];
      },
      async listSurfaces(roomId: string) {
        loadedRoomId = roomId;
        return [{ id: "s1", owner_id: "perm-1" }];
      },
      async listNotes() {
        return [];
      },
      async listAnnotations() {
        return [];
      },
    } as unknown as CanvasRepository;
    useAppStore.setState({ repo });

    await useAppStore
      .getState()
      .restoreWithPassword("ada@example.com", "right-password");

    // Cleanup deleted the ANON User's Rooms (verify-then-clean).
    expect(deletedOwnerId).toBe("anon-1");
    // Session was juggled: anon re-applied for the delete, then permanent.
    expect(setSession).toHaveBeenNthCalledWith(1, anonSession);
    expect(setSession).toHaveBeenNthCalledWith(2, permanentSession);
    // Single Room auto-loaded; store session is now permanent.
    expect(loadedRoomId).toBe("room-1");
    expect(useAppStore.getState().currentRoom?.id).toBe("room-1");
    expect(useAppStore.getState().session).toBe(permanentSession);
    expect(useAppStore.getState().restoreStatus).toBe("done");
    expect(window.localStorage.getItem("bn.auth-intent")).toBeNull();
  });

  it("on the correct password with >1 Room: flips to 'selecting' with the candidates", async () => {
    signInWithPassword.mockResolvedValue({
      data: { session: permanentSession },
      error: null,
    });
    const candidates = [
      { id: "a", name: "Studio" } as unknown as Room,
      { id: "b", name: "Workshop" } as unknown as Room,
    ];
    const repo = {
      async deleteRoomsForOwner() {},
      async listRooms() {
        return candidates;
      },
    } as unknown as CanvasRepository;
    useAppStore.setState({ repo });

    await useAppStore
      .getState()
      .restoreWithPassword("ada@example.com", "right-password");

    expect(useAppStore.getState().restoreStatus).toBe("selecting");
    expect(useAppStore.getState().restorableRooms).toEqual(candidates);
    expect(useAppStore.getState().currentRoom).toBeNull();
  });

  it("on the correct password with 0 Rooms: flips to 'empty' without auto-creating", async () => {
    signInWithPassword.mockResolvedValue({
      data: { session: permanentSession },
      error: null,
    });
    const insertRoom = vi.fn();
    const repo = {
      async deleteRoomsForOwner() {},
      async listRooms() {
        return [];
      },
      insertRoom,
    } as unknown as CanvasRepository;
    useAppStore.setState({ repo });

    await useAppStore
      .getState()
      .restoreWithPassword("ada@example.com", "right-password");

    expect(useAppStore.getState().restoreStatus).toBe("empty");
    expect(useAppStore.getState().currentRoom).toBeNull();
    expect(insertRoom).not.toHaveBeenCalled();
  });

  it("does not strand the User when the guest cleanup delete fails", async () => {
    signInWithPassword.mockResolvedValue({
      data: { session: permanentSession },
      error: null,
    });
    const onlyRoom = { id: "room-1", name: "Studio" } as unknown as Room;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const repo = {
      async deleteRoomsForOwner() {
        throw new Error("delete blew up");
      },
      async listRooms() {
        return [onlyRoom];
      },
      async listSurfaces() {
        return [{ id: "s1", owner_id: "perm-1" }];
      },
      async listNotes() {
        return [];
      },
      async listAnnotations() {
        return [];
      },
    } as unknown as CanvasRepository;
    useAppStore.setState({ repo });

    await useAppStore
      .getState()
      .restoreWithPassword("ada@example.com", "right-password");

    // The delete failure is logged but the permanent session is still
    // applied (finally) and the Room still loads — no stranding.
    expect(warn).toHaveBeenCalled();
    expect(setSession).toHaveBeenNthCalledWith(2, permanentSession);
    expect(useAppStore.getState().currentRoom?.id).toBe("room-1");
    expect(useAppStore.getState().restoreStatus).toBe("done");
    warn.mockRestore();
  });
});
