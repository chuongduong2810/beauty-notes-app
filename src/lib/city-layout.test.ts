import { describe, it, expect } from "vitest";
import {
  buildingLayout,
  windowPlacement,
  CITY_DEPTH_LAYERS,
  type Building,
} from "./city-layout";
import {
  DEFAULT_ROOM_WIDTH_M,
  DEFAULT_ROOM_DEPTH_M,
  DEFAULT_ROOM_HEIGHT_M,
} from "./room";

const W = DEFAULT_ROOM_WIDTH_M;
const D = DEFAULT_ROOM_DEPTH_M;
const H = DEFAULT_ROOM_HEIGHT_M;

/** World X of the west wall plane: the room's interior boundary at -W/2.
 *  Anything with X < this value is OUTSIDE the Room (ADR-0015 — the City
 *  lives beyond the Room). */
const WEST_WALL_X = -W / 2;

describe("windowPlacement — set-dressing Window on wall_west", () => {
  // The Window is decoration in FRONT of wall_west (ADR-0015): not a
  // Surface, not persisted, not a 7th member of the six. It is sized to
  // sit comfortably within the wall plane (depth_m wide, height_m tall)
  // without clipping the edges.
  const win = windowPlacement(W, D, H);

  it("fits inside the wall plane with margin on every edge", () => {
    // wall_west's local plane spans depth_m (local X) by height_m (local Y).
    expect(win.width).toBeGreaterThan(0);
    expect(win.height).toBeGreaterThan(0);
    expect(win.width).toBeLessThan(D);
    expect(win.height).toBeLessThan(H);
    // Centre + half-extents must stay strictly inside the plane bounds,
    // so the frame never clips the Surface edge.
    expect(Math.abs(win.center[0]) + win.width / 2).toBeLessThan(D / 2);
    expect(win.center[1] + win.height / 2).toBeLessThan(H);
    expect(win.center[1] - win.height / 2).toBeGreaterThan(0);
  });

  it("is centred horizontally on the wall", () => {
    expect(win.center[0]).toBe(0);
  });

  it("sits around eye level (not on the floor, not at the ceiling)", () => {
    expect(win.center[1]).toBeGreaterThan(H * 0.3);
    expect(win.center[1]).toBeLessThan(H * 0.8);
  });
});

describe("buildingLayout — procedural City skyline beyond the Room", () => {
  const buildings = buildingLayout(W);

  it("produces a non-trivial skyline", () => {
    expect(buildings.length).toBeGreaterThanOrEqual(12);
  });

  it("places EVERY building outside the Room volume, beyond the west wall", () => {
    // The west wall plane is at x = -W/2; the Room interior is x > -W/2.
    // Every building (its near face, x + halfDepth) must sit strictly
    // beyond the wall so nothing intrudes into the Room.
    for (const b of buildings) {
      const nearFaceX = b.position[0] + b.size[0] / 2;
      expect(nearFaceX).toBeLessThan(WEST_WALL_X);
    }
  });

  it("distributes buildings across multiple depth layers for parallax", () => {
    const layers = new Set(buildings.map((b) => b.depthLayer));
    expect(layers.size).toBe(CITY_DEPTH_LAYERS);
    expect(CITY_DEPTH_LAYERS).toBeGreaterThanOrEqual(3);
    // Each declared layer is actually populated.
    for (let i = 0; i < CITY_DEPTH_LAYERS; i++) {
      expect(buildings.some((b) => b.depthLayer === i)).toBe(true);
    }
  });

  it("pushes deeper layers further from the wall (real depth separation)", () => {
    // The minimum distance-behind-the-wall of each layer must increase
    // with the layer index, so near and far buildings genuinely separate.
    const minDepthByLayer = (layer: number) =>
      Math.min(
        ...buildings
          .filter((b) => b.depthLayer === layer)
          .map((b) => WEST_WALL_X - b.position[0]),
      );
    for (let i = 1; i < CITY_DEPTH_LAYERS; i++) {
      expect(minDepthByLayer(i)).toBeGreaterThan(minDepthByLayer(i - 1));
    }
  });

  it("gives buildings positive, varied dimensions", () => {
    const heights = new Set<number>();
    for (const b of buildings) {
      expect(b.size[0]).toBeGreaterThan(0);
      expect(b.size[1]).toBeGreaterThan(0);
      expect(b.size[2]).toBeGreaterThan(0);
      // Buildings rise from the ground: centre Y is half their height.
      expect(b.position[1]).toBeCloseTo(b.size[1] / 2, 6);
      heights.add(b.size[1]);
    }
    // Variety, not a row of identical blocks.
    expect(heights.size).toBeGreaterThan(1);
  });

  it("is deterministic — same input yields an identical layout", () => {
    const a = buildingLayout(W);
    const b = buildingLayout(W);
    expect(a).toEqual(b);
  });

  it("scales the field span with the wall it sits behind", () => {
    // A wider Room (wider west wall) should spread the skyline wider so
    // the view through the window still reads as a full skyline.
    const wide = buildingLayout(W * 2);
    const spread = (set: readonly Building[]) => {
      const zs = set.map((b) => b.position[2]);
      return Math.max(...zs) - Math.min(...zs);
    };
    expect(spread(wide)).toBeGreaterThan(spread(buildings));
  });
});
