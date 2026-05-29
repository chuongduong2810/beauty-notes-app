import type { Session } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { claimRedirectUrl, ownershipFromSession } from "./ownership";

/**
 * Minimal Session stub for the ownership derivations. We only read
 * `user.is_anonymous` and `user.email`, so the rest of the Session /
 * User shape is filled with throwaway values to satisfy the type.
 */
function fakeSession(user: {
  is_anonymous?: boolean;
  email?: string;
}): Session {
  return {
    access_token: "a",
    refresh_token: "r",
    expires_in: 3600,
    token_type: "bearer",
    user: {
      id: "user-1",
      app_metadata: {},
      user_metadata: {},
      aud: "authenticated",
      created_at: "2026-01-01T00:00:00Z",
      is_anonymous: user.is_anonymous,
      email: user.email,
    },
  } as unknown as Session;
}

describe("ownershipFromSession (issue #70)", () => {
  it("treats an anonymous session as a guest with no email / name", () => {
    const result = ownershipFromSession(fakeSession({ is_anonymous: true }));
    expect(result).toEqual({
      isGuest: true,
      email: null,
      displayName: null,
    });
  });

  it("treats a permanent (email) session as a claimed owner", () => {
    const result = ownershipFromSession(
      fakeSession({ is_anonymous: false, email: "ada@example.com" }),
    );
    expect(result).toEqual({
      isGuest: false,
      email: "ada@example.com",
      displayName: "ada",
    });
  });

  it("treats a null session as a guest", () => {
    expect(ownershipFromSession(null)).toEqual({
      isGuest: true,
      email: null,
      displayName: null,
    });
  });
});

describe("claimRedirectUrl (issue #70)", () => {
  it("joins the origin with the canonical Room route", () => {
    expect(claimRedirectUrl("abc-123", "https://notes.example.com")).toBe(
      "https://notes.example.com/room/abc-123",
    );
  });
});
