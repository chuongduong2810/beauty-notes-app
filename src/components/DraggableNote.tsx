import { useRef } from "react";
import { animated, useSpring } from "@react-spring/three";
import { useThree, type ThreeEvent } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import type { NoteRow } from "../lib/canvas-repository";
import { paletteEntry } from "../lib/palette";
import { useAppStore } from "../store";

const DEPTH_Z: Record<NoteRow["depth"], number> = {
  back: -80,
  mid: 0,
  front: 80,
};

const DRAG_THRESHOLD_PX = 4;
const PX_TO_UNITS = 1;
const TEXT_PAD = 16;
const SELECTED_OUTLINE_COLOR = "#ffd5e8";

const SPRING_CONFIG = { tension: 220, friction: 26 };

/**
 * Issue #3: a Note that animates its position with `@react-spring/three`
 * (ADR-0007) and persists drag-end positions via the store.
 *
 * Click behavior from issue #2 (select / shift-toggle) is preserved by
 * only kicking off `beginDrag` once the pointer has moved past
 * `DRAG_THRESHOLD_PX` — a pointerdown→pointerup with no movement falls
 * through to R3F's synthetic `onClick`.
 */
export function DraggableNote({ note }: { note: NoteRow }) {
  const entry = paletteEntry(note.color_id);
  const width = note.width * PX_TO_UNITS;
  const height = note.height * PX_TO_UNITS;

  const selectNote = useAppStore((s) => s.selectNote);
  const selected = useAppStore((s) => s.selection.has(note.id));
  const beginDrag = useAppStore((s) => s.beginDrag);
  const updateDrag = useAppStore((s) => s.updateDrag);
  const endDrag = useAppStore((s) => s.endDrag);
  const drag = useAppStore((s) => s.drag);

  const isMoving =
    drag !== null &&
    (drag.selection.has(note.id) ||
      (!drag.selection.has(drag.leadId) && drag.leadId === note.id));
  const isLead = drag !== null && drag.leadId === note.id;

  const targetX = note.x + (isMoving ? drag.dx : 0);
  const targetY = note.y + (isMoving ? drag.dy : 0);
  const targetZ = DEPTH_Z[note.depth] + (isLead ? 4 : 0);
  const targetScale = isLead ? 1.02 : 1;

  const spring = useSpring({
    position: [targetX, targetY, targetZ] as [number, number, number],
    scale: targetScale,
    config: SPRING_CONFIG,
  });

  const { size, viewport } = useThree();
  const pointerState = useRef<{
    pointerId: number | null;
    startClientX: number;
    startClientY: number;
    dragStarted: boolean;
  }>({ pointerId: null, startClientX: 0, startClientY: 0, dragStarted: false });

  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    (e.target as Element | null)?.setPointerCapture?.(e.pointerId);
    pointerState.current = {
      pointerId: e.pointerId,
      startClientX: e.nativeEvent.clientX,
      startClientY: e.nativeEvent.clientY,
      dragStarted: false,
    };
  };

  const onPointerMove = (e: ThreeEvent<PointerEvent>) => {
    const st = pointerState.current;
    if (st.pointerId === null) return;
    const dxPx = e.nativeEvent.clientX - st.startClientX;
    const dyPx = e.nativeEvent.clientY - st.startClientY;
    if (!st.dragStarted) {
      if (Math.hypot(dxPx, dyPx) < DRAG_THRESHOLD_PX) return;
      st.dragStarted = true;
      beginDrag(note.id);
    }
    const dxWorld = dxPx * (viewport.width / size.width);
    const dyWorld = -dyPx * (viewport.height / size.height);
    updateDrag(dxWorld, dyWorld);
  };

  const onPointerUp = (e: ThreeEvent<PointerEvent>) => {
    const st = pointerState.current;
    (e.target as Element | null)?.releasePointerCapture?.(e.pointerId);
    if (st.dragStarted) {
      void endDrag();
    }
    pointerState.current = { pointerId: null, startClientX: 0, startClientY: 0, dragStarted: false };
  };

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    // R3F only fires onClick when no significant movement occurred — so this
    // never collides with a real drag.
    if (pointerState.current.dragStarted) return;
    e.stopPropagation();
    selectNote(note.id, e.shiftKey);
  };

  return (
    <animated.group position={spring.position} scale={spring.scale}>
      {selected && (
        <mesh position={[0, 0, -0.05]}>
          <planeGeometry args={[width + 8, height + 8]} />
          <meshBasicMaterial color={SELECTED_OUTLINE_COLOR} transparent opacity={0.6} />
        </mesh>
      )}
      <mesh
        onClick={onClick}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial
          color={entry.base}
          transparent
          opacity={0.95}
          roughness={0.4}
          metalness={0}
        />
      </mesh>
      <Text
        position={[-(width / 2) + TEXT_PAD, height / 2 - TEXT_PAD, 0.1]}
        maxWidth={width - TEXT_PAD * 2}
        anchorX="left"
        anchorY="top"
        fontSize={18}
        color="#2a2330"
        lineHeight={1.3}
      >
        {note.body || " "}
      </Text>
    </animated.group>
  );
}
