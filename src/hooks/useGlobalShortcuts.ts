import { useEffect } from "react";
import { useAppStore } from "../store";

/**
 * Global keyboard shortcuts that aren't tied to a focused DOM element:
 * - Delete / Backspace: delete current selection
 * - Ctrl/⌘ + Z: undo last delete (session-only, see DeleteUndoStack)
 *
 * Shortcuts are suppressed when the user is typing inside an input or
 * the (future) note-editing textarea — see ADR-0002.
 */
export function useGlobalShortcuts() {
  const deleteSelection = useAppStore((s) => s.deleteSelection);
  const undo = useAppStore((s) => s.undoLastDelete);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const editing =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target?.isContentEditable ?? false);
      if (editing) return;

      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        void deleteSelection();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        void undo();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [deleteSelection, undo]);
}
