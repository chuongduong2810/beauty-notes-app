import { describe, it, expect } from "vitest";
import { PerspectiveCamera, Vector3 } from "three";
import { projectNoteRect } from "./project-note-rect";
import {
  DEFAULT_ROOM_WIDTH_M,
  DEFAULT_ROOM_DEPTH_M,
  DEFAULT_ROOM_HEIGHT_M,
  type Room,
  type Surface,
  type Note,
} from "./room";
import { focusPose } from "./focus-pose";

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

function makeFocusCamera(
  note: Note,
  surface: Surface,
  canvasW: number,
  canvasH: number,
): PerspectiveCamera {
  const cam = new PerspectiveCamera(60, canvasW / canvasH, 0.05, 50);
  const pose = focusPose(note, surface, ROOM);
  cam.position.set(...pose.cameraPosition);
  cam.lookAt(new Vector3(...pose.target));
  cam.updateMatrixWorld(true);
  return cam;
}

describe("projectNoteRect — Note world rect → DOM screen rect (issue #18)", () => {
  it("a focused Note projects to a rect centred in the canvas", () => {
    const W = 1000;
    const H = 800;
    const s = surface("wall_north");
    const n = note(s.id, 0.5, 0.5);
    const cam = makeFocusCamera(n, s, W, H);

    const r = projectNoteRect(n, s, ROOM, cam, { width: W, height: H });

    const centerX = r.left + r.width / 2;
    const centerY = r.top + r.height / 2;
    expect(centerX).toBeCloseTo(W / 2, 0);
    expect(centerY).toBeCloseTo(H / 2, 0);
    expect(r.width).toBeGreaterThan(0);
    expect(r.height).toBeGreaterThan(0);
  });

  it("the rect fills roughly 80% of viewport height when focused (per focusPose contract)", () => {
    const W = 1000;
    const H = 800;
    const s = surface("wall_north");
    const n = note(s.id, 0.5, 0.5, 24, 18);
    const cam = makeFocusCamera(n, s, W, H);

    const r = projectNoteRect(n, s, ROOM, cam, { width: W, height: H });

    // 80% of viewport height = 640 px. Allow some slack for projection.
    expect(r.height).toBeGreaterThan(H * 0.7);
    expect(r.height).toBeLessThan(H * 0.95);
  });

  it("a Note offset to the right of centre projects to the right of canvas centre", () => {
    const W = 1000;
    const H = 800;
    const s = surface("wall_north");
    const offset = note(s.id, 0.75, 0.5);
    const centred = note(s.id, 0.5, 0.5);
    // Use the centred-note's camera; offset note should be off-centre.
    const cam = makeFocusCamera(centred, s, W, H);

    const r = projectNoteRect(offset, s, ROOM, cam, { width: W, height: H });
    const centerX = r.left + r.width / 2;
    expect(centerX).toBeGreaterThan(W / 2);
  });
});
