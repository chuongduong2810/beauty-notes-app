import { describe, expect, it } from "vitest";
import { searchNotes, surfaceLabel } from "./note-search";
import type { Note } from "./room";

/**
 * Build a Note fixture; only `id` and `body` matter for search tests,
 * the rest is filler matching the schema.
 */
function makeNote(over: Partial<Note> & { id: string }): Note {
  return {
    surface_id: "s1",
    owner_id: "u1",
    u: 0.5,
    v: 0.5,
    width_cm: 12,
    height_cm: 9,
    body: "",
    color_id: "paper",
    bookmarked: false,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...over,
  };
}

describe("searchNotes", () => {
  it("returns [] for an empty or whitespace-only query", () => {
    const notes = [makeNote({ id: "a", body: "hello" })];
    expect(searchNotes(notes, "")).toEqual([]);
    expect(searchNotes(notes, "   ")).toEqual([]);
    expect(searchNotes(notes, "\n\t")).toEqual([]);
  });

  it("matches a substring anywhere in the body", () => {
    const notes = [
      makeNote({ id: "a", body: "buy milk and eggs" }),
      makeNote({ id: "b", body: "call the dentist" }),
    ];
    expect(searchNotes(notes, "milk").map((n) => n.id)).toEqual(["a"]);
    expect(searchNotes(notes, "dentist").map((n) => n.id)).toEqual(["b"]);
  });

  it("is case-insensitive", () => {
    const notes = [makeNote({ id: "a", body: "Groceries List" })];
    expect(searchNotes(notes, "groceries").map((n) => n.id)).toEqual(["a"]);
    expect(searchNotes(notes, "LIST").map((n) => n.id)).toEqual(["a"]);
  });

  it("ranks title-line matches above body-only matches", () => {
    const notes = [
      // match only in a later body line
      makeNote({ id: "body", body: "shopping\nremember the keys" }),
      // match in the first (title) line
      makeNote({ id: "title", body: "keys to the office" }),
    ];
    expect(searchNotes(notes, "keys").map((n) => n.id)).toEqual([
      "title",
      "body",
    ]);
  });

  it("caps results at the limit (default 12)", () => {
    const many = Array.from({ length: 20 }, (_, i) =>
      makeNote({ id: `n${i}`, body: `task number ${i}` }),
    );
    expect(searchNotes(many, "task")).toHaveLength(12);
    expect(searchNotes(many, "task", 5)).toHaveLength(5);
  });

  it("returns no matches when nothing contains the query", () => {
    const notes = [makeNote({ id: "a", body: "hello world" })];
    expect(searchNotes(notes, "zzz")).toEqual([]);
  });
});

describe("surfaceLabel", () => {
  it("maps each SurfaceKind to a human-readable label", () => {
    expect(surfaceLabel("wall_north")).toBe("North wall");
    expect(surfaceLabel("wall_south")).toBe("South wall");
    expect(surfaceLabel("wall_east")).toBe("East wall");
    expect(surfaceLabel("wall_west")).toBe("West wall");
    expect(surfaceLabel("floor")).toBe("Floor");
    expect(surfaceLabel("ceiling")).toBe("Ceiling");
  });
});
