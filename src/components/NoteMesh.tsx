import { Text } from "@react-three/drei";
import { paletteEntry } from "../lib/palette";
import { noteLocalTransform } from "../lib/note-placement";
import type { Note } from "../lib/room";

const TEXT_PAD_M = 0.01; // 1 cm padding inside the Note plane
const TEXT_FONT_SIZE_M = 0.012; // 1.2 cm cap height — reads at arm's length

/**
 * A single Note rendered as a thin plane Pinned at `(u, v)` inside its
 * parent Surface mesh (ADR-0010, issue #15). The transform is in the
 * Surface's local frame — this component must be a child of the
 * Surface mesh, never rendered standalone.
 */
export function NoteMesh({
  note,
  surfaceSize,
}: {
  note: Note;
  surfaceSize: [number, number];
}) {
  const t = noteLocalTransform({
    u: note.u,
    v: note.v,
    width_cm: note.width_cm,
    height_cm: note.height_cm,
    surface_size_m: surfaceSize,
  });
  const color = paletteEntry(note.color_id).base;

  return (
    <group position={t.position}>
      <mesh castShadow receiveShadow>
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
