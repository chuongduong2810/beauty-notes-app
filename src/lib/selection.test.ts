import { describe, it, expect } from "vitest";
import { selectOne, toggleInSelection, clearSelection } from "./selection";

describe("selection — click on a Note", () => {
  it("selects exactly that Note, replacing any previous selection", () => {
    const next = selectOne(new Set(["other"]), "n1");
    expect([...next]).toEqual(["n1"]);
  });
});

describe("selection — shift-click on a Note", () => {
  it("adds the Note to the selection when it isn't already selected", () => {
    const next = toggleInSelection(new Set(["a"]), "b");
    expect(new Set(next)).toEqual(new Set(["a", "b"]));
  });

  it("removes the Note from the selection when it is already selected", () => {
    const next = toggleInSelection(new Set(["a", "b"]), "b");
    expect([...next]).toEqual(["a"]);
  });
});

describe("selection — click on empty Canvas", () => {
  it("clears the selection", () => {
    const next = clearSelection(new Set(["a", "b", "c"]));
    expect([...next]).toEqual([]);
  });
});
