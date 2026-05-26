import { useMemo } from "react";
import { Text } from "@react-three/drei";
import type { NoteRow } from "../lib/canvas-repository";
import { paletteEntry } from "../lib/palette";

const DEPTH_Z: Record<NoteRow["depth"], number> = {
  back: -80,
  mid: 0,
  front: 80,
};

// World units per screen pixel at 1× zoom (rough — see PRD §5.3).
const PX_TO_UNITS = 1;
const TEXT_PAD = 16;

export function Note({ note }: { note: NoteRow }) {
  const entry = useMemo(() => paletteEntry(note.color_id), [note.color_id]);
  const width = note.width * PX_TO_UNITS;
  const height = note.height * PX_TO_UNITS;

  return (
    <group position={[note.x, note.y, DEPTH_Z[note.depth]]}>
      <mesh>
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
        position={[-(width / 2) + TEXT_PAD, (height / 2) - TEXT_PAD, 0.1]}
        maxWidth={width - TEXT_PAD * 2}
        anchorX="left"
        anchorY="top"
        fontSize={18}
        color="#2a2330"
        lineHeight={1.3}
      >
        {note.body}
      </Text>
    </group>
  );
}
