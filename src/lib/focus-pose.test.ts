import { describe, it, expect } from "vitest";
import { focusPose } from "./focus-pose";
import {
  DEFAULT_ROOM_WIDTH_M,
  DEFAULT_ROOM_DEPTH_M,
  DEFAULT_ROOM_HEIGHT_M,
  type Room,
  type Surface,
  type Note,
} from "./room";

const ROOM: Room = {
  id: "room-1",
  owner_id: "u1",
  name: "Room",
  width_m: DEFAULT_ROOM_WIDTH_M,
  depth_m: DEFAULT_ROOM_DEPTH_M,
  height_m: DEFAULT_ROOM_HEIGHT_M,
  camera_yaw: 0,
  camera_pitch: Math.PI / 2,
  camera_distance: 1.8,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const surface = (kind: Surface["kind"]): Surface => ({
  id: `surface-${kind}`,
  room_id: ROOM.id,
  owner_id: "u1",
  kind,
  color_id: "warm-white",
});

const note = (
  surface_id: string,
  u: number,
  v: number,
  width_cm = 24,
  height_cm = 18,
): Note => ({
  id: "n1",
  surface_id,
  owner_id: "u1",
  u,
  v,
  width_cm,
  height_cm,
  body: "",
  color_id: "paper",
  bookmarked: false,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
});

describe("focusPose — Camera target + position for a focused Note (issue #17)", () => {
  it("centred Note on wall_north → target at the Note centre, camera offset along +Z (into room)", () => {
    const sN = surface("wall_north");
    const n = note(sN.id, 0.5, 0.5);

    const pose = focusPose(n, sN, ROOM);

    // Note centre at world (0, 1.5, -2.999) (wall_north at z=-3, 1mm standoff toward camera).
    expect(pose.target[0]).toBeCloseTo(0, 4);
    expect(pose.target[1]).toBeCloseTo(1.5, 4);
    expect(pose.target[2]).toBeCloseTo(-2.999, 4);

    // Camera offset along surface normal +Z, ~0.2 m away (80% fill of vert FOV 60°).
    expect(pose.cameraPosition[0]).toBeCloseTo(0, 4);
    expect(pose.cameraPosition[1]).toBeCloseTo(1.5, 4);
    expect(pose.cameraPosition[2]).toBeGreaterThan(pose.target[2]);
    expect(pose.cameraPosition[2] - pose.target[2]).toBeCloseTo(0.195, 1);
  });

  it("Note on wall_east → camera offset along -X (into room from the +X wall)", () => {
    const sE = surface("wall_east");
    const n = note(sE.id, 0.5, 0.5);

    const pose = focusPose(n, sE, ROOM);

    // Wall_east at x=+3, mid-height; target near x=+3.
    expect(pose.target[0]).toBeCloseTo(2.999, 4);
    expect(pose.target[1]).toBeCloseTo(1.5, 4);

    // Camera dollies toward room centre along -X.
    expect(pose.cameraPosition[0]).toBeLessThan(pose.target[0]);
    expect(pose.target[0] - pose.cameraPosition[0]).toBeCloseTo(0.195, 1);
  });

  it("uses a smaller focus distance for a smaller Note (closer dolly so the smaller Note still fills 80%)", () => {
    const sN = surface("wall_north");
    const large = note(sN.id, 0.5, 0.5, 24, 18);
    const small = note(sN.id, 0.5, 0.5, 12, 9);

    const largePose = focusPose(large, sN, ROOM);
    const smallPose = focusPose(small, sN, ROOM);

    const largeDist = largePose.cameraPosition[2] - largePose.target[2];
    const smallDist = smallPose.cameraPosition[2] - smallPose.target[2];
    expect(smallDist).toBeLessThan(largeDist);
    expect(smallDist).toBeCloseTo(largeDist / 2, 2); // half the height → half the distance
  });
});
