import { describe, it, expect } from "vitest";
import { surfaceTransform } from "./surface-geometry";

const W = 6;
const D = 6;
const H = 3;

describe("surfaceTransform — Surface plane placement inside a Room", () => {
  // Coordinate system (Three.js, right-handed, Y up):
  //   origin = room centre on the floor (y = 0).
  //   +X east, +Z south, -Z north.
  //   Camera at (0, 1.6, 0) faces -Z by default.

  it("wall_north sits at z = -depth/2 at room mid-height, normal pointing inward (+Z)", () => {
    const t = surfaceTransform("wall_north", W, D, H);
    expect(t.position).toEqual([0, H / 2, -D / 2]);
    expect(t.size).toEqual([W, H]);
    // planeGeometry default normal is +Z, so no rotation needed for wall_north
    // (which must face +Z toward the camera at origin).
    expect(t.rotation).toEqual([0, 0, 0]);
  });

  it("wall_south sits at z = +depth/2, rotated 180° around Y to face -Z", () => {
    const t = surfaceTransform("wall_south", W, D, H);
    expect(t.position).toEqual([0, H / 2, D / 2]);
    expect(t.size).toEqual([W, H]);
    expect(t.rotation).toEqual([0, Math.PI, 0]);
  });

  it("wall_east sits at x = +width/2, rotated -90° around Y to face -X", () => {
    const t = surfaceTransform("wall_east", W, D, H);
    expect(t.position).toEqual([W / 2, H / 2, 0]);
    expect(t.size).toEqual([D, H]);
    expect(t.rotation).toEqual([0, -Math.PI / 2, 0]);
  });

  it("wall_west sits at x = -width/2, rotated +90° around Y to face +X", () => {
    const t = surfaceTransform("wall_west", W, D, H);
    expect(t.position).toEqual([-W / 2, H / 2, 0]);
    expect(t.size).toEqual([D, H]);
    expect(t.rotation).toEqual([0, Math.PI / 2, 0]);
  });

  it("floor sits at y = 0, rotated -90° around X to face up (+Y)", () => {
    const t = surfaceTransform("floor", W, D, H);
    expect(t.position).toEqual([0, 0, 0]);
    expect(t.size).toEqual([W, D]);
    expect(t.rotation).toEqual([-Math.PI / 2, 0, 0]);
  });

  it("ceiling sits at y = height, rotated +90° around X to face down (-Y)", () => {
    const t = surfaceTransform("ceiling", W, D, H);
    expect(t.position).toEqual([0, H, 0]);
    expect(t.size).toEqual([W, D]);
    expect(t.rotation).toEqual([Math.PI / 2, 0, 0]);
  });
});
