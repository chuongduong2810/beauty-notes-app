import { describe, it, expect } from "vitest";
import { selectOne } from "./selection";

describe("selection — click on a Note", () => {
  it("selects exactly that Note, replacing any previous selection", () => {
    const next = selectOne(new Set(["other"]), "n1");
    expect([...next]).toEqual(["n1"]);
  });
});
