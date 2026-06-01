import { describe, expect, it } from "vitest";
import {
  entitlementsForTier,
  tierFromMembership,
  type Entitlements,
  type Membership,
} from "./entitlements";

describe("entitlementsForTier (issue #102, ADR-0021)", () => {
  it("Explorer is the free baseline: one Room, everything else off", () => {
    expect(entitlementsForTier("explorer")).toEqual<Entitlements>({
      maxRooms: 1,
      premiumFurniture: false,
      advancedThemes: false,
      ambiencePresets: false,
      cameraViewpoints: false,
      photoMode: false,
      blueprintMode: false,
      advancedCustomization: false,
    });
  });

  it("Resident adds furniture/themes/ambience/viewpoints/photo, still one Room", () => {
    expect(entitlementsForTier("resident")).toEqual<Entitlements>({
      maxRooms: 1,
      premiumFurniture: true,
      advancedThemes: true,
      ambiencePresets: true,
      cameraViewpoints: true,
      photoMode: true,
      blueprintMode: false,
      advancedCustomization: false,
    });
  });

  it("Studio unlocks everything plus unlimited Rooms", () => {
    expect(entitlementsForTier("studio")).toEqual<Entitlements>({
      maxRooms: Infinity,
      premiumFurniture: true,
      advancedThemes: true,
      ambiencePresets: true,
      cameraViewpoints: true,
      photoMode: true,
      blueprintMode: true,
      advancedCustomization: true,
    });
  });
});

describe("tierFromMembership (issue #102, ADR-0021)", () => {
  // A fixed "now" so expiry tests are deterministic.
  const now = Date.parse("2026-06-01T00:00:00Z");

  it("treats a null Membership as explorer", () => {
    expect(tierFromMembership(null, now)).toBe("explorer");
  });

  it("treats a non-active status as explorer even with a future period end", () => {
    const lapsed: Membership = {
      tier: "studio",
      status: "canceled",
      current_period_end: "2026-12-31T00:00:00Z",
    };
    expect(tierFromMembership(lapsed, now)).toBe("explorer");
  });

  it("treats an active-but-expired Membership as explorer", () => {
    const expired: Membership = {
      tier: "resident",
      status: "active",
      current_period_end: "2026-05-01T00:00:00Z",
    };
    expect(tierFromMembership(expired, now)).toBe("explorer");
  });

  it("treats a period end exactly at now as expired", () => {
    const atBoundary: Membership = {
      tier: "studio",
      status: "active",
      current_period_end: "2026-06-01T00:00:00Z",
    };
    expect(tierFromMembership(atBoundary, now)).toBe("explorer");
  });

  it("returns the tier for an active, unexpired Membership", () => {
    const active: Membership = {
      tier: "studio",
      status: "active",
      current_period_end: "2026-07-01T00:00:00Z",
    };
    expect(tierFromMembership(active, now)).toBe("studio");
  });

  it("returns the tier when there is no period end (open-ended active)", () => {
    const openEnded: Membership = {
      tier: "resident",
      status: "active",
      current_period_end: null,
    };
    expect(tierFromMembership(openEnded, now)).toBe("resident");
  });

  it("returns the tier when current_period_end is omitted entirely", () => {
    const noEnd: Membership = { tier: "resident", status: "active" };
    expect(tierFromMembership(noEnd, now)).toBe("resident");
  });
});
