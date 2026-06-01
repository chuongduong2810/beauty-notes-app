import { describe, it, expect } from "vitest";
import {
  CATALOG,
  CatalogKind,
  catalogByKind,
  catalogItem,
  defaultItemFor,
  isItemUnlocked,
} from "./catalog";

const KINDS: CatalogKind[] = [
  "furniture",
  "theme",
  "lighting",
  "window_style",
  "ambience",
];

describe("CATALOG — per-kind customization Items (ADR-0022)", () => {
  it.each(KINDS)("kind %s has exactly one free explorer default", (kind) => {
    const defaults = catalogByKind(kind).filter(
      (item) => item.required_tier === "explorer"
    );
    expect(defaults).toHaveLength(1);
    expect(defaults[0].id).toBe(`default-${kind}`);
  });

  it.each(KINDS)("kind %s has at least one premium Item", (kind) => {
    const premium = catalogByKind(kind).filter(
      (item) => item.required_tier !== "explorer"
    );
    expect(premium.length).toBeGreaterThanOrEqual(1);
  });

  it("tags every Item with its own kind", () => {
    for (const kind of KINDS) {
      for (const item of catalogByKind(kind)) {
        expect(item.kind).toBe(kind);
      }
    }
  });

  it("has unique ids across the whole Catalog", () => {
    const ids = CATALOG.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("catalogItem", () => {
  it("finds an existing Item by id", () => {
    expect(catalogItem("midnight")?.label).toBe("Midnight");
  });

  it("returns undefined for an unknown id", () => {
    expect(catalogItem("nope")).toBeUndefined();
  });
});

describe("defaultItemFor", () => {
  it.each(KINDS)("returns the explorer default for %s", (kind) => {
    const item = defaultItemFor(kind);
    expect(item.id).toBe(`default-${kind}`);
    expect(item.required_tier).toBe("explorer");
  });
});

describe("isItemUnlocked", () => {
  it("always unlocks explorer (default) Items, even with no entitlements", () => {
    for (const kind of KINDS) {
      expect(isItemUnlocked(defaultItemFor(kind), {})).toBe(true);
    }
  });

  it("locks premium Items when no entitlement flag is set", () => {
    const premium = CATALOG.filter((item) => item.required_tier !== "explorer");
    for (const item of premium) {
      expect(isItemUnlocked(item, {})).toBe(false);
    }
  });

  it("unlocks resident Items when a premium feature flag is set", () => {
    const resident = CATALOG.find((i) => i.required_tier === "resident")!;
    expect(isItemUnlocked(resident, { advancedThemes: true })).toBe(true);
    expect(isItemUnlocked(resident, { premiumFurniture: true })).toBe(true);
    expect(isItemUnlocked(resident, { ambiencePresets: true })).toBe(true);
  });

  it("does not unlock studio Items from a single feature flag", () => {
    const studio = CATALOG.find((i) => i.required_tier === "studio")!;
    expect(isItemUnlocked(studio, { advancedThemes: true })).toBe(false);
  });

  it("unlocks every tier via the broad advancedCustomization flag", () => {
    for (const item of CATALOG) {
      expect(isItemUnlocked(item, { advancedCustomization: true })).toBe(true);
    }
  });
});
