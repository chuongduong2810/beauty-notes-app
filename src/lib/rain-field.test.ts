import { describe, it, expect } from "vitest";
import {
  createRainField,
  stepRaindrop,
  RAIN_BOUNDS,
  type RainBounds,
} from "./rain-field";
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

describe("createRainField — deterministic raindrop cloud", () => {
  const N = 400;

  it("creates the requested number of drops", () => {
    const field = createRainField(N, RAIN_BOUNDS(W), 0xabcdef);
    expect(field.count).toBe(N);
    expect(field.positions).toHaveLength(N * 3);
    expect(field.speeds).toHaveLength(N);
  });

  it("is deterministic — same seed yields an identical field", () => {
    const a = createRainField(N, RAIN_BOUNDS(W), 0xabcdef);
    const b = createRainField(N, RAIN_BOUNDS(W), 0xabcdef);
    expect(Array.from(a.positions)).toEqual(Array.from(b.positions));
    expect(Array.from(a.speeds)).toEqual(Array.from(b.speeds));
  });

  it("differs for a different seed", () => {
    const a = createRainField(N, RAIN_BOUNDS(W), 1);
    const b = createRainField(N, RAIN_BOUNDS(W), 2);
    expect(Array.from(a.positions)).not.toEqual(Array.from(b.positions));
  });

  it("places every drop within the bounds", () => {
    const bounds = RAIN_BOUNDS(W);
    const field = createRainField(N, bounds, 0xabcdef);
    for (let i = 0; i < N; i++) {
      const x = field.positions[i * 3];
      const y = field.positions[i * 3 + 1];
      const z = field.positions[i * 3 + 2];
      expect(x).toBeGreaterThanOrEqual(bounds.minX);
      expect(x).toBeLessThanOrEqual(bounds.maxX);
      expect(y).toBeGreaterThanOrEqual(bounds.minY);
      expect(y).toBeLessThanOrEqual(bounds.maxY);
      expect(z).toBeGreaterThanOrEqual(bounds.minZ);
      expect(z).toBeLessThanOrEqual(bounds.maxZ);
    }
  });

  it("gives every drop a positive fall speed", () => {
    const field = createRainField(N, RAIN_BOUNDS(W), 0xabcdef);
    for (let i = 0; i < N; i++) {
      expect(field.speeds[i]).toBeGreaterThan(0);
    }
  });
});

describe("stepRaindrop — seamless falling loop", () => {
  const bounds: RainBounds = {
    minX: -20,
    maxX: -10,
    minY: 0,
    maxY: 30,
    minZ: -15,
    maxZ: 15,
  };

  it("lowers a drop's Y by speed * dt while it is above the ground", () => {
    const next = stepRaindrop(5, 20, -3, 8, 0.5, bounds);
    expect(next.y).toBeCloseTo(20 - 8 * 0.5, 6);
    expect(next.x).toBe(5);
    expect(next.z).toBe(-3);
    expect(next.recycled).toBe(false);
  });

  it("recycles a drop that falls below the ground back to the top", () => {
    // Start just above the floor, take a big step so it passes minY.
    const next = stepRaindrop(7, 1, -2, 50, 0.5, bounds);
    expect(next.recycled).toBe(true);
    // Wrapped back up near the ceiling, X and Z preserved (same column).
    expect(next.y).toBeGreaterThan(bounds.minY);
    expect(next.y).toBeLessThanOrEqual(bounds.maxY);
    expect(next.x).toBe(7);
    expect(next.z).toBe(-2);
  });

  it("keeps the recycled drop inside the vertical bounds (seamless wrap)", () => {
    // Even a huge overshoot must land back within [minY, maxY].
    const next = stepRaindrop(0, 0.1, 0, 10000, 1, bounds);
    expect(next.y).toBeGreaterThanOrEqual(bounds.minY);
    expect(next.y).toBeLessThanOrEqual(bounds.maxY);
  });
});
