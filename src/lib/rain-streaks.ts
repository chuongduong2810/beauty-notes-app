/**
 * Pure layout helpers for the on-glass rain streaks (issue #44, ADR-0015).
 *
 * These describe the on-glass layer of the **Weather**: subtle vertical
 * droplet trails running down the Window pane so the user reads "looking
 * through a wet window," complementing the falling rain outside (#43).
 * Per ADR-0015 this is purely atmospheric set-dressing — a fixed mood, not
 * configurable and not persisted.
 *
 * As with `city-layout.ts`, all variety is deterministic: streaks come from
 * a seeded PRNG (mulberry32), never `Math.random`, so the glass looks the
 * same on every render and across reloads. The animation is driven by the
 * pure {@link scrollOffset} below, which wraps into [0, 1) so the streak
 * texture loops seamlessly forever.
 */

/**
 * A single rain streak: a thin vertical droplet trail on the glass pane,
 * expressed in normalized pane space so it is resolution-independent.
 */
export type RainStreak = {
  /** Horizontal column across the pane, normalized to [0, 1]. */
  x: number;
  /** Trail length as a fraction of the pane height, (0, 1]. */
  length: number;
  /** Trail width as a fraction of the pane width — kept thin. */
  width: number;
  /** Downward scroll speed (cycles per second), positive. */
  speed: number;
  /** Peak opacity of the trail — kept subtle so the City stays visible. */
  opacity: number;
};

/** Number of streaks on the pane — enough to read as rain, not a curtain. */
export const RAIN_STREAK_COUNT = 14;

/**
 * Deterministic [0, 1) pseudo-random generator (mulberry32). Seeded so the
 * streak layout is stable — no `Math.random` at module or render time.
 * Mirrors `city-layout.ts`.
 */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Map a [0, 1) sample to [min, max). */
function lerp(rand: number, min: number, max: number): number {
  return min + rand * (max - min);
}

/**
 * Generate the deterministic set of rain streaks for the glass pane.
 *
 * Bounds are tuned for subtlety: thin trails, low opacity, gentle speeds —
 * so the City skyline behind the glass stays clearly visible (issue #44).
 *
 * @param seed Integer seed for the PRNG; the same seed always yields the
 *   same layout.
 * @returns Exactly {@link RAIN_STREAK_COUNT} streaks.
 */
export function rainStreakLayout(seed: number): RainStreak[] {
  const rand = seededRandom(seed);
  const streaks: RainStreak[] = [];
  for (let i = 0; i < RAIN_STREAK_COUNT; i++) {
    streaks.push({
      x: rand(),
      length: lerp(rand(), 0.15, 0.55),
      width: lerp(rand(), 0.004, 0.016),
      speed: lerp(rand(), 0.03, 0.12),
      opacity: lerp(rand(), 0.06, 0.22),
    });
  }
  return streaks;
}

/**
 * Vertical scroll phase of the streak texture at a given time, wrapped into
 * [0, 1) so the downward scroll loops seamlessly.
 *
 * @param timeSeconds Elapsed time in seconds (e.g. the r3f clock).
 * @param speed Cycles per second; one full cycle every `1 / speed` seconds.
 * @returns The wrapped offset in [0, 1).
 */
export function scrollOffset(timeSeconds: number, speed: number): number {
  const phase = (timeSeconds * speed) % 1;
  // `%` can return a tiny negative for negative inputs; normalize to [0, 1).
  return phase < 0 ? phase + 1 : phase;
}
