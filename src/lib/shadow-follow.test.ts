import { describe, it, expect } from "vitest";
import { shadowFollowPose, KEY_LIGHT_OFFSET_M } from "./shadow-follow";

describe("shadowFollowPose", () => {
  it("places the key light at orbitTarget + KEY_LIGHT_OFFSET_M, aimed at orbitTarget", () => {
    const target: [number, number, number] = [0, 1.5, 0];
    const pose = shadowFollowPose(target);
    expect(pose.lookAt).toEqual(target);
    expect(pose.position).toEqual([
      target[0] + KEY_LIGHT_OFFSET_M[0],
      target[1] + KEY_LIGHT_OFFSET_M[1],
      target[2] + KEY_LIGHT_OFFSET_M[2],
    ]);
  });

  it("preserves the light direction as the orbit target moves", () => {
    // The vector from light position to lookAt must be the same regardless
    // of where the orbit target is — that's what "preserved direction"
    // means and it's the whole point of the offset model.
    const a = shadowFollowPose([0, 0, 0]);
    const b = shadowFollowPose([3, 1, -2]);
    const dirA = [
      a.lookAt[0] - a.position[0],
      a.lookAt[1] - a.position[1],
      a.lookAt[2] - a.position[2],
    ];
    const dirB = [
      b.lookAt[0] - b.position[0],
      b.lookAt[1] - b.position[1],
      b.lookAt[2] - b.position[2],
    ];
    expect(dirA[0]).toBeCloseTo(dirB[0]);
    expect(dirA[1]).toBeCloseTo(dirB[1]);
    expect(dirA[2]).toBeCloseTo(dirB[2]);
  });
});
