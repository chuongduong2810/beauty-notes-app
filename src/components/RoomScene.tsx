import { useMemo, useState } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import type { Room, Surface, Note, SurfaceKind } from "../lib/room";
import {
  DEFAULT_NOTE_WIDTH_CM,
  DEFAULT_NOTE_HEIGHT_CM,
} from "../lib/room";
import { paletteEntry } from "../lib/palette";
import { surfaceTransform } from "../lib/surface-geometry";
import { noteLocalTransform } from "../lib/note-placement";
import { NoteMesh } from "./NoteMesh";
import { useAppStore } from "../store";

const GHOST_COLOR = "#ffd5e8";
const GHOST_OPACITY = 0.45;

const isWall = (kind: SurfaceKind): boolean => kind.startsWith("wall_");

type Hover = { surfaceId: string; u: number; v: number };

/**
 * Renders the six Surfaces that bound a Room (ADR-0008), plus every
 * Note Pinned to each Surface. Each Note is a child of its parent
 * Surface mesh so its transform inherits the Surface's world placement.
 *
 * Double-clicking an empty area of a Surface creates a new Note at the
 * hit `(u, v)` (ADR-0010). While hovering, a translucent ghost shows
 * exactly where the next double-click will Pin a Note — so the user
 * never wonders which Surface their ray is actually hitting.
 */
export function RoomScene({
  room,
  surfaces,
  notes,
}: {
  room: Room;
  surfaces: readonly Surface[];
  notes: readonly Note[];
}) {
  const createNoteAt = useAppStore((s) => s.createNoteAt);
  const [hover, setHover] = useState<Hover | null>(null);

  const notesBySurface = useMemo(() => {
    const m = new Map<string, Note[]>();
    for (const n of notes) {
      const arr = m.get(n.surface_id);
      if (arr) arr.push(n);
      else m.set(n.surface_id, [n]);
    }
    return m;
  }, [notes]);

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

        // Note creation is restricted to walls in v1 of #15. Floor and
        // ceiling are skipped because the click ray hits them before the
        // wall when targeting low on a wall — landing notes flat on the
        // floor that the user never intended. Drag-to-pin (#16) will let
        // users move a note onto floor/ceiling deliberately.
        const acceptsNotes = isWall(s.kind);

        const onPointerMove = (e: ThreeEvent<PointerEvent>) => {
          if (!acceptsNotes) return;
          if (e.object.userData.kind !== "surface") return;
          if (!e.uv) return;
          if (e.object.userData.surface_id !== s.id) return;
          setHover({ surfaceId: s.id, u: e.uv.x, v: e.uv.y });
        };

        const onPointerOut = (e: ThreeEvent<PointerEvent>) => {
          if (e.object.userData.kind !== "surface") return;
          if (e.object.userData.surface_id !== s.id) return;
          setHover((curr) => (curr?.surfaceId === s.id ? null : curr));
        };

        const onDoubleClick = (e: ThreeEvent<MouseEvent>) => {
          if (!acceptsNotes) return;
          if (e.object.userData.kind !== "surface") return;
          if (!e.uv) return;
          if (e.object.userData.surface_id !== s.id) return;
          e.stopPropagation();
          void createNoteAt(s.id, e.uv.x, e.uv.y);
        };

        const showGhost = hover?.surfaceId === s.id;
        const ghostT = showGhost
          ? noteLocalTransform({
              u: hover.u,
              v: hover.v,
              width_cm: DEFAULT_NOTE_WIDTH_CM,
              height_cm: DEFAULT_NOTE_HEIGHT_CM,
              surface_size_m: t.size,
            })
          : null;

        return (
          <mesh
            key={s.id}
            position={t.position}
            rotation={t.rotation}
            receiveShadow
            userData={{ kind: "surface", surface_id: s.id }}
            onPointerMove={onPointerMove}
            onPointerOut={onPointerOut}
            onDoubleClick={onDoubleClick}
          >
            <planeGeometry args={t.size} />
            <meshStandardMaterial color={color} roughness={0.9} metalness={0} />
            {surfaceNotes.map((n) => (
              <NoteMesh key={n.id} note={n} surfaceSize={t.size} />
            ))}
            {ghostT && (
              <mesh position={ghostT.position}>
                <planeGeometry args={ghostT.size_m} />
                <meshBasicMaterial
                  color={GHOST_COLOR}
                  transparent
                  opacity={GHOST_OPACITY}
                  depthWrite={false}
                />
              </mesh>
            )}
          </mesh>
        );
      })}
    </group>
  );
}
