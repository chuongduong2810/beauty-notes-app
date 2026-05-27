import { describe, it, expect } from "vitest";
import { DeleteUndoStack } from "./delete-undo-stack";
import type { NoteRow } from "./canvas-repository";

const note = (id: string): NoteRow => ({
  id,
  canvas_id: "c1",
  owner_id: "u1",
  x: 0, y: 0, depth: "mid", width: 240, height: 160,
  body: id, color_id: "warm-white",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
});

describe("DeleteUndoStack", () => {
  it("pops the most recently pushed delete action (LIFO)", () => {
    const stack = new DeleteUndoStack();
    stack.push([note("a"), note("b")]);
    stack.push([note("c")]);

    const popped = stack.pop();
    expect(popped?.map((n) => n.id)).toEqual(["c"]);

    const next = stack.pop();
    expect(next?.map((n) => n.id)).toEqual(["a", "b"]);
  });

  it("returns null when popping an empty stack", () => {
    const stack = new DeleteUndoStack();
    expect(stack.pop()).toBeNull();
  });

  it("ignores empty pushes so Delete on an empty selection doesn't poison the stack", () => {
    const stack = new DeleteUndoStack();
    stack.push([]);
    expect(stack.size).toBe(0);
    expect(stack.pop()).toBeNull();
  });
});
