import { describe, it, expect } from "vitest";
import { createCloth, step } from "./xpbd";

describe("xpbd solver — gravity integration (#19)", () => {
  it("a 4-corner-pinned cloth stays flat under gravity (shear constraints hold the rectangle taut)", () => {
    // 2-segment cloth: 3x3 grid, so there's an interior particle (idx 4)
    // that's not on any pinned edge. With only structural edges this
    // interior particle would sag under gravity; with shear (diagonals)
    // it should stay at z=0 and near its original (x, y).
    const W = 0.1;
    const H = 0.1;
    const cloth = createCloth({
      width: W,
      height: H,
      segments: 2,
      // Indices for 3x3 grid: corners at 0, 2, 6, 8.
      pins: [0, 2, 6, 8],
    });
    const startX = cloth.positions[4 * 3];
    const startY = cloth.positions[4 * 3 + 1];

    for (let i = 0; i < 200; i++) step(cloth, 1 / 60);

    const interiorX = cloth.positions[4 * 3];
    const interiorY = cloth.positions[4 * 3 + 1];
    const interiorZ = cloth.positions[4 * 3 + 2];

    // Interior must not sag noticeably — within 5% of the cloth's
    // diagonal would be "fishnet", under 1% is "paper".
    expect(Math.abs(interiorX - startX)).toBeLessThan(W * 0.01);
    expect(Math.abs(interiorY - startY)).toBeLessThan(H * 0.01);
    expect(Math.abs(interiorZ)).toBeLessThan(W * 0.01);
  });

  it("connected particles relax toward their rest length (distance constraint)", () => {
    // 1-segment cloth = 2x2 grid. Pin the top-left only and let the
    // bottom-left fall under gravity — the structural edge between
    // them should hold the bottom particle at the rest length below.
    const HEIGHT = 1.0;
    const cloth = createCloth({
      width: 1.0,
      height: HEIGHT,
      segments: 1,
      pins: [2], // top-left (j=1, i=0)
    });

    // Let the system settle for a generous window.
    for (let i = 0; i < 200; i++) step(cloth, 1 / 60);

    // Distance from the pinned particle 2 to the unpinned particle 0
    // below it must converge to the structural edge's rest length
    // (= HEIGHT). Within 1% is plenty for "paper-stiff".
    const dx = cloth.positions[6] - cloth.positions[0];
    const dy = cloth.positions[7] - cloth.positions[1];
    const dz = cloth.positions[8] - cloth.positions[2];
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    expect(d).toBeGreaterThan(HEIGHT * 0.99);
    expect(d).toBeLessThan(HEIGHT * 1.01);
  });

  it("solver sleeps after ~500 ms of no motion (all-corner-pinned cloth)", () => {
    const cloth = createCloth({
      width: 0.1,
      height: 0.1,
      segments: 1,
      pins: [0, 1, 2, 3], // all corners pinned — no motion possible
    });
    expect(cloth.sleeping).toBe(false);

    // Run for one full second (60 frames). The solver should detect the
    // lack of motion and flip `sleeping` to true well before this.
    for (let i = 0; i < 60; i++) step(cloth, 1 / 60);
    expect(cloth.sleeping).toBe(true);
  });

  it("step is a no-op while sleeping", () => {
    const cloth = createCloth({
      width: 0.1,
      height: 0.1,
      segments: 1,
      pins: [0, 1, 2, 3],
    });
    for (let i = 0; i < 60; i++) step(cloth, 1 / 60);
    expect(cloth.sleeping).toBe(true);

    // Manually nudge prevPositions to simulate a NEW velocity that
    // would normally produce motion next step. If sleeping is honoured,
    // the position must not change.
    cloth.prevPositions[0] = cloth.positions[0] - 0.5;
    const snap = cloth.positions[0];
    step(cloth, 1 / 60);
    expect(cloth.positions[0]).toBe(snap);
  });

  it("a pinned particle does not move under gravity", () => {
    const cloth = createCloth({
      width: 0.1,
      height: 0.1,
      segments: 1,
      pins: [0], // pin the first particle
    });
    const startX = cloth.positions[0];
    const startY = cloth.positions[1];
    const startZ = cloth.positions[2];

    // Many steps — pinned particle still must not have moved.
    for (let i = 0; i < 60; i++) step(cloth, 1 / 60);

    expect(cloth.positions[0]).toBe(startX);
    expect(cloth.positions[1]).toBe(startY);
    expect(cloth.positions[2]).toBe(startZ);
  });

  it("a free particle accelerates downward under gravity", () => {
    // Smallest cloth that's still a cloth: 1 segment per side (4 particles).
    const cloth = createCloth({
      width: 0.1,
      height: 0.1,
      segments: 1,
      pins: [],
    });

    // Snapshot a particle's starting y. All four particles start in the
    // z=0 plane laid out as a square in (x, y).
    const startY = cloth.positions[1]; // first particle, y component
    step(cloth, 1 / 60);

    // After one frame under gravity the particle must have moved down.
    expect(cloth.positions[1]).toBeLessThan(startY);
  });
});
