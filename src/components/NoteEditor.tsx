import { useEffect, useRef, type CSSProperties } from "react";
import { useAppStore } from "../store";
import {
  TEXT_FONT_SIZE_M,
  TEXT_LINE_HEIGHT,
  TEXT_PAD_M,
} from "./NoteMesh";

/**
 * DOM textarea overlay for editing a Note's body (ADR-0002, issue #18).
 * Reads `editingNoteId` and `editingRect` from the store and, when both
 * are set, renders a textarea positioned over the focused Note's
 * projected screen rect.
 *
 * During editing the WebGL <Text> for the focused note is hidden (see
 * NoteMesh) and the textarea IS the visible text — same Lora font, same
 * size and padding (scaled from the projected rect), same dark colour.
 * This keeps native browser selection (Ctrl+A, click-drag) aligned with
 * the glyphs the user sees, and keeps IME composition, clipboard paste,
 * and the iPadOS soft keyboard working because the textarea is still a
 * real DOM input. Every keystroke mirrors into the store so the WebGL
 * <Text> is up to date the moment editing ends.
 */
export function NoteEditor() {
  const editingNoteId = useAppStore((s) => s.editingNoteId);
  const editingRect = useAppStore((s) => s.editingRect);
  const editingNote = useAppStore((s) =>
    editingNoteId ? s.notes.find((n) => n.id === editingNoteId) : undefined,
  );
  const body = editingNote?.body ?? "";
  const setEditingBody = useAppStore((s) => s.setEditingBody);
  const unfocusNote = useAppStore((s) => s.unfocusNote);
  const toggleBookmark = useAppStore((s) => s.toggleBookmark);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Focus the textarea whenever a new edit session starts. autoFocus
  // covers the initial mount; this effect also covers session changes
  // (e.g. clicking from one focused Note to another) without unmount.
  useEffect(() => {
    if (editingNoteId && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [editingNoteId]);

  if (!editingNoteId || !editingRect || !editingNote) return null;

  // Match the projected WebGL <Text> exactly: the note is `height_cm`
  // tall in world space, projected to `editingRect.height` px on screen
  // — so 1 world metre maps to `editingRect.height / (height_cm / 100)`
  // pixels. Apply the same ratio to TEXT_FONT_SIZE_M and TEXT_PAD_M so
  // the DOM textarea text lines up with the WebGL render the user sees
  // when the note isn't being edited.
  const pxPerMetre = editingRect.height / (editingNote.height_cm / 100);
  const fontSizePx = TEXT_FONT_SIZE_M * pxPerMetre;
  const padPx = TEXT_PAD_M * pxPerMetre;

  const style: CSSProperties = {
    position: "fixed",
    left: editingRect.left,
    top: editingRect.top,
    width: editingRect.width,
    height: editingRect.height,
    padding: padPx,
    fontSize: fontSizePx,
    lineHeight: TEXT_LINE_HEIGHT,
    // Match the WebGL <Text> font (Lora, loaded in index.html) so the
    // textarea's line-wrap mirrors what troika renders.
    fontFamily: '"Lora", Georgia, serif',
    border: "none",
    outline: "none",
    resize: "none",
    background: "transparent",
    // The textarea IS the visible text during editing (the WebGL <Text>
    // is hidden for this note in NoteMesh). This keeps native browser
    // selection — Ctrl+A, click-drag — aligned with the glyphs the user
    // sees, instead of painting blue rectangles offset from a different
    // WebGL render.
    color: "#2a2330",
    caretColor: "#2a2330",
    boxSizing: "border-box",
    zIndex: 20,
    // Long notes get a vertical scrollbar in focus mode; styled via
    // index.html's textarea[data-note-editor] CSS so the thumb is
    // palette-coherent and unobtrusive.
    overflowX: "hidden",
    overflowY: "auto",
    margin: 0,
    // Match troika's overflowWrap="break-word" so the textarea breaks
    // long unbroken tokens at the same character positions the WebGL
    // text does (so caret position stays aligned with glyph position).
    overflowWrap: "anywhere",
    wordBreak: "break-word",
  };

  // Bookmark ribbon, sized relative to the projected note so it scales
  // with camera distance. Anchored just inside the top-right corner.
  const bookmarkSizePx = Math.max(14, Math.min(28, editingRect.height * 0.16));
  const bookmarkInsetPx = bookmarkSizePx * 0.35;
  const bookmarkStyle: CSSProperties = {
    left: editingRect.left + editingRect.width - bookmarkSizePx - bookmarkInsetPx,
    top: editingRect.top + bookmarkInsetPx,
    width: bookmarkSizePx,
    height: bookmarkSizePx,
  };

  return (
    <>
      <button
        type="button"
        data-note-bookmark
        aria-pressed={editingNote.bookmarked}
        aria-label={editingNote.bookmarked ? "Remove bookmark" : "Bookmark this note"}
        title={editingNote.bookmarked ? "Bookmarked — keep handy" : "Bookmark — keep handy"}
        style={bookmarkStyle}
        // Don't blur the textarea (which would save + unfocus) when the
        // ribbon is pressed — keep the edit session alive.
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => void toggleBookmark(editingNote.id)}
      >
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 24 24"
          fill={editingNote.bookmarked ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z" />
        </svg>
      </button>
      <textarea
        ref={textareaRef}
        data-note-editor
        style={style}
      value={body}
      autoFocus
      // Disable browser spellcheck/autocorrect/autocapitalise — for
      // non-English (Vietnamese, etc.) every word reads as misspelled
      // and the red underlines just visually pollute the note.
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
    </>
  );
}
