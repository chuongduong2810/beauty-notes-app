import { describe, it, expect } from "vitest";
import { readOnlyRoomIds, canCreateRoom } from "./room-access";
import type { Room } from "./room";

function room(id: string, updated_at: string): Room {
  return { id, updated_at } as unknown as Room;
}

describe("room-access — read-only extras past the Plan cap (issue #109)", () => {
  it("nothing is read-only within the cap", () => {
    const rooms = [room("a", "2026-01-02"), room("b", "2026-01-01")];
    expect(readOnlyRoomIds(rooms, 5).size).toBe(0);
    expect(readOnlyRoomIds(rooms, 2).size).toBe(0);
  });

  it("locks the stalest Rooms beyond the cap, keeping the most recent active", () => {
    const rooms = [
      room("old", "2026-01-01"),
      room("mid", "2026-02-01"),
      room("new", "2026-03-01"),
    ];
    // Explorer cap = 1 → keep "new", lock "mid" + "old".
    const ro = readOnlyRoomIds(rooms, 1);
    expect(ro.has("new")).toBe(false);
    expect(ro.has("mid")).toBe(true);
    expect(ro.has("old")).toBe(true);
  });

  it("Studio (Infinity) locks nothing", () => {
    const rooms = [room("a", "2026-01-01"), room("b", "2026-01-02")];
    expect(readOnlyRoomIds(rooms, Infinity).size).toBe(0);
  });

  it("canCreateRoom is true only below the cap", () => {
    expect(canCreateRoom(0, 1)).toBe(true);
    expect(canCreateRoom(1, 1)).toBe(false);
    expect(canCreateRoom(2, Infinity)).toBe(true);
  });
});
