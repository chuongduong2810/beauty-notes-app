import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useAppStore } from "../store";

/**
 * Top-left Room picker dropdown (issue #22). Closed: shows the
 * current Room's name + chevron. Open: lists all of the User's
 * Rooms (most-recently-updated first — relies on the store's
 * `rooms` already being sorted that way) and a "+ New Room" entry
 * that calls `createRoom`.
 *
 * Styling follows the same glass-and-cyan vocabulary as the
 * ToolPalette so the two chrome elements read as a set.
 */
const containerStyle: CSSProperties = {
  position: "fixed",
  top: 16,
  left: 16,
  zIndex: 10,
  userSelect: "none",
};

const triggerStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "8px 14px",
  borderRadius: 999,
  border: "1px solid rgba(255, 255, 255, 0.08)",
  background: "rgba(20, 16, 28, 0.72)",
  backdropFilter: "blur(8px)",
  WebkitBackdropFilter: "blur(8px)",
  boxShadow: "0 4px 18px rgba(0,0,0,0.35)",
  color: "rgba(255,255,255,0.92)",
  fontSize: 13,
  fontWeight: 500,
  cursor: "pointer",
  fontFamily:
    'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
};

const chevronStyle: CSSProperties = {
  fontSize: 10,
  opacity: 0.7,
};

const menuStyle: CSSProperties = {
  marginTop: 6,
  minWidth: 220,
  padding: 6,
  borderRadius: 12,
  border: "1px solid rgba(255, 255, 255, 0.08)",
  background: "rgba(20, 16, 28, 0.92)",
  backdropFilter: "blur(10px)",
  WebkitBackdropFilter: "blur(10px)",
  boxShadow: "0 10px 32px rgba(0,0,0,0.45)",
  display: "flex",
  flexDirection: "column",
  gap: 2,
};

const itemStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "8px 12px",
  borderRadius: 8,
  border: "none",
  background: "transparent",
  color: "rgba(255,255,255,0.85)",
  fontSize: 13,
  cursor: "pointer",
  textAlign: "left",
  fontFamily: "inherit",
};

const itemActiveStyle: CSSProperties = {
  background: "rgba(255, 255, 255, 0.08)",
  color: "#fff",
};

const newRoomStyle: CSSProperties = {
  ...itemStyle,
  color: "#5cf2e8",
  borderTop: "1px solid rgba(255, 255, 255, 0.06)",
  marginTop: 2,
  paddingTop: 10,
};

export function RoomPicker() {
  const currentRoom = useAppStore((s) => s.currentRoom);
  const rooms = useAppStore((s) => s.rooms);
  const switchRoom = useAppStore((s) => s.switchRoom);
  const createRoom = useAppStore((s) => s.createRoom);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Click outside closes the dropdown.
  useEffect(() => {
    if (!open) return;
    const onDocPointer = (e: PointerEvent) => {
      const node = containerRef.current;
      if (node && !node.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onDocPointer);
    return () => document.removeEventListener("pointerdown", onDocPointer);
  }, [open]);

  if (!currentRoom) return null;

  return (
    <div style={containerStyle} ref={containerRef} data-testid="room-picker">
      <button
        type="button"
        style={triggerStyle}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span>{currentRoom.name}</span>
        <span style={chevronStyle} aria-hidden>
          ▾
        </span>
      </button>
      {open && (
        <div role="menu" style={menuStyle}>
          {rooms.map((r) => {
            const active = r.id === currentRoom.id;
            return (
              <button
                key={r.id}
                role="menuitem"
                type="button"
                style={{ ...itemStyle, ...(active ? itemActiveStyle : null) }}
                onClick={() => {
                  setOpen(false);
                  if (!active) void switchRoom(r.id);
                }}
              >
                <span>{r.name}</span>
                {active && (
                  <span aria-hidden style={{ fontSize: 11, opacity: 0.7 }}>
                    ●
                  </span>
                )}
              </button>
            );
          })}
          <button
            role="menuitem"
            type="button"
            style={newRoomStyle}
            onClick={() => {
              setOpen(false);
              void createRoom();
            }}
          >
            + New Room
          </button>
        </div>
      )}
    </div>
  );
}
