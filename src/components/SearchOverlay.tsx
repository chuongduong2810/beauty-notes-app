import { useEffect, useMemo, useRef, useState } from "react";
import { searchNotes, surfaceLabel } from "../lib/note-search";
import { noteSnippet } from "../lib/notebook-sections";
import { paletteEntry } from "../lib/palette";
import type { Surface } from "../lib/room";
import { useAppStore } from "../store";

/**
 * Command-palette Search overlay (issue #66, ADR-0017). A DOM chrome
 * overlay — like RoomPicker / ToolPalette, NOT in-world — that finds a
 * Note in the current Room by its body text and flies the Camera to it.
 *
 * Opens on Cmd/Ctrl+K, closes on Esc / backdrop click / after select.
 * Selecting a result closes the overlay and calls `flyToNote`, which
 * reuses the existing Focus transition (snapshot orbit pose → focus →
 * arrival highlight) wired up once in App.tsx.
 *
 * @param flyToNote - select-and-fly callback shared with the Notebook.
 */
export function SearchOverlay({
  flyToNote,
}: {
  flyToNote: (id: string) => void;
}) {
  const notes = useAppStore((s) => s.notes);
  const surfaces = useAppStore((s) => s.surfaces);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Surface lookup by id for each result's spatial (wall) hint.
  const surfaceById = useMemo(() => {
    const map = new Map<string, Surface>();
    for (const s of surfaces) map.set(s.id, s);
    return map;
  }, [surfaces]);

  const results = useMemo(
    () => searchNotes(notes, query),
    [notes, query],
  );

  // Global Cmd/Ctrl+K toggles the overlay open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Reset query + selection and focus the input whenever we open.
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActiveIndex(0);
    // Focus after the panel paints.
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open]);

  // Keep the active row in range as results change.
  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  if (!open) return null;

  const close = () => setOpen(false);

  const select = (noteId: string) => {
    close();
    flyToNote(noteId);
  };

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const note = results[activeIndex];
      if (note) select(note.id);
    }
  };

  const trimmed = query.trim();

  return (
    <div
      className="search-overlay"
      onPointerDown={(e) => {
        // Backdrop click closes; clicks inside the panel don't bubble here.
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="search-panel" role="dialog" aria-label="Search notes">
        <div className="search-input-row">
          <span className="search-input-icon" aria-hidden>
            ⌕
          </span>
          <input
            ref={inputRef}
            className="search-input"
            type="text"
            placeholder="Search your notes…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKeyDown}
            aria-label="Search notes"
          />
        </div>

        {trimmed === "" ? (
          <div className="search-hint">Type to search your notes</div>
        ) : results.length === 0 ? (
          <div className="search-hint">No notes match “{trimmed}”</div>
        ) : (
          <ul className="search-results" role="listbox">
            {results.map((note, i) => {
              const surface = surfaceById.get(note.surface_id);
              const active = i === activeIndex;
              return (
                <li key={note.id} role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    className={
                      "search-result" +
                      (active ? " search-result--active" : "")
                    }
                    onMouseEnter={() => setActiveIndex(i)}
                    onClick={() => select(note.id)}
                  >
                    <span
                      className="search-result__swatch"
                      style={{
                        background: paletteEntry(note.color_id).base,
                      }}
                      aria-hidden
                    />
                    <span className="search-result__text">
                      <span className="search-result__title">
                        {noteSnippet(note.body)}
                      </span>
                      <span className="search-result__snippet">
                        {noteSnippet(note.body, 80)}
                      </span>
                    </span>
                    {surface && (
                      <span className="search-result__surface">
                        {surfaceLabel(surface.kind)}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
