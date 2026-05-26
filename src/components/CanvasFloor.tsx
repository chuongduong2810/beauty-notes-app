import type { ThreeEvent } from "@react-three/fiber";
import { useAppStore } from "../store";

/**
 * A full-Canvas invisible plane sitting behind everything. Catches clicks
 * on empty Canvas (deselect) and double-clicks (create a new Note at the
 * world position).
 *
 * R3F provides `event.point` in world coordinates already, so no manual
 * unprojection is needed.
 */
const FLOOR_SIZE = 50000;

export function CanvasFloor() {
  const createNoteAt = useAppStore((s) => s.createNoteAt);
  const clearSelection = useAppStore((s) => s.clearSelection);

  const onDoubleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    void createNoteAt(e.point.x, e.point.y);
  };

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.shiftKey) return;
    clearSelection();
  };

  return (
    <mesh
      position={[0, 0, -1000]}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      <planeGeometry args={[FLOOR_SIZE, FLOOR_SIZE]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  );
}
