import { describe, it, expect } from "vitest";
import { applyDragDelta } from "./drag";
import type { NoteRow } from "./canvas-repository";

const note = (id: string, x: number, y: number): NoteRow => ({
  id,
  canvas_id: "c1",
  owner_id: "u1",
  x,
  y,
  depth: "mid",
  width: 240,
  height: 160,
  body: id,
  color_id: "warm-white",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
});

describe("applyDragDelta — single Note drag", () => {
  it("moves the lead Note by the delta and leaves other Notes alone", () => {
    const notes = [note("a", 10, 20), note("b", 100, 200)];
    const result = applyDragDelta(notes, {
      selection: new Set(["a"]),
      leadId: "a",
      dx: 5,
      dy: -7,
    });

    expect(result.find((n) => n.id === "a")).toMatchObject({ x: 15, y: 13 });
    expect(result.find((n) => n.id === "b")).toMatchObject({ x: 100, y: 200 });
  });
});
