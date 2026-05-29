import { describe, it, expect } from "vitest";
import { Vector3 } from "three";
import { flyPose, smoothstep } from "./fly-path";

type Vec3 = [number, number, number];

const dist = (a: Vec3, b: Vec3) =>
  new Vector3(...a).distanceTo(new Vector3(...b));

describe("smoothstep — ease-in-out over [0,1]", () => {
  it("pins the endpoints and the midpoint, clamps out of range", () => {
    expect(smoothstep(0)).toBe(0);
    expect(smoothstep(1)).toBe(1);
    expect(smoothstep(0.5)).toBeCloseTo(0.5, 6);
    expect(smoothstep(-1)).toBe(0);
    expect(smoothstep(2)).toBe(1);
  });

  it("eases in (slope below linear) near the start", () => {
    expect(smoothstep(0.1)).toBeLessThan(0.1);
    expect(smoothstep(0.9)).toBeGreaterThan(0.9);
  });
});

describe("flyPose — eased orbit-arc camera interpolation (issue #67)", () => {
  const start = {
    camPos: [0, 1.6, 1.8] as Vec3,
    target: [0, 1.5, 0] as Vec3,
  };
  const focus = {
    // Note on wall_north (behind a south-facing user): camera ends up
    // near the back wall looking at it.
    focusCamPos: [0, 1.5, -2.8] as Vec3,
    focusTarget: [0, 1.5, -2.999] as Vec3,
  };

  it("t=0 returns the start pose", () => {
    const pose = flyPose({ ...start, ...focus, t: 0 });
    expect(dist(pose.camPos, start.camPos)).toBeCloseTo(0, 5);
    expect(dist(pose.target, start.target)).toBeCloseTo(0, 5);
  });

  it("t=1 returns the focus pose", () => {
    const pose = flyPose({ ...start, ...focus, t: 1 });
    expect(dist(pose.camPos, focus.focusCamPos)).toBeCloseTo(0, 4);
    expect(dist(pose.target, focus.focusTarget)).toBeCloseTo(0, 4);
  });

  it("Note behind the camera: never collapses through the target / room centre", () => {
    // Distance from the moving camera to the moving target must stay a
    // sane radius throughout — a straight position lerp would dip to ~0
    // as it passes the room centre between the user and the back wall.
    const startRadius = dist(start.camPos, start.target);
    const endRadius = dist(focus.focusCamPos, focus.focusTarget);
    const floor = Math.min(startRadius, endRadius) * 0.5;

    for (let i = 0; i <= 10; i++) {
      const pose = flyPose({ ...start, ...focus, t: i / 10 });
      const r = dist(pose.camPos, pose.target);
      expect(r).toBeGreaterThan(floor);
    }
  });

  it("camera→target radius is monotonic-ish (no wild overshoot) for the behind case", () => {
    const radii: number[] = [];
    for (let i = 0; i <= 10; i++) {
      const pose = flyPose({ ...start, ...focus, t: i / 10 });
      radii.push(dist(pose.camPos, pose.target));
    }
    const startRadius = radii[0];
    const endRadius = radii[radii.length - 1];
    const hi = Math.max(startRadius, endRadius);
    // The radius lerps between endpoints, so it must never exceed the
    // larger endpoint radius (slack for float error).
    for (const r of radii) expect(r).toBeLessThanOrEqual(hi + 1e-6);
  });

  it("degenerate start offset (camera on its target) falls back to the focus direction", () => {
    const pose = flyPose({
      camPos: [0, 1.5, 0],
      target: [0, 1.5, 0],
      ...focus,
      t: 1,
    });
    expect(dist(pose.camPos, focus.focusCamPos)).toBeCloseTo(0, 4);
  });
});
