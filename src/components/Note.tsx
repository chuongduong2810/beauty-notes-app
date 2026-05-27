import { useMemo } from "react";
import { Text } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import type { NoteRow } from "../lib/canvas-repository";
import { paletteEntry } from "../lib/palette";
import { useAppStore } from "../store";

const DEPTH_Z: Record<NoteRow["depth"], number> = {
  back: -80,
  mid: 0,
  front: 80,
};

const PX_TO_UNITS = 1;
const TEXT_PAD = 16;
const SELECTED_OUTLINE_COLOR = "#ffd5e8";

export function Note({ note }: { note: NoteRow }) {
  const entry = useMemo(() => paletteEntry(note.color_id), [note.color_id]);
  const width = note.width * PX_TO_UNITS;
  const height = note.height * PX_TO_UNITS;
  const selected = useAppStore((s) => s.selection.has(note.id));
  const selectNote = useAppStore((s) => s.selectNote);

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    selectNote(note.id, e.shiftKey);
  };

  return (
    <group position={[note.x, note.y, DEPTH_Z[note.depth]]}>
      {selected && (
        <mesh position={[0, 0, -0.05]}>
          <planeGeometry args={[width + 8, height + 8]} />
          <meshBasicMaterial color={SELECTED_OUTLINE_COLOR} transparent opacity={0.6} />
        </mesh>
      )}
      <mesh onClick={onClick}>
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
