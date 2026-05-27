import { useEffect, useMemo, useRef } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import { useThree } from "@react-three/fiber";
import { Mesh, Raycaster, Vector2 } from "three";
import type { Room, Surface, Note, SurfaceKind } from "../lib/room";
import { paletteEntry } from "../lib/palette";
import { surfaceTransform } from "../lib/surface-geometry";
import { NoteMesh } from "./NoteMesh";
import { useAppStore } from "../store";

const isWall = (kind: SurfaceKind): boolean => kind.startsWith("wall_");

/**
 * Renders the six Surfaces that bound a Room (ADR-0008), plus every
 * Note Pinned to each Surface. Each Note is a child of its parent
 * Surface mesh so its transform inherits the Surface's world placement.
 *
 * - **Double-click empty wall** → creates a Note at the hit `(u, v)`
 * - **Drag a Note** (pointer-down + move) → window-level raycast against
 *   all six Surfaces re-Pins the Note to wherever the cursor is over a
 *   Surface (ADR-0010, issue #16)
 * - **Click a Note** (pointer-down + release without movement) → focus
 *   transition (issue #17), routed up through `onNoteClick` so the
 *   pre-focus Camera pose can be snapshotted from App.tsx.
 */
export function RoomScene({
  room,
  surfaces,
  notes,
  onNoteClick,
}: {
  room: Room;
  surfaces: readonly Surface[];
  notes: readonly Note[];
  onNoteClick: (noteId: string) => void;
}) {
  const createNoteAt = useAppStore((s) => s.createNoteAt);
  const drag = useAppStore((s) => s.drag);
  const setDragPin = useAppStore((s) => s.setDragPin);
  const endNoteDrag = useAppStore((s) => s.endNoteDrag);

  const surfaceMeshes = useRef<Map<string, Mesh>>(new Map());
  const { camera, gl } = useThree();
  const raycaster = useMemo(() => new Raycaster(), []);

  // While a Note is being dragged, the window-level pointer move
  // raycasts against every Surface and pushes the live (surface_id, u, v)
  // into the store. Pointer-up commits via endNoteDrag.
  useEffect(() => {
    if (!drag) return;
    const dom = gl.domElement;
    const onMove = (e: PointerEvent) => {
      const rect = dom.getBoundingClientRect();
      const ndc = new Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(ndc, camera);
      const meshes = [...surfaceMeshes.current.values()];
      const hits = raycaster.intersectObjects(meshes, false);
      const hit = hits[0];
      if (!hit || !hit.uv) return;
      const surface_id = (hit.object.userData as { surface_id?: string })
        .surface_id;
      if (!surface_id) return;
      setDragPin({ surface_id, u: hit.uv.x, v: hit.uv.y });
    };
    const onUp = () => {
      void endNoteDrag();
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [drag, camera, gl, raycaster, setDragPin, endNoteDrag]);

  // Bucket notes by their effective surface_id (drag overrides the
  // persisted value so the Note follows the cursor across walls).
  const notesBySurface = useMemo(() => {
    const m = new Map<string, Note[]>();
    for (const n of notes) {
      const effective =
        drag?.noteId === n.id
          ? { ...n, surface_id: drag.surface_id, u: drag.u, v: drag.v }
          : n;
      const arr = m.get(effective.surface_id);
      if (arr) arr.push(effective);
      else m.set(effective.surface_id, [effective]);
    }
    return m;
  }, [notes, drag]);

  return (
    <group>
      {surfaces.map((s) => {
        const t = surfaceTransform(
          s.kind,
          room.width_m,
          room.depth_m,
          room.height_m,
        );
        const color = paletteEntry(s.color_id).base;
        const surfaceNotes = notesBySurface.get(s.id) ?? [];
        const acceptsNotes = isWall(s.kind);

        const onDoubleClick = (e: ThreeEvent<MouseEvent>) => {
          if (!acceptsNotes) return;
          if (e.object.userData.kind !== "surface") return;
          if (!e.uv) return;
          if (e.object.userData.surface_id !== s.id) return;
          e.stopPropagation();
          void createNoteAt(s.id, e.uv.x, e.uv.y);
        };

        return (
          <mesh
            key={s.id}
            position={t.position}
            rotation={t.rotation}
            receiveShadow
            userData={{ kind: "surface", surface_id: s.id }}
            ref={(m) => {
              if (m) surfaceMeshes.current.set(s.id, m);
              else surfaceMeshes.current.delete(s.id);
            }}
            onDoubleClick={onDoubleClick}
          >
            <planeGeometry args={t.size} />
            <meshStandardMaterial color={color} roughness={0.9} metalness={0} />
            {surfaceNotes.map((n) => (
              <NoteMesh
                key={n.id}
                note={n}
                surfaceSize={t.size}
                onClick={onNoteClick}
              />
            ))}
          </mesh>
        );
      })}
    </group>
  );
}
