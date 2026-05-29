import { describe, expect, it } from "vitest";
import { parseRoomIdFromPath, roomPath } from "./room-route";

describe("Room route helpers (issue #22)", () => {
  describe("parseRoomIdFromPath", () => {
    it("extracts the room id from /room/<id>", () => {
      expect(parseRoomIdFromPath("/room/abc-123")).toBe("abc-123");
    });

    it("extracts the room id from /room/<uuid>", () => {
      expect(parseRoomIdFromPath("/room/d3b0c44e-1234-4abc-9def-1234567890ab")).toBe(
        "d3b0c44e-1234-4abc-9def-1234567890ab",
      );
    });

    it("returns null for the root path", () => {
      expect(parseRoomIdFromPath("/")).toBeNull();
    });

    it("returns null for a bare /room with no id", () => {
      expect(parseRoomIdFromPath("/room")).toBeNull();
      expect(parseRoomIdFromPath("/room/")).toBeNull();
    });

    it("returns null for unrelated paths", () => {
      expect(parseRoomIdFromPath("/notes/abc")).toBeNull();
      expect(parseRoomIdFromPath("/foo/room/abc")).toBeNull();
    });

    it("ignores trailing segments past the id", () => {
      expect(parseRoomIdFromPath("/room/abc/extra")).toBe("abc");
    });

    it("ignores query strings and hash fragments", () => {
      expect(parseRoomIdFromPath("/room/abc?focus=note-1")).toBe("abc");
      expect(parseRoomIdFromPath("/room/abc#section")).toBe("abc");
    });
  });

  describe("roomPath", () => {
    it("builds /room/<id> from a room id", () => {
      expect(roomPath("abc-123")).toBe("/room/abc-123");
    });

    it("round-trips with parseRoomIdFromPath", () => {
      const id = "d3b0c44e-1234-4abc-9def-1234567890ab";
      expect(parseRoomIdFromPath(roomPath(id))).toBe(id);
    });
  });
});
