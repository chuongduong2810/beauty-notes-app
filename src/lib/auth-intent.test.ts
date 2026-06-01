import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  clearAuthIntent,
  getAuthIntent,
  setAuthIntent,
} from "./auth-intent";

describe("auth-intent (issue #82, ADR-0019)", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });
  afterEach(() => {
    window.localStorage.clear();
  });

  it("round-trips a stored intent", () => {
    setAuthIntent("restore");
    expect(getAuthIntent()).toBe("restore");

    setAuthIntent("claim");
    expect(getAuthIntent()).toBe("claim");
  });

  it("returns null when nothing has been recorded", () => {
    expect(getAuthIntent()).toBeNull();
  });

  it("clears the recorded intent", () => {
    setAuthIntent("restore");
    clearAuthIntent();
    expect(getAuthIntent()).toBeNull();
  });

  it("treats an unrecognised stored value as null", () => {
    window.localStorage.setItem("bn.auth-intent", "nonsense");
    expect(getAuthIntent()).toBeNull();
  });
});
