import { describe, expect, it } from "vitest";
import { buildCustomizationBrowser } from "./customization-browser";
import { entitlementsForTier } from "./entitlements";
import type { Room } from "./room";

/** A bare default Room (no Customization applied) for browser fixtures. */
function bareRoom(overrides: Partial<Room> = {}): Room {
  return {
    id: "room-1",
    owner_id: "user-1",
    name: "Test Room",
    width_m: 6,
    depth_m: 6,
    height_m: 3,
    camera_yaw: 0,
    camera_pitch: Math.PI / 2,
    camera_distance: 1.8,
    furniture: [],
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("buildCustomizationBrowser (issue #108)", () => {
  it("for an Explorer, marks each kind's free default as applied & unlocked and premium Items as locked", () => {
    const groups = buildCustomizationBrowser(
      bareRoom(),
      entitlementsForTier("explorer"),
    );

    const theme = groups.find((g) => g.kind === "theme");
    expect(theme).toBeDefined();

    const warmPlaster = theme!.items.find((i) => i.item.id === "default-theme");
    expect(warmPlaster).toMatchObject({ applied: true, locked: false });

    const midnight = theme!.items.find((i) => i.item.id === "midnight");
    expect(midnight).toMatchObject({ applied: false, locked: true });
  });

  it("marks the Room's applied single-layer Item as applied and the default as not", () => {
    const groups = buildCustomizationBrowser(
      bareRoom({ theme_id: "midnight" }),
      entitlementsForTier("resident"),
    );
    const theme = groups.find((g) => g.kind === "theme")!;
    expect(
      theme.items.find((i) => i.item.id === "midnight")?.applied,
    ).toBe(true);
    expect(
      theme.items.find((i) => i.item.id === "default-theme")?.applied,
    ).toBe(false);
  });

  it("marks furniture Items in the Room's set as applied; Bare Room applied only when the set is empty", () => {
    const applied = buildCustomizationBrowser(
      bareRoom({ furniture: ["cozy-set"] }),
      entitlementsForTier("resident"),
    ).find((g) => g.kind === "furniture")!;
    expect(applied.items.find((i) => i.item.id === "cozy-set")?.applied).toBe(true);
    expect(
      applied.items.find((i) => i.item.id === "default-furniture")?.applied,
    ).toBe(false);

    const bare = buildCustomizationBrowser(
      bareRoom({ furniture: [] }),
      entitlementsForTier("resident"),
    ).find((g) => g.kind === "furniture")!;
    expect(
      bare.items.find((i) => i.item.id === "default-furniture")?.applied,
    ).toBe(true);
  });

  it("unlocks resident-tier Items for a Resident but keeps studio-tier locked", () => {
    const groups = buildCustomizationBrowser(
      bareRoom(),
      entitlementsForTier("resident"),
    );
    const theme = groups.find((g) => g.kind === "theme")!;
    expect(theme.items.find((i) => i.item.id === "midnight")?.locked).toBe(false);
    expect(theme.items.find((i) => i.item.id === "noir-studio")?.locked).toBe(true);
  });

  it("unlocks every Item for a Studio member", () => {
    const groups = buildCustomizationBrowser(
      bareRoom(),
      entitlementsForTier("studio"),
    );
    const anyLocked = groups.some((g) => g.items.some((i) => i.locked));
    expect(anyLocked).toBe(false);
  });
});
