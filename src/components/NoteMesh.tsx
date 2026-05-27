import { memo, useRef } from "react";
import { Text } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import { paletteEntry } from "../lib/palette";
import { noteLocalTransform } from "../lib/note-placement";
import type { Note } from "../lib/room";
import { useAppStore } from "../store";

const TEXT_PAD_M = 0.01;
const TEXT_FONT_SIZE_M = 0.012;
const DRAG_THRESHOLD_PX = 5;
const GRAB_STANDOFF_M = 0.005; // 5 mm lift off the wall while held

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

  return (
    <group position={[t.position[0], t.position[1], z]}>
      <mesh
        castShadow
        receiveShadow
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <planeGeometry args={t.size_m} />
        <meshStandardMaterial color={color} roughness={0.85} metalness={0} />
      </mesh>
      <Text
        position={[
          -t.size_m[0] / 2 + TEXT_PAD_M,
          t.size_m[1] / 2 - TEXT_PAD_M,
          0.0005,
        ]}
        maxWidth={t.size_m[0] - TEXT_PAD_M * 2}
        anchorX="left"
        anchorY="top"
        fontSize={TEXT_FONT_SIZE_M}
        color="#2a2330"
        lineHeight={1.3}
      >
        {note.body || " "}
      </Text>
    </group>
  );
}

export const NoteMesh = memo(NoteMeshImpl);
