import { memo, useMemo, useRef } from "react";
import { Text } from "@react-three/drei";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { paletteEntry } from "../lib/palette";
import { noteLocalTransform } from "../lib/note-placement";
import type { Note } from "../lib/room";
import { useAppStore } from "../store";
import { createClothGeometry, cornerPins } from "../lib/cloth-geometry";
import { step as stepCloth, wake as wakeCloth } from "../lib/xpbd";

export const TEXT_PAD_M = 0.01;
export const TEXT_FONT_SIZE_M = 0.012;
export const TEXT_LINE_HEIGHT = 1.3;
const DRAG_THRESHOLD_PX = 5;
const GRAB_STANDOFF_M = 0.005; // 5 mm lift off the wall while held
/** Cloth subdivisions per side (issue #19 / ADR-0012). */
const CLOTH_SEGMENTS = 20;
/** Re-compute vertex normals every N frames — costly to do every frame. */
const NORMALS_EVERY_N_FRAMES = 2;
// Lora — warm serif, claude.ai-style. Self-hosted from public/fonts/
// (WOFF, latin-ext subset from @fontsource/lora via unpkg, ~16 KB).
// Covers basic Latin + Latin Extended-A (incl. Đđ). Full Vietnamese
// precomposed glyphs (U+1Exx) aren't in this subset — if v2 needs
// them, swap in a multi-subset font file. The DOM textarea uses the
// matching Google Fonts CSS loaded in index.html.
const NOTE_FONT_URL = "/fonts/Lora-Regular.woff";

type Props = {
  note: Note;
  surfaceWidthM: number;
  surfaceHeightM: number;
  onClick: (noteId: string) => void;
};

/**
 * A single Note rendered Pinned at `(u, v)` inside its parent Surface
 * mesh (ADR-0010). Wrapped in `memo` so re-rendering one Note's body
 * (per keystroke during editing) doesn't re-mount all the other Notes.
 *
 * Surface size is passed as primitives (not an array) so memo's
 * shallow comparator sees them as stable across `RoomScene` renders.
 *
 * Pointer interactions:
 * - **pointer-down + release without movement** → click → `onClick(id)`
 * - **pointer-down + significant movement** → drag → `beginNoteDrag`
 */
function NoteMeshImpl({ note, surfaceWidthM, surfaceHeightM, onClick }: Props) {
  const t = noteLocalTransform({
    u: note.u,
    v: note.v,
    width_cm: note.width_cm,
    height_cm: note.height_cm,
    surface_size_m: [surfaceWidthM, surfaceHeightM],
  });
  const color = paletteEntry(note.color_id).base;
  const beginNoteDrag = useAppStore((s) => s.beginNoteDrag);
  const drag = useAppStore((s) => s.drag);
  const isDragging = drag?.noteId === note.id;
  // While this note is being edited, the DOM textarea (NoteEditor) is
  // the visible text — so we hide the WebGL <Text> to avoid a double
  // render and keep native text selection aligned with what the user
  // sees.
  const editingNoteId = useAppStore((s) => s.editingNoteId);
  const isEditing = editingNoteId === note.id;

  const pointerState = useRef<{
    pointerId: number | null;
    startX: number;
    startY: number;
    dragStarted: boolean;
  }>({ pointerId: null, startX: 0, startY: 0, dragStarted: false });

  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    (e.target as Element | null)?.setPointerCapture?.(e.pointerId);
    pointerState.current = {
      pointerId: e.pointerId,
      startX: e.nativeEvent.clientX,
      startY: e.nativeEvent.clientY,
      dragStarted: false,
    };
  };

  const onPointerMove = (e: ThreeEvent<PointerEvent>) => {
    const st = pointerState.current;
    if (st.pointerId === null || st.dragStarted) return;
    const dx = e.nativeEvent.clientX - st.startX;
    const dy = e.nativeEvent.clientY - st.startY;
    if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
    st.dragStarted = true;
    beginNoteDrag(note.id);
  };

  const onPointerUp = (e: ThreeEvent<PointerEvent>) => {
    const st = pointerState.current;
    (e.target as Element | null)?.releasePointerCapture?.(e.pointerId);
    pointerState.current = {
      pointerId: null,
      startX: 0,
      startY: 0,
      dragStarted: false,
    };
    if (st.pointerId === null) return;
    if (!st.dragStarted) {
      e.stopPropagation();
      onClick(note.id);
    }
  };

  const z = isDragging ? GRAB_STANDOFF_M : t.position[2];

  // XPBD cloth solver (issue #19). One solver state + one BufferGeometry
  // per Note, allocated once per (width_cm, height_cm). The geometry's
  // position attribute shares memory with the solver's positions
  // Float32Array, so `step()` mutates the GPU buffer directly.
  //
  // Bugs fixed at the lib level since the first integration attempt:
  // - cloth-geometry.ts winds triangles CCW from +z (front face toward
  //   the room interior). The first attempt had reversed winding so
  //   most of the mesh was back-face-culled and only fragments showed.
  // - xpbd.ts step() clamps incoming dt to 1/60 s so a stalled frame
  //   can't blow up the Verlet integration.
  const { cloth, geometry } = useMemo(
    () =>
      createClothGeometry({
        width: t.size_m[0],
        height: t.size_m[1],
        segments: CLOTH_SEGMENTS,
        // Default to all four corners pinned — paper sits "flat, taut"
        // (issue #19 first acceptance criterion). Future Attachment
        // styles (#33) override this with push-pin / washi-tape pins.
        pins: cornerPins(CLOTH_SEGMENTS),
      }),
    [t.size_m[0], t.size_m[1]],
  );

  // Wake the solver whenever the Note is grabbed — a lift-off generates
  // motion the solver must respond to even if it had gone to sleep.
  const wasDragging = useRef(false);
  if (isDragging && !wasDragging.current) wakeCloth(cloth);
  wasDragging.current = isDragging;

  const frameCounter = useRef(0);
  useFrame((_, dt) => {
    if (cloth.sleeping) return;
    stepCloth(cloth, dt);
    geometry.attributes.position.needsUpdate = true;
    frameCounter.current = (frameCounter.current + 1) % NORMALS_EVERY_N_FRAMES;
    if (frameCounter.current === 0) geometry.computeVertexNormals();
  });

  return (
    <group position={[t.position[0], t.position[1], z]}>
      <mesh
        castShadow
        receiveShadow
        geometry={geometry}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <meshStandardMaterial color={color} roughness={0.85} metalness={0} />
      </mesh>
      {!isEditing && (
        <Text
          position={[
            -t.size_m[0] / 2 + TEXT_PAD_M,
            t.size_m[1] / 2 - TEXT_PAD_M,
            0.0005,
          ]}
          maxWidth={t.size_m[0] - TEXT_PAD_M * 2}
          anchorX="left"
          anchorY="top"
          font={NOTE_FONT_URL}
          fontSize={TEXT_FONT_SIZE_M}
          color="#2a2330"
          lineHeight={TEXT_LINE_HEIGHT}
          // Force character-level wrap for tokens that don't fit on a
          // line — otherwise a long unbroken string (no spaces) blows
          // past the paper's right edge.
          overflowWrap="break-word"
          // Clip anything still spilling vertically below the paper's
          // inner bounds. Coords are in the Text's local frame: anchor
          // is top-left at (0, 0); text extends +X right, -Y down.
          clipRect={[
            0,
            -(t.size_m[1] - TEXT_PAD_M * 2),
            t.size_m[0] - TEXT_PAD_M * 2,
            0,
          ]}
        >
          {note.body || " "}
        </Text>
      )}
    </group>
  );
}

export const NoteMesh = memo(NoteMeshImpl);
