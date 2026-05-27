import { Euler, Object3D, Vector3 } from "three";
import type { Note, Room, Surface } from "./room";
import { surfaceTransform } from "./surface-geometry";
import { noteLocalTransform } from "./note-placement";

/** Vertical FOV in degrees of the Canvas's PerspectiveCamera. */
const CAMERA_FOV_DEG = 60;
/** Fraction of the viewport height the focused Note should fill. */
const FOCUS_FILL_FRACTION = 0.8;

type Vec3 = [number, number, number];

/**
 * Compute the orbit Camera pose to focus a Note (ADR-0009, issue #17).
 *
 * The Camera target is the Note's world centre; the Camera position
 * sits offset along the Surface's outward normal at a distance where
 * the Note fills `FOCUS_FILL_FRACTION` of the viewport vertically.
 * The orbit controller in App.tsx animates `(target, position)` from
 * the pre-focus pose to this pose, then back on exit.
 */
export function focusPose(
  note: Note,
  surface: Surface,
  room: Room,
): { target: Vec3; cameraPosition: Vec3 } {
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

  // Use an Object3D as a scratch parent so we can transform the Note's
  // local position into world coordinates using Three's matrix maths.
  const surfaceObj = new Object3D();
  surfaceObj.position.set(...sT.position);
  surfaceObj.rotation.set(...sT.rotation);
  surfaceObj.updateMatrixWorld();

  const noteWorld = new Vector3(...nT.position).applyMatrix4(
    surfaceObj.matrixWorld,
  );
  const surfaceNormal = new Vector3(0, 0, 1).applyEuler(
    new Euler(...sT.rotation),
  );

  // Focus distance: at distance D the viewport's vertical span is
  // 2 · D · tan(FOV/2). For the Note's height to fill `fillFraction` of
  // that span:  noteHeight = fillFraction · 2 · D · tan(FOV/2).
  const noteHeightM = note.height_cm / 100;
  const fovRad = (CAMERA_FOV_DEG * Math.PI) / 180;
  const focusDistance =
    noteHeightM / (FOCUS_FILL_FRACTION * 2 * Math.tan(fovRad / 2));

  const cameraPosition = noteWorld
    .clone()
    .add(surfaceNormal.multiplyScalar(focusDistance));

  return {
    target: [noteWorld.x, noteWorld.y, noteWorld.z],
    cameraPosition: [cameraPosition.x, cameraPosition.y, cameraPosition.z],
  };
}
