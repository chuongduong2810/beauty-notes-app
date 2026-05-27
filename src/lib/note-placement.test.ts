import { describe, it, expect } from "vitest";
import { noteLocalTransform } from "./note-placement";

describe("noteLocalTransform — (u, v) → Note position in Surface-local frame", () => {
  // Surface size [W, H] in metres. planeGeometry centres at the local
  // origin, so (u=0, v=0) is bottom-left = (-W/2, -H/2); (1, 1) is
  // top-right = (W/2, H/2). The Note sits 1 mm in front of the Surface
  // (local +Z) to avoid z-fighting.

  it("u=0.5, v=0.5 centres the Note on the Surface", () => {
    const t = noteLocalTransform({
      u: 0.5,
      v: 0.5,
      width_cm: 12,
      height_cm: 9,
      surface_size_m: [6, 3],
    });
    expect(t.position).toEqual([0, 0, 0.001]);
  });

  it("u=0, v=0 places the Note at bottom-left of the Surface", () => {
    const t = noteLocalTransform({
      u: 0,
      v: 0,
      width_cm: 12,
      height_cm: 9,
      surface_size_m: [6, 3],
    });
    expect(t.position[0]).toBeCloseTo(-3, 5);
    expect(t.position[1]).toBeCloseTo(-1.5, 5);
    expect(t.position[2]).toBeCloseTo(0.001, 5);
  });

  it("u=1, v=1 places the Note at top-right of the Surface", () => {
    const t = noteLocalTransform({
      u: 1,
      v: 1,
      width_cm: 12,
      height_cm: 9,
      surface_size_m: [6, 3],
    });
    expect(t.position[0]).toBeCloseTo(3, 5);
    expect(t.position[1]).toBeCloseTo(1.5, 5);
  });

  it("converts width_cm / height_cm to metres", () => {
    const t = noteLocalTransform({
      u: 0.5,
      v: 0.5,
      width_cm: 12,
      height_cm: 9,
      surface_size_m: [6, 3],
    });
    expect(t.size_m).toEqual([0.12, 0.09]);
  });
});
