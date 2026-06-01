import { describe, expect, it } from "vitest";
import { MIN_PASSWORD_LENGTH, PASSWORD_HINT, isValidPassword } from "./password";

describe("isValidPassword (ADR-0020)", () => {
  it("accepts a password at the minimum length", () => {
    expect(isValidPassword("a".repeat(MIN_PASSWORD_LENGTH))).toBe(true);
  });

  it("accepts a password longer than the minimum", () => {
    expect(isValidPassword("a".repeat(MIN_PASSWORD_LENGTH + 5))).toBe(true);
  });

  it("rejects a password shorter than the minimum", () => {
    expect(isValidPassword("a".repeat(MIN_PASSWORD_LENGTH - 1))).toBe(false);
  });

  it("rejects an empty password", () => {
    expect(isValidPassword("")).toBe(false);
  });
});

describe("password policy exports", () => {
  it("exports a minimum length of 8", () => {
    expect(MIN_PASSWORD_LENGTH).toBe(8);
  });

  it("exports a non-empty human hint", () => {
    expect(PASSWORD_HINT.length).toBeGreaterThan(0);
  });
});
