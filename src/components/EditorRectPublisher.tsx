import { useFrame, useThree } from "@react-three/fiber";
import { useAppStore } from "../store";
import { projectNoteRect } from "../lib/project-note-rect";

/**
 * Lives inside the R3F `<Canvas>` so it can read the live camera + size
 * via `useThree`. While a Note is being edited (issue #18) this
 * component projects the Note's world rect every frame and writes the
 * resulting DOM screen rect into the store — the DOM `<NoteEditor>`
 * picks it up and positions the textarea on top of the SDF text.
 *
 * Per-frame is the right cadence: the Camera is animating during the
 * focus dolly (ADR-0009), so a static publish-on-mount would leave the
 * textarea visibly trailing the WebGL text during the transition.
 */
export function EditorRectPublisher() {
  const editingNoteId = useAppStore((s) => s.editingNoteId);
  const setEditingRect = useAppStore((s) => s.setEditingRect);
  const { camera, size } = useThree();

  useFrame(() => {
    if (!editingNoteId) return;
    const s = useAppStore.getState();
    if (!s.currentRoom) return;
    const note = s.notes.find((n) => n.id === editingNoteId);
    if (!note) return;
    const surface = s.surfaces.find((sf) => sf.id === note.surface_id);
    if (!surface) return;
    const rect = projectNoteRect(note, surface, s.currentRoom, camera, {
      width: size.width,
      height: size.height,
    });
    setEditingRect(rect);
  });

  return null;
}
