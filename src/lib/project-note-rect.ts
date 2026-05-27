import { Object3D, Vector3, type Camera } from "three";
import type { Note, Room, Surface } from "./room";
import { surfaceTransform } from "./surface-geometry";
import { noteLocalTransform } from "./note-placement";

export type ScreenRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

const tmpV = new Vector3();

/**
 * Project a Note's world rectangle into a DOM screen rect for the
 * invisible-textarea overlay (ADR-0002, issue #18). Projects the four
 * world-space corners of the Note plane and returns the axis-aligned
 * bounding rect in CSS pixels.
 *
 * When the Camera is straight-on to the Surface (the focused state)
 * the corners project to a clean rectangle. Off-axis cameras produce
 * trapezoidal projections — we still return the bounding rect, but the
 * textarea is only meant to be visible while focused so the caret
 * tracks the SDF text closely.
 */
export function projectNoteRect(
  note: Note,
  surface: Surface,
  room: Room,
  camera: Camera,
  canvas: { width: number; height: number },
): ScreenRect {
  const sT = surfaceTransform(
    surface.kind,
    room.width_m,
    room.depth_m,
    room.height_m,
  );
  const nT = noteLocalTransform({
    u: note.u,
    v: note.v,
    width_cm: note.width_cm,
    height_cm: note.height_cm,
    surface_size_m: sT.size,
  });

  const surfaceObj = new Object3D();
  surfaceObj.position.set(...sT.position);
  surfaceObj.rotation.set(...sT.rotation);
  surfaceObj.updateMatrixWorld();

  const halfW = nT.size_m[0] / 2;
  const halfH = nT.size_m[1] / 2;
  const localCorners: ReadonlyArray<[number, number]> = [
    [-halfW, -halfH],
    [halfW, -halfH],
    [halfW, halfH],
    [-halfW, halfH],
  ];

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [lx, ly] of localCorners) {
    tmpV
      .set(nT.position[0] + lx, nT.position[1] + ly, nT.position[2])
      .applyMatrix4(surfaceObj.matrixWorld)
      .project(camera);
    const px = ((tmpV.x + 1) / 2) * canvas.width;
    const py = ((1 - tmpV.y) / 2) * canvas.height;
    if (px < minX) minX = px;
    if (px > maxX) maxX = px;
    if (py < minY) minY = py;
    if (py > maxY) maxY = py;
  }

  return {
    left: minX,
    top: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}
