import { memo, useEffect, useRef } from "react";
import { Text } from "@react-three/drei";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { animated, useSpring } from "@react-spring/three";
import { Group, Vector3 } from "three";
import { paletteEntry } from "../lib/palette";
import { noteLocalTransform } from "../lib/note-placement";
import { createPaperTexture } from "../lib/note-paper-texture";
import type { Note } from "../lib/room";
import { useAppStore } from "../store";

/**
 * World position (metres) where the crumple animation lands — slightly
 * above the trash bin's rim so the Note appears to fall into the bin.
 * Must stay in sync with `TRASH_POSITION` in RoomScene.
 */
const TRASH_WORLD_POS = new Vector3(-1.2, 0.55, -2.2);
const tmpTrashLocal = new Vector3();

/**
 * Shared ruled-paper texture (client brief: "Giống giấy thật"). Built
 * once at module load and reused by every Note. Mostly white so the
 * material's `color` multiplies the palette hue through; the rules
 * and grain end up palette-coherent automatically.
 */
const PAPER_TEXTURE = createPaperTexture();

export const TEXT_PAD_M = 0.01;
export const TEXT_FONT_SIZE_M = 0.012;
export const TEXT_LINE_HEIGHT = 1.3;
const DRAG_THRESHOLD_PX = 5;
const GRAB_STANDOFF_M = 0.005; // 5 mm lift off the wall while held
/**
 * Drag-only physics (#19 / client brief: "Khi drag: note hơi cong, có
 * inertia, rung nhẹ khi release"). Tilt magnitude per (uv/sec) of pin
 * velocity, in radians. Kept small so the lean reads as paper-bend, not
 * a flying card.
 */
const TILT_GAIN = 0.15;
const MAX_TILT_RAD = 0.25;
// Lora — warm serif, claude.ai-style. Self-hosted from public/fonts/
// (WOFF, latin-ext subset from @fontsource/lora via unpkg, ~16 KB).
// Covers basic Latin + Latin Extended-A (incl. Đđ). Full Vietnamese
// precomposed glyphs (U+1Exx) aren't in this subset — if v2 needs
// them, swap in a multi-subset font file. The DOM textarea uses the
// matching Google Fonts CSS loaded in index.html.
const NOTE_FONT_URL = "/fonts/Lora-Regular.woff";

const clamp = (x: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, x));

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
 * At rest the Note is a flat plane with no physics activity. The drag
 * physics from #19 / the v3 client brief are gated on `isDragging`:
 * while held, a spring drives a small lift, an in-motion tilt (the
 * "bend"), and an inertial lag (the rendered position chases the logical
 * pin rather than snapping). On release the spring returns to the rest
 * pose with low friction, producing the brief "rung nhẹ" oscillation.
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
  const palette = paletteEntry(note.color_id);
  const color = palette.base;
  const edgeColor = palette.shadow;
  const groupRef = useRef<Group | null>(null);
  const beginNoteDrag = useAppStore((s) => s.beginNoteDrag);
  const drag = useAppStore((s) => s.drag);
  const isDragging = drag?.noteId === note.id;
  // While this note is being edited, the DOM textarea (NoteEditor) is
  // the visible text — so we hide the WebGL <Text> to avoid a double
  // render and keep native text selection aligned with what the user
  // sees.
  const editingNoteId = useAppStore((s) => s.editingNoteId);
  const isEditing = editingNoteId === note.id;
  const crumplingNoteId = useAppStore((s) => s.crumplingNoteId);
  const isCrumpling = crumplingNoteId === note.id;
  /**
   * In Pen / Eraser modes Notes are pointer-pass-through (issue #35) —
   * a pen-down lands on the Surface behind, not on the Note. We do this
   * by skipping the raycast on the Note's interactive meshes when the
   * tool isn't `"note"`.
   */
  const currentTool = useAppStore((s) => s.penState.currentTool);
  const noteIsInteractive = currentTool === "note";

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

  const [spring, springApi] = useSpring(() => ({
    px: t.position[0],
    py: t.position[1],
    pz: t.position[2],
    rx: 0,
    ry: 0,
    rz: 0,
    // Non-uniform scale lets the crumple squash the Note along Y faster
    // than X, which reads as "paper being balled up" rather than "shrunk".
    sx: 1,
    sy: 1,
    sz: 1,
    config: { mass: 0.6, tension: 220, friction: 16 },
  }));

  // Smoothed UV velocity from the drag pin. Resets every time a drag
  // starts so the first frame doesn't see a huge phantom velocity from
  // wherever the previous drag left off.
  const dragVel = useRef({
    u: 0,
    v: 0,
    lastU: 0,
    lastV: 0,
    primed: false,
  });

  useFrame((_, dt) => {
    if (!isDragging || !drag) return;
    if (!dragVel.current.primed) {
      dragVel.current.lastU = drag.u;
      dragVel.current.lastV = drag.v;
      dragVel.current.primed = true;
    } else {
      const dts = Math.max(dt, 0.001);
      const ALPHA = 0.3;
      const du = (drag.u - dragVel.current.lastU) / dts;
      const dv = (drag.v - dragVel.current.lastV) / dts;
      dragVel.current.u = dragVel.current.u * (1 - ALPHA) + du * ALPHA;
      dragVel.current.v = dragVel.current.v * (1 - ALPHA) + dv * ALPHA;
      dragVel.current.lastU = drag.u;
      dragVel.current.lastV = drag.v;
    }

    const targetRx = clamp(
      -dragVel.current.v * TILT_GAIN,
      -MAX_TILT_RAD,
      MAX_TILT_RAD,
    );
    const targetRy = clamp(
      dragVel.current.u * TILT_GAIN,
      -MAX_TILT_RAD,
      MAX_TILT_RAD,
    );

    springApi.start({
      px: t.position[0],
      py: t.position[1],
      pz: t.position[2] + GRAB_STANDOFF_M,
      rx: targetRx,
      ry: targetRy,
      // Smooth follow during drag — critically damped feel.
      config: { mass: 0.6, tension: 220, friction: 16 },
    });
  });

  // On release transition, settle back to the resting pose with low
  // friction so the spring overshoots once or twice before settling —
  // the brief's "rung nhẹ khi release".
  useEffect(() => {
    if (!isDragging) {
      dragVel.current = {
        u: 0,
        v: 0,
        lastU: 0,
        lastV: 0,
        primed: false,
      };
      springApi.start({
        px: t.position[0],
        py: t.position[1],
        pz: t.position[2],
        rx: 0,
        ry: 0,
        config: { mass: 0.5, tension: 260, friction: 5 },
      });
    }
  }, [
    isDragging,
    t.position[0],
    t.position[1],
    t.position[2],
    springApi,
  ]);

  // Crumple animation when this Note has been dropped on the trash.
  // Non-uniform squash (sy << sx) sells the "balled-up paper" read on
  // a flat plane — uniform scale just looks like the Note is shrinking.
  // Two full Z spins + heavy tumble on X/Y so the rotation is clearly
  // visible during the 900 ms window before the Note is removed from
  // state and this component unmounts. Spring config is intentionally
  // soft (low tension, high mass) so the motion lasts the full window
  // instead of snapping in 170 ms.
  useEffect(() => {
    if (!isCrumpling) return;
    // Translate the trash bin's WORLD position into the surface's local
    // frame — the same frame the Note's `px/py/pz` live in — so the
    // spring can drive the Note across the room to the bin before the
    // squash + spin completes.
    const parent = groupRef.current?.parent;
    tmpTrashLocal.copy(TRASH_WORLD_POS);
    if (parent) parent.worldToLocal(tmpTrashLocal);
    springApi.start({
      px: tmpTrashLocal.x,
      py: tmpTrashLocal.y,
      pz: tmpTrashLocal.z,
      sx: 0.25,
      sy: 0.05,
      sz: 0.4,
      rz: Math.PI * 4,
      rx: Math.PI * 0.7,
      ry: Math.PI * 0.4,
      config: { mass: 0.8, tension: 65, friction: 12 },
    });
  }, [isCrumpling, springApi]);

  return (
    <animated.group
      ref={groupRef}
      position-x={spring.px}
      position-y={spring.py}
      position-z={spring.pz}
      rotation-x={spring.rx}
      rotation-y={spring.ry}
      rotation-z={spring.rz}
      scale-x={spring.sx}
      scale-y={spring.sy}
      scale-z={spring.sz}
    >
      {/* Darker backing plane (edge ring) — sits 0.2 mm behind the
          paper face and 3 mm wider on each axis, so a thin ring in the
          palette's `shadow` colour peeks out around the front face and
          silhouettes the Note against warm-white walls. Cheap: one
          extra plane per Note, no shadow caster. */}
      <mesh
        position-z={-0.0002}
        receiveShadow
        raycast={noteIsInteractive ? undefined : () => null}
      >
        <planeGeometry
          args={[t.size_m[0] + 0.003, t.size_m[1] + 0.003]}
        />
        <meshStandardMaterial
          color={edgeColor}
          roughness={0.95}
          metalness={0}
        />
      </mesh>
      <mesh
        castShadow
        receiveShadow
        onPointerDown={noteIsInteractive ? onPointerDown : undefined}
        onPointerMove={noteIsInteractive ? onPointerMove : undefined}
        onPointerUp={noteIsInteractive ? onPointerUp : undefined}
        onPointerCancel={noteIsInteractive ? onPointerUp : undefined}
        raycast={noteIsInteractive ? undefined : () => null}
      >
        <planeGeometry args={t.size_m} />
        <meshStandardMaterial
          color={color}
          map={PAPER_TEXTURE ?? undefined}
          roughness={0.85}
          metalness={0}
        />
      </mesh>
      {/* Red push-pin at the top centre — the visual signature of a
          Note Pinned to a wall. Slight metalness + low roughness so
          the directional key light makes the head catch a highlight. */}
      <mesh
        position={[0, t.size_m[1] / 2 - 0.006, 0.005]}
        castShadow
        raycast={noteIsInteractive ? undefined : () => null}
      >
        <sphereGeometry args={[0.0045, 16, 12]} />
        <meshStandardMaterial
          color="#d62828"
          roughness={0.25}
          metalness={0.35}
        />
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
    </animated.group>
  );
}

export const NoteMesh = memo(NoteMeshImpl);
