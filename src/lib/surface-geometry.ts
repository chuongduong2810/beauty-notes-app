import type { SurfaceKind } from "./room";

export type Vec3 = [number, number, number];

export type SurfaceTransform = {
  /** World position of the plane's centre, in metres. */
  position: Vec3;
  /** Euler rotation (XYZ order) so the plane's normal points into the Room. */
  rotation: Vec3;
  /** Plane dimensions in metres: [width along local X, height along local Y]. */
  size: [number, number];
};

/**
 * Compute the world transform of a Surface inside a Room, in metres.
 *
 * Coordinate system: Three.js right-handed, Y up. Origin is the room
 * centre on the floor (y = 0). Camera defaults to (0, 1.6, 0) facing -Z,
 * so `wall_north` lives at -Z and its normal points back toward the
 * camera (+Z).
 *
 * The default `planeGeometry` lies in the XY plane with its normal
 * pointing toward +Z; the rotations below orient each Surface so its
 * normal points into the Room interior.
 */
export function surfaceTransform(
  kind: SurfaceKind,
  width_m: number,
  depth_m: number,
  height_m: number,
): SurfaceTransform {
  switch (kind) {
    case "wall_north":
      return {
        position: [0, height_m / 2, -depth_m / 2],
        rotation: [0, 0, 0],
        size: [width_m, height_m],
      };
    case "wall_south":
      return {
        position: [0, height_m / 2, depth_m / 2],
        rotation: [0, Math.PI, 0],
        size: [width_m, height_m],
      };
    case "wall_east":
      return {
        position: [width_m / 2, height_m / 2, 0],
        rotation: [0, -Math.PI / 2, 0],
        size: [depth_m, height_m],
      };
    case "wall_west":
      return {
        position: [-width_m / 2, height_m / 2, 0],
        rotation: [0, Math.PI / 2, 0],
        size: [depth_m, height_m],
      };
    case "floor":
      return {
        position: [0, 0, 0],
        rotation: [-Math.PI / 2, 0, 0],
        size: [width_m, depth_m],
      };
    case "ceiling":
      return {
        position: [0, height_m, 0],
        rotation: [Math.PI / 2, 0, 0],
        size: [width_m, depth_m],
      };
  }
}
