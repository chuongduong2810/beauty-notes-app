import type { CSSProperties } from "react";
import type { Tool } from "../lib/pen-tool";
import { ERASER_SIZES } from "../lib/stroke-hit";
import { useAppStore } from "../store";

/**
 * Floating tool palette in the chrome's top-left (issue #35, ADR-0014).
 * Three mutually-exclusive pills: Note / Pen / Eraser. The active pill
 * is highlighted; clicking another pill calls `setCurrentTool`, which
 * resets the in-progress Stroke if any.
 */
const TOOLS: Array<{ id: Tool; label: string; glyph: string }> = [
  { id: "note", label: "Note", glyph: "▲" },
  { id: "pen", label: "Pen", glyph: "✎" },
  { id: "eraser", label: "Eraser", glyph: "⌫" },
];

const containerStyle: CSSProperties = {
  position: "fixed",
  top: 16,
  left: "50%",
  transform: "translateX(-50%)",
  display: "flex",
  gap: 6,
  padding: 6,
  borderRadius: 999,
  background: "rgba(20, 16, 28, 0.72)",
  backdropFilter: "blur(8px)",
  boxShadow: "0 4px 18px rgba(0,0,0,0.35)",
  zIndex: 10,
  userSelect: "none",
};

const pillBase: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "6px 12px",
  borderRadius: 999,
  border: "none",
  fontSize: 13,
  fontWeight: 500,
  cursor: "pointer",
  background: "transparent",
  color: "rgba(255,255,255,0.7)",
  transition: "background 120ms ease, color 120ms ease",
};

const pillActive: CSSProperties = {
  background: "rgba(255,255,255,0.92)",
  color: "#1a1626",
};

const hidePillStyle: CSSProperties = {
  ...pillBase,
  padding: "6px 9px",
  color: "rgba(255,255,255,0.55)",
};

/** Wrapper for the eraser-size buttons, set off from the tool pills by a
 *  faint divider so it reads as a related sub-control. */
const sizeGroupStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  paddingLeft: 6,
  marginLeft: 2,
  borderLeft: "1px solid rgba(255,255,255,0.14)",
};

/** A compact size pill (S / M / L) — narrower than a tool pill. */
const sizePillStyle: CSSProperties = {
  ...pillBase,
  padding: "6px 10px",
  minWidth: 28,
  justifyContent: "center",
};

const restoreChipStyle: CSSProperties = {
  position: "fixed",
  top: 16,
  left: "50%",
  transform: "translateX(-50%)",
  width: 32,
  height: 32,
  borderRadius: 999,
  border: "none",
  background: "rgba(20, 16, 28, 0.72)",
  backdropFilter: "blur(8px)",
  boxShadow: "0 4px 18px rgba(0,0,0,0.35)",
  color: "rgba(255,255,255,0.85)",
  fontSize: 16,
  cursor: "pointer",
  zIndex: 10,
  userSelect: "none",
};

export function ToolPalette() {
  const currentTool = useAppStore((s) => s.penState.currentTool);
  const setCurrentTool = useAppStore((s) => s.setCurrentTool);
  const visible = useAppStore((s) => s.toolbarVisible);
  const setToolbarVisible = useAppStore((s) => s.setToolbarVisible);
  // Eraser size (issue #132): shown only while the Eraser is active.
  const eraserRadius = useAppStore((s) => s.eraserRadius);
  const setEraserRadius = useAppStore((s) => s.setEraserRadius);

  if (!visible) {
    return (
      <button
        type="button"
        aria-label="Show toolbar"
        title="Show toolbar"
        style={restoreChipStyle}
        onClick={() => setToolbarVisible(true)}
      >
        ☰
      </button>
    );
  }

  return (
    <div style={containerStyle} data-testid="tool-palette">
      {TOOLS.map((t) => {
        const active = t.id === currentTool;
        return (
          <button
            key={t.id}
            type="button"
            aria-pressed={active}
            style={{ ...pillBase, ...(active ? pillActive : null) }}
            onClick={() => setCurrentTool(t.id)}
          >
            <span aria-hidden style={{ fontSize: 14 }}>{t.glyph}</span>
            {t.label}
          </button>
        );
      })}
      {/* Eraser size selector (issue #132) — only while the Eraser is the
          active tool. Resizing changes both what a pass clears and the size
          of the on-wall eraser ring cursor. */}
      {currentTool === "eraser" && (
        <span style={sizeGroupStyle}>
          {ERASER_SIZES.map((size) => {
            const active = Math.abs(eraserRadius - size.radius) < 1e-6;
            return (
              <button
                key={size.id}
                type="button"
                aria-pressed={active}
                aria-label={`Eraser size ${size.label}`}
                title={`Eraser size ${size.label}`}
                style={{ ...sizePillStyle, ...(active ? pillActive : null) }}
                onClick={() => setEraserRadius(size.radius)}
              >
                {size.label}
              </button>
            );
          })}
        </span>
      )}
      <button
        type="button"
        aria-label="Hide toolbar"
        title="Hide toolbar"
        style={hidePillStyle}
        onClick={() => setToolbarVisible(false)}
      >
        ×
      </button>
    </div>
  );
}
