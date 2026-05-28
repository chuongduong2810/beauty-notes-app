import type { CSSProperties } from "react";
import type { Tool } from "../lib/pen-tool";
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
  left: 16,
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

export function ToolPalette() {
  const currentTool = useAppStore((s) => s.penState.currentTool);
  const setCurrentTool = useAppStore((s) => s.setCurrentTool);

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
    </div>
  );
}
