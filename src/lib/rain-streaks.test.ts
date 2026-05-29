import { describe, it, expect } from "vitest";
import {
  rainStreakLayout,
  scrollOffset,
  RAIN_STREAK_COUNT,
  type RainStreak,
} from "./rain-streaks";

describe("rainStreakLayout — deterministic on-glass rain streaks", () => {
  // The streaks are the on-glass layer of the Weather (ADR-0015): a fixed,
  // procedural set of vertical droplet trails. Like the City skyline they
  // come from a seeded PRNG — never Math.random — so the glass looks the
  // same on every render and across reloads.
  const streaks = rainStreakLayout(0x9173);

  it("produces a non-trivial set of streaks", () => {
    expect(streaks.length).toBe(RAIN_STREAK_COUNT);
    expect(streaks.length).toBeGreaterThanOrEqual(8);
  });

  it("keeps every streak parameter within sane, subtle bounds", () => {
    for (const s of streaks) {
      // Horizontal position is a normalized column across the pane.
      expect(s.x).toBeGreaterThanOrEqual(0);
      expect(s.x).toBeLessThanOrEqual(1);
      // A streak is a fraction of the pane height, never zero or absurd.
      expect(s.length).toBeGreaterThan(0);
      expect(s.length).toBeLessThanOrEqual(1);
      // Width stays thin so trails read as droplets, not bars.
      expect(s.width).toBeGreaterThan(0);
      expect(s.width).toBeLessThan(0.1);
      // Speed is positive (always running downward) and bounded.
      expect(s.speed).toBeGreaterThan(0);
      expect(s.speed).toBeLessThanOrEqual(1);
      // Opacity stays subtle so the City behind stays clearly visible.
      expect(s.opacity).toBeGreaterThan(0);
      expect(s.opacity).toBeLessThanOrEqual(0.5);
    }
  });

  it("is deterministic — same seed yields an identical layout", () => {
    const a = rainStreakLayout(0x9173);
    const b = rainStreakLayout(0x9173);
    expect(a).toEqual(b);
  });

  it("yields different layouts for different seeds", () => {
    const a = rainStreakLayout(1);
    const b = rainStreakLayout(2);
    expect(a).not.toEqual(b);
  });

  it("gives streaks varied positions (not a single column)", () => {
    const xs = new Set(streaks.map((s: RainStreak) => s.x));
    expect(xs.size).toBeGreaterThan(1);
  });
});

describe("scrollOffset — downward scroll that wraps", () => {
  // The streak texture scrolls down over time; the offset is the texture's
  // vertical phase, wrapped into [0, 1) so it loops seamlessly forever.
  it("starts at 0 when time is 0", () => {
    expect(scrollOffset(0, 0.5)).toBe(0);
  });

  it("always stays within [0, 1)", () => {
    for (let t = 0; t < 100; t += 0.37) {
      const o = scrollOffset(t, 0.8);
      expect(o).toBeGreaterThanOrEqual(0);
      expect(o).toBeLessThan(1);
    }
  });

  it("wraps: one full period returns to the start", () => {
    const speed = 0.25;
    // After 1/speed seconds the phase has advanced exactly one full cycle.
    expect(scrollOffset(1 / speed, speed)).toBeCloseTo(0, 6);
  });

  it("advances monotonically within a single period", () => {
    const speed = 0.3;
    expect(scrollOffset(0.5, speed)).toBeGreaterThan(scrollOffset(0.1, speed));
  });
});
