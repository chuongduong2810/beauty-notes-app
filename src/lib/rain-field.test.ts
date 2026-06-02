import { describe, it, expect } from "vitest";
import { RAIN_BOUNDS } from "./rain-field";
import { DEFAULT_ROOM_WIDTH_M } from "./room";

const W = DEFAULT_ROOM_WIDTH_M;

/** West wall plane: the Room boundary. Rain lives beyond it (x < this). */
const WEST_WALL_X = -W / 2;

describe("rainFieldBounds — the City rain volume", () => {
  const bounds = RAIN_BOUNDS(W);

  it("lies entirely outside the Room, beyond the west wall", () => {
    // The whole rain slab must sit at x < -W/2 so no drop can ever appear
    // inside the Room interior (ADR-0015 — Weather is the City's, not the
    // Room's). The near (largest) X edge stays strictly beyond the wall.
    expect(bounds.maxX).toBeLessThan(WEST_WALL_X);
    expect(bounds.minX).toBeLessThan(bounds.maxX);
  });

  it("spans from the ground up to a sky ceiling", () => {
    expect(bounds.minY).toBeGreaterThanOrEqual(0);
    expect(bounds.maxY).toBeGreaterThan(bounds.minY);
  });

  it("spreads across the skyline width", () => {
    expect(bounds.maxZ).toBeGreaterThan(bounds.minZ);
  });
});
