import { describe, expect, it } from "vitest";
import {
  buildNotebookSections,
  noteSnippet,
  NOTEBOOK_SECTION_LIMIT,
} from "./notebook-sections";
import type { Note } from "./room";

/**
 * Build a Note fixture with explicit timestamps + bookmark state. Only
 * the fields the section-builder reads matter; the rest are filler.
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
    color_id: "butter",
    bookmarked: false,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...over,
  };
}

describe("buildNotebookSections", () => {
  it("sorts Recently Created by created_at descending", () => {
    const notes = [
      makeNote({ id: "a", created_at: "2026-05-01T00:00:00.000Z" }),
      makeNote({ id: "b", created_at: "2026-05-03T00:00:00.000Z" }),
      makeNote({ id: "c", created_at: "2026-05-02T00:00:00.000Z" }),
    ];
    const { recentlyCreated } = buildNotebookSections(notes);
    expect(recentlyCreated.map((n) => n.id)).toEqual(["b", "c", "a"]);
  });

  it("sorts Recently Edited by updated_at descending", () => {
    const notes = [
      makeNote({ id: "a", updated_at: "2026-05-01T00:00:00.000Z" }),
      makeNote({ id: "b", updated_at: "2026-05-09T00:00:00.000Z" }),
      makeNote({ id: "c", updated_at: "2026-05-05T00:00:00.000Z" }),
    ];
    const { recentlyEdited } = buildNotebookSections(notes);
    expect(recentlyEdited.map((n) => n.id)).toEqual(["b", "c", "a"]);
  });

  it("includes only Bookmarked Notes, newest-edited first", () => {
    const notes = [
      makeNote({ id: "a", bookmarked: true, updated_at: "2026-05-01T00:00:00.000Z" }),
      makeNote({ id: "b", bookmarked: false, updated_at: "2026-05-09T00:00:00.000Z" }),
      makeNote({ id: "c", bookmarked: true, updated_at: "2026-05-05T00:00:00.000Z" }),
    ];
    const { bookmarked } = buildNotebookSections(notes);
    expect(bookmarked.map((n) => n.id)).toEqual(["c", "a"]);
  });

  it("caps each section at the limit", () => {
    const many = Array.from({ length: NOTEBOOK_SECTION_LIMIT + 4 }, (_, i) =>
      makeNote({
        id: `n${i}`,
        bookmarked: true,
        created_at: `2026-05-${String(i + 1).padStart(2, "0")}T00:00:00.000Z`,
      }),
    );
    const sections = buildNotebookSections(many);
    expect(sections.recentlyCreated).toHaveLength(NOTEBOOK_SECTION_LIMIT);
    expect(sections.bookmarked).toHaveLength(NOTEBOOK_SECTION_LIMIT);
  });

  it("respects a custom limit", () => {
    const notes = [
      makeNote({ id: "a" }),
      makeNote({ id: "b" }),
      makeNote({ id: "c" }),
    ];
    expect(buildNotebookSections(notes, 2).recentlyCreated).toHaveLength(2);
  });

  it("does not mutate the input array", () => {
    const notes = [
      makeNote({ id: "a", created_at: "2026-05-01T00:00:00.000Z" }),
      makeNote({ id: "b", created_at: "2026-05-03T00:00:00.000Z" }),
    ];
    const before = notes.map((n) => n.id);
    buildNotebookSections(notes);
    expect(notes.map((n) => n.id)).toEqual(before);
  });
});

describe("noteSnippet", () => {
  it("falls back to 'Untitled note' for an empty body", () => {
    expect(noteSnippet("")).toBe("Untitled note");
    expect(noteSnippet("   \n  ")).toBe("Untitled note");
  });

  it("takes the first non-empty line and collapses whitespace", () => {
    expect(noteSnippet("\n\nhello   world\nsecond line")).toBe("hello world");
  });

  it("truncates long text with an ellipsis", () => {
    const long = "x".repeat(50);
    expect(noteSnippet(long, 10)).toBe(`${"x".repeat(10)}…`);
  });
});
