import { describe, it, expect } from "vitest";
import {
  ERASER_RADIUS_UV,
  splitStrokeByEraser,
  strokeHitByEraser,
} from "./stroke-hit";

describe("strokeHitByEraser (issue #132)", () => {
  // A long horizontal Stroke from (0.1, 0.5) to (0.9, 0.5) — the eraser
  // should hit it along the SEGMENT, not just at the two vertices.
  const horizontal = [
    { u: 0.1, v: 0.5 },
    { u: 0.9, v: 0.5 },
  ];

  it("hits when the eraser lies on a segment between two far-apart vertices", () => {
    // Midpoint of the segment — nowhere near either vertex.
    expect(strokeHitByEraser(horizontal, { u: 0.5, v: 0.5 }, ERASER_RADIUS_UV)).toBe(
      true,
    );
    // Just above the segment, within the radius.
    expect(
      strokeHitByEraser(horizontal, { u: 0.5, v: 0.5 + ERASER_RADIUS_UV / 2 }, ERASER_RADIUS_UV),
    ).toBe(true);
  });

  it("misses when the eraser is far from every segment", () => {
    expect(strokeHitByEraser(horizontal, { u: 0.5, v: 0.9 }, ERASER_RADIUS_UV)).toBe(
      false,
    );
    expect(strokeHitByEraser(horizontal, { u: 0.1, v: 0.1 }, ERASER_RADIUS_UV)).toBe(
      false,
    );
  });

  it("hits when the eraser is adjacent to a vertex", () => {
    expect(
      strokeHitByEraser(horizontal, { u: 0.1 + ERASER_RADIUS_UV / 2, v: 0.5 }, ERASER_RADIUS_UV),
    ).toBe(true);
  });

  it("treats a single-point Stroke as a point distance", () => {
    const dot = [{ u: 0.5, v: 0.5 }];
    expect(strokeHitByEraser(dot, { u: 0.5, v: 0.5 }, ERASER_RADIUS_UV)).toBe(true);
    expect(strokeHitByEraser(dot, { u: 0.9, v: 0.9 }, ERASER_RADIUS_UV)).toBe(false);
  });

  it("never hits and never throws on an empty Stroke", () => {
    expect(() =>
      strokeHitByEraser([], { u: 0.5, v: 0.5 }, ERASER_RADIUS_UV),
    ).not.toThrow();
    expect(strokeHitByEraser([], { u: 0.5, v: 0.5 }, ERASER_RADIUS_UV)).toBe(false);
  });

  it("handles a Stroke whose consecutive points coincide (degenerate segment)", () => {
    const stutter = [
      { u: 0.5, v: 0.5 },
      { u: 0.5, v: 0.5 },
    ];
    expect(strokeHitByEraser(stutter, { u: 0.5, v: 0.5 }, ERASER_RADIUS_UV)).toBe(
      true,
    );
    expect(strokeHitByEraser(stutter, { u: 0.9, v: 0.9 }, ERASER_RADIUS_UV)).toBe(
      false,
    );
  });
});

describe("splitStrokeByEraser — partial erase (real-eraser model)", () => {
  // A dense horizontal Stroke at v=0.5, points 0.2 apart so the eraser
  // (radius 0.03) only ever catches the single point under it.
  const dense = [
    { u: 0.1, v: 0.5, p: 0.5, t: 0 },
    { u: 0.3, v: 0.5, p: 0.5, t: 1 },
    { u: 0.5, v: 0.5, p: 0.5, t: 2 },
    { u: 0.7, v: 0.5, p: 0.5, t: 3 },
    { u: 0.9, v: 0.5, p: 0.5, t: 4 },
  ];

  it("splits a Stroke into two fragments when erased in the middle", () => {
    const runs = splitStrokeByEraser(dense, { u: 0.5, v: 0.5 }, ERASER_RADIUS_UV);
    expect(runs).toHaveLength(2);
    expect(runs[0].map((p) => p.u)).toEqual([0.1, 0.3]);
    expect(runs[1].map((p) => p.u)).toEqual([0.7, 0.9]);
  });

  it("shortens to one run when an end is erased", () => {
    const runs = splitStrokeByEraser(dense, { u: 0.1, v: 0.5 }, ERASER_RADIUS_UV);
    expect(runs).toHaveLength(1);
    expect(runs[0].map((p) => p.u)).toEqual([0.3, 0.5, 0.7, 0.9]);
  });

  it("returns the original single run unchanged on a miss", () => {
    const runs = splitStrokeByEraser(dense, { u: 0.5, v: 0.95 }, ERASER_RADIUS_UV);
    expect(runs).toHaveLength(1);
    expect(runs[0]).toHaveLength(dense.length);
  });

  it("returns [] when every point is erased", () => {
    // A radius large enough to swallow the whole Stroke.
    const runs = splitStrokeByEraser(dense, { u: 0.5, v: 0.5 }, 2);
    expect(runs).toEqual([]);
  });

  it("drops a leftover single point (a fragment needs ≥ 2 points)", () => {
    const two = [
      { u: 0.4, v: 0.5, p: 0.5, t: 0 },
      { u: 0.6, v: 0.5, p: 0.5, t: 1 },
    ];
    // Erase the first point → one point survives → not renderable → [].
    expect(splitStrokeByEraser(two, { u: 0.4, v: 0.5 }, ERASER_RADIUS_UV)).toEqual(
      [],
    );
  });

  it("carries per-point pressure / time into the surviving fragments", () => {
    const runs = splitStrokeByEraser(dense, { u: 0.5, v: 0.5 }, ERASER_RADIUS_UV);
    expect(runs[1][0]).toEqual({ u: 0.7, v: 0.5, p: 0.5, t: 3 });
  });
});
