import { describe, it, expect } from "vitest";
import { SURFACE_KINDS, defaultSurfaces } from "./room";

describe("SURFACE_KINDS — the six fixed Surfaces of a Room (ADR-0008)", () => {
  it("enumerates the six kinds in a stable order", () => {
    expect(SURFACE_KINDS).toEqual([
      "wall_north",
      "wall_south",
      "wall_east",
      "wall_west",
      "floor",
      "ceiling",
    ]);
  });
});

describe("defaultSurfaces — seed payload for a new Room", () => {
  it("returns one entry per SURFACE_KIND, all defaulted to the warm-white palette", () => {
    const surfaces = defaultSurfaces();
    expect(surfaces).toHaveLength(6);
    expect(surfaces.map((s) => s.kind)).toEqual([...SURFACE_KINDS]);
    expect(surfaces.every((s) => s.color_id === "warm-white")).toBe(true);
  });
});
