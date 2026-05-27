import { useEffect, useRef, type CSSProperties } from "react";
import { useAppStore } from "../store";

const FONT_SIZE_PX = 18;
const LINE_HEIGHT = 1.3;
const TEXT_PAD_PX = 16;

/**
 * Invisible DOM textarea overlay for editing a Note's body (ADR-0002,
 * issue #18). Reads `editingNoteId` and `editingRect` from the store
 * and, when both are set, renders a single transparent textarea
 * positioned over the focused Note's projected screen rect.
 *
 * The textarea is the real focusable element — keeping it as a DOM
 * input keeps IME composition, spellcheck, clipboard paste, and the
 * iPadOS soft keyboard working. The SDF text underneath mirrors every
 * keystroke through the store (within one frame).
 */
export function NoteEditor() {
  const editingNoteId = useAppStore((s) => s.editingNoteId);
  const editingRect = useAppStore((s) => s.editingRect);
  const body = useAppStore((s) =>
    editingNoteId
      ? (s.notes.find((n) => n.id === editingNoteId)?.body ?? "")
      : "",
  );
  const setEditingBody = useAppStore((s) => s.setEditingBody);
  const unfocusNote = useAppStore((s) => s.unfocusNote);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Focus the textarea whenever a new edit session starts. autoFocus
  // covers the initial mount; this effect also covers session changes
  // (e.g. clicking from one focused Note to another) without unmount.
  useEffect(() => {
    if (editingNoteId && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [editingNoteId]);

  if (!editingNoteId || !editingRect) return null;

  const style: CSSProperties = {
    position: "fixed",
    left: editingRect.left,
    top: editingRect.top,
    width: editingRect.width,
    height: editingRect.height,
    padding: TEXT_PAD_PX,
    fontSize: FONT_SIZE_PX,
    lineHeight: LINE_HEIGHT,
    fontFamily: "system-ui, sans-serif",
    border: "none",
    outline: "none",
    resize: "none",
    background: "transparent",
    color: "transparent",
    caretColor: "transparent",
    boxSizing: "border-box",
    zIndex: 20,
    overflow: "hidden",
    margin: 0,
  };

  return (
    <textarea
      ref={textareaRef}
      style={style}
      value={body}
      autoFocus
      // The textarea is invisible (transparent text/caret/background)
      // so any browser-native spellcheck / autocorrect / autocapitalise
      // UI would just leak as floating red dashes or capitalised letters
      // with no underlying text to attach to — especially for
      // non-English (Vietnamese, etc.) where every word reads as
      // misspelled. All disabled.
      spellCheck={false}
      autoCorrect="off"
      autoComplete="off"
      autoCapitalize="off"
      // NOTE: do NOT attach onKeyDown handlers that preventDefault on
      // character keys — that breaks IME composition (ADR-0002).
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.currentTarget.blur();
        }
      }}
      onInput={(e) => setEditingBody((e.target as HTMLTextAreaElement).value)}
      onBlur={() => {
        void unfocusNote();
      }}
    />
  );
}
