import type { Room, Surface } from "../lib/room";
import { paletteEntry } from "../lib/palette";
import { surfaceTransform } from "../lib/surface-geometry";

/**
 * Renders the six Surfaces that bound a Room (ADR-0008). Each Surface is
 * a `planeGeometry` whose transform is computed by `surfaceTransform` so
 * its normal points into the Room interior.
 *
 * No Notes here — Note rendering lands in #15.
 */
export function RoomScene({
  room,
  surfaces,
}: {
  room: Room;
  surfaces: readonly Surface[];
}) {
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
        return (
          <mesh
            key={s.id}
            position={t.position}
            rotation={t.rotation}
            receiveShadow
          >
            <planeGeometry args={t.size} />
            <meshStandardMaterial color={color} roughness={0.9} metalness={0} />
          </mesh>
        );
      })}
    </group>
  );
}
