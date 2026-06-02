import { describe, it, expect, beforeEach, vi } from "vitest";
import { useAppStore } from "./store";
import type { CanvasRepository } from "./lib/canvas-repository";
import { InMemoryCanvasRepository } from "./lib/in-memory-canvas-repository";
import type { Note, Room } from "./lib/room";
import { entitlementsForTier } from "./lib/entitlements";
import { catalogByKind } from "./lib/catalog";
import { roomSizePresetById } from "./lib/room-size";

// Mock the Supabase client so claimRoom's `updateUser` (issue #70),
// sendRestoreLink's `signInWithOtp` (issue #82) and restoreWithPassword's
// `signInWithPassword` / session juggling (issue #95) are controllable and
// never hit the network.
const updateUser = vi.fn();
const signInWithOtp = vi.fn();
const signInWithPassword = vi.fn();
const getSession = vi.fn();
const setSession = vi.fn();
const resetPasswordForEmail = vi.fn();
vi.mock("./lib/supabase", () => ({
  supabase: {
    auth: {
      updateUser: (...args: unknown[]) => updateUser(...args),
      signInWithOtp: (...args: unknown[]) => signInWithOtp(...args),
      signInWithPassword: (...args: unknown[]) => signInWithPassword(...args),
      getSession: (...args: unknown[]) => getSession(...args),
      setSession: (...args: unknown[]) => setSession(...args),
      resetPasswordForEmail: (...args: unknown[]) =>
        resetPasswordForEmail(...args),
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

  it("records the 'claim' auth-intent before sending (issue #131)", async () => {
    window.localStorage.clear();
    updateUser.mockResolvedValue({ data: {}, error: null });
    useAppStore.setState({ currentRoom: makeRoom() });

    await useAppStore.getState().claimRoom("ada@example.com", "hunter2!secret");

    expect(window.localStorage.getItem("bn.auth-intent")).toBe("claim");
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

describe("store — set / reset password (issue #96, ADR-0020)", () => {
  const permanentSession = {
    user: { id: "perm-1", email: "ada@example.com" },
  } as never;

  beforeEach(() => {
    updateUser.mockReset();
    getSession.mockReset();
    resetPasswordForEmail.mockReset();
    window.localStorage.clear();
    useAppStore.setState({
      recoverStatus: "idle",
      recoverError: null,
      recovering: false,
      restoreStatus: "idle",
      restoreError: null,
      restorableRooms: [],
      session: null,
      repo: null,
      currentRoom: null,
    });
  });

  it("sendPasswordReset records the 'recover' intent, sends the email, and flips to 'sent'", async () => {
    resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });

    await useAppStore.getState().sendPasswordReset("ada@example.com");

    expect(resetPasswordForEmail).toHaveBeenCalledWith(
      "ada@example.com",
      expect.objectContaining({ redirectTo: expect.any(String) }),
    );
    // Intent is recorded BEFORE send so the recovery return is routed right.
    expect(window.localStorage.getItem("bn.auth-intent")).toBe("recover");
    expect(useAppStore.getState().recoverStatus).toBe("sent");
  });

  it("sendPasswordReset surfaces a send failure as 'error'", async () => {
    resetPasswordForEmail.mockResolvedValue({
      data: {},
      error: new Error("rate limited"),
    });

    await useAppStore.getState().sendPasswordReset("ada@example.com");

    expect(useAppStore.getState().recoverStatus).toBe("error");
    expect(useAppStore.getState().recoverError).toBe("rate limited");
  });

  it("setNewPassword writes the password, adopts the session, auto-loads the single Room, and clears the intent", async () => {
    updateUser.mockResolvedValue({
      data: { user: { id: "perm-1", email: "ada@example.com" } },
      error: null,
    });
    getSession.mockResolvedValue({ data: { session: permanentSession } });
    window.localStorage.setItem("bn.auth-intent", "recover");
    let loadedRoomId: string | null = null;
    const repo = {
      async listRooms() {
        return [{ id: "room-1", name: "Studio" } as unknown as Room];
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

    await useAppStore.getState().setNewPassword("brand-new-pass");

    expect(updateUser).toHaveBeenCalledWith({ password: "brand-new-pass" });
    expect(useAppStore.getState().session).toBe(permanentSession);
    expect(loadedRoomId).toBe("room-1");
    expect(useAppStore.getState().currentRoom?.id).toBe("room-1");
    expect(useAppStore.getState().recovering).toBe(false);
    expect(window.localStorage.getItem("bn.auth-intent")).toBeNull();
  });

  it("setNewPassword surfaces an updateUser failure without leaving recovery", async () => {
    updateUser.mockResolvedValue({
      data: {},
      error: new Error("weak password"),
    });

    await useAppStore.getState().setNewPassword("x");

    expect(useAppStore.getState().recoverStatus).toBe("error");
    expect(useAppStore.getState().recoverError).toBe("weak password");
  });
});

describe("store — membership entitlements (issue #104, ADR-0021)", () => {
  beforeEach(() => {
    useAppStore.setState({
      repo: null,
      session: { user: { id: "u1" } } as never,
      membership: null,
      entitlements: entitlementsForTier("explorer"),
    });
  });

  it("defaults to Explorer entitlements when there is no membership", async () => {
    const repo = {
      async getMembership() {
        return null;
      },
    } as unknown as CanvasRepository;
    useAppStore.setState({ repo });

    await useAppStore.getState().refreshMembership();

    const e = useAppStore.getState().entitlements;
    expect(e.maxRooms).toBe(1);
    expect(e.photoMode).toBe(false);
    expect(useAppStore.getState().membership).toBeNull();
  });

  it("derives Resident entitlements from an active resident membership", async () => {
    const repo = {
      async getMembership() {
        return {
          tier: "resident",
          status: "active",
          current_period_end: "2999-01-01T00:00:00Z",
        };
      },
    } as unknown as CanvasRepository;
    useAppStore.setState({ repo });

    await useAppStore.getState().refreshMembership();

    const e = useAppStore.getState().entitlements;
    expect(e.photoMode).toBe(true);
    expect(e.cameraViewpoints).toBe(true);
    expect(e.maxRooms).toBe(1); // Resident is still single-room (ADR-0021)
    expect(e.blueprintMode).toBe(false);
  });

  it("falls back to Explorer for an expired membership", async () => {
    const repo = {
      async getMembership() {
        return {
          tier: "studio",
          status: "active",
          current_period_end: "2000-01-01T00:00:00Z",
        };
      },
    } as unknown as CanvasRepository;
    useAppStore.setState({ repo });

    await useAppStore.getState().refreshMembership();

    expect(useAppStore.getState().entitlements.maxRooms).toBe(1);
  });
});

describe("store — applyCustomization (issue #107, ADR-0022)", () => {
  /** A premium (non-Explorer) Theme Item from the Catalog for gating tests. */
  const premiumTheme = catalogByKind("theme").find(
    (i) => i.required_tier !== "explorer",
  )!;

  async function seedRoom(tier: "explorer" | "studio") {
    const repo = new InMemoryCanvasRepository();
    const room = await repo.insertRoom("u1", "Room");
    useAppStore.setState({
      repo,
      session: { user: { id: "u1" } } as never,
      currentRoom: room,
      rooms: [room],
      entitlements: entitlementsForTier(tier),
      customizationRefused: false,
    } as never);
    return room;
  }

  it("applies an unlocked Item and persists it on the Room", async () => {
    await seedRoom("studio");
    await useAppStore.getState().applyCustomization("theme", premiumTheme.id);
    expect(useAppStore.getState().currentRoom?.theme_id).toBe(premiumTheme.id);
    expect(useAppStore.getState().customizationRefused).toBe(false);
  });

  it("refuses a locked Item (Explorer entitlements) without persisting", async () => {
    await seedRoom("explorer");
    await useAppStore.getState().applyCustomization("theme", premiumTheme.id);
    expect(useAppStore.getState().currentRoom?.theme_id ?? null).toBeNull();
    expect(useAppStore.getState().customizationRefused).toBe(true);
  });
});

describe("store — resizeRoom (Studio room resize)", () => {
  const grand = roomSizePresetById("grand")!;

  async function seedRoom(tier: "resident" | "studio") {
    const repo = new InMemoryCanvasRepository();
    const room = await repo.insertRoom("u1", "Room");
    useAppStore.setState({
      repo,
      session: { user: { id: "u1" } } as never,
      currentRoom: room,
      rooms: [room],
      entitlements: entitlementsForTier(tier),
      customizationRefused: false,
    } as never);
    return room;
  }

  it("resizes the Room for a Studio member and persists the new dimensions", async () => {
    await seedRoom("studio");
    await useAppStore.getState().resizeRoom("grand");
    const room = useAppStore.getState().currentRoom!;
    expect(room.width_m).toBe(grand.width_m);
    expect(room.depth_m).toBe(grand.depth_m);
    expect(room.height_m).toBe(grand.height_m);
    expect(useAppStore.getState().customizationRefused).toBe(false);
  });

  it("refuses to resize below Studio (no persistence) and flags the nudge seam", async () => {
    const before = await seedRoom("resident");
    await useAppStore.getState().resizeRoom("grand");
    const room = useAppStore.getState().currentRoom!;
    expect(room.width_m).toBe(before.width_m);
    expect(useAppStore.getState().customizationRefused).toBe(true);
  });
});

describe("store — createRoom multi-room gating (issue #109, ADR-0021)", () => {
  it("refuses to create beyond the Plan's Room cap (Explorer = 1)", async () => {
    const repo = new InMemoryCanvasRepository();
    const room = await repo.insertRoom("u1", "Room");
    useAppStore.setState({
      repo,
      session: { user: { id: "u1" } } as never,
      currentRoom: room,
      rooms: [room],
      entitlements: entitlementsForTier("explorer"),
    } as never);

    const created = await useAppStore.getState().createRoom("Second");

    expect(created).toBeNull();
    expect(repo.rooms).toHaveLength(1); // nothing new persisted
    expect(useAppStore.getState().rooms).toHaveLength(1);
  });

  it("allows creation under the cap (Studio = unlimited)", async () => {
    const repo = new InMemoryCanvasRepository();
    const room = await repo.insertRoom("u1", "Room");
    useAppStore.setState({
      repo,
      session: { user: { id: "u1" } } as never,
      currentRoom: room,
      rooms: [room],
      entitlements: entitlementsForTier("studio"),
    } as never);

    const created = await useAppStore.getState().createRoom("Second");

    expect(created).not.toBeNull();
    expect(repo.rooms.length).toBeGreaterThan(1);
  });
});

describe("store — ambient soundscape (issue #128, ADR-0024)", () => {
  beforeEach(() => {
    useAppStore.setState({ audioEnabled: false, audioTrackId: "forest" });
  });

  it("opens silent on the default (forest) track", () => {
    expect(useAppStore.getState().audioEnabled).toBe(false);
    expect(useAppStore.getState().audioTrackId).toBe("forest");
  });

  it("toggleAudio flips the on/off flag", () => {
    useAppStore.getState().toggleAudio();
    expect(useAppStore.getState().audioEnabled).toBe(true);
    useAppStore.getState().toggleAudio();
    expect(useAppStore.getState().audioEnabled).toBe(false);
  });

  it("setAudioTrack switches to a valid track id", () => {
    useAppStore.getState().setAudioTrack("music");
    expect(useAppStore.getState().audioTrackId).toBe("music");
  });

  it("setAudioTrack ignores an unknown id (authoring guard)", () => {
    useAppStore.getState().setAudioTrack("not-a-track");
    expect(useAppStore.getState().audioTrackId).toBe("forest");
  });
});

describe("store — eraseStrokeAt (Eraser tool, issue #132)", () => {
  /** Seed one Annotation on `s1` carrying a single horizontal Stroke. */
  function seedAnnotation() {
    useAppStore.setState({
      annotations: [
        {
          id: "a1",
          surface_id: "s1",
          owner_id: "u1",
          strokes: [
            {
              id: "stroke-1",
              annotation_id: "a1",
              points: [
                { u: 0.2, v: 0.5, p: 0.5, t: 0 },
                { u: 0.8, v: 0.5, p: 0.5, t: 10 },
              ],
              color_id: "ink",
              width_id: "fine",
              index: 0,
              created_at: "2026-01-01T00:00:00Z",
            },
          ],
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        },
      ],
    });
  }

  beforeEach(() => {
    useAppStore.setState({ annotations: [], repo: null });
  });

  it("erases a hit Stroke and persists via repo.deleteStroke", async () => {
    const deleteStroke = vi.fn(async () => {});
    const repo = { deleteStroke } as unknown as CanvasRepository;
    seedAnnotation();
    useAppStore.setState({ repo });

    // (0.5, 0.5) is the midpoint of the Stroke — a clear hit.
    await useAppStore.getState().eraseStrokeAt("s1", 0.5, 0.5);

    expect(useAppStore.getState().annotations[0].strokes).toHaveLength(0);
    expect(deleteStroke).toHaveBeenCalledWith("stroke-1");
  });

  it("leaves a Stroke untouched when the eraser misses", async () => {
    const deleteStroke = vi.fn(async () => {});
    const repo = { deleteStroke } as unknown as CanvasRepository;
    seedAnnotation();
    useAppStore.setState({ repo });

    // Far from the horizontal Stroke at v=0.5.
    await useAppStore.getState().eraseStrokeAt("s1", 0.5, 0.95);

    expect(useAppStore.getState().annotations[0].strokes).toHaveLength(1);
    expect(deleteStroke).not.toHaveBeenCalled();
  });

  it("rolls the Stroke back when repo.deleteStroke throws", async () => {
    const repo = {
      async deleteStroke() {
        throw new Error("offline");
      },
    } as unknown as CanvasRepository;
    seedAnnotation();
    useAppStore.setState({ repo });

    await useAppStore.getState().eraseStrokeAt("s1", 0.5, 0.5);

    expect(useAppStore.getState().annotations[0].strokes).toHaveLength(1);
    expect(useAppStore.getState().annotations[0].strokes[0].id).toBe("stroke-1");
  });
});
