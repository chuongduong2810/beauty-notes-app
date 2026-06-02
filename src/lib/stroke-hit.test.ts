import { describe, it, expect } from "vitest";
import { ERASER_RADIUS_UV, strokeHitByEraser } from "./stroke-hit";

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
