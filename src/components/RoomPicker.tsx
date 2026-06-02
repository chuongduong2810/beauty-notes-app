import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useAppStore } from "../store";
import { readOnlyRoomIds, canCreateRoom } from "../lib/room-access";

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
  // fontFamily inherited from body — see --ui-font in index.html.
};

const chevronStyle: CSSProperties = {
  fontSize: 10,
  opacity: 0.7,
};

const renameButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 4,
  marginLeft: 2,
  borderRadius: 8,
  border: "none",
  background: "transparent",
  color: "rgba(255,255,255,0.6)",
  fontSize: 12,
  lineHeight: 1,
  cursor: "pointer",
};

const renameInputStyle: CSSProperties = {
  border: "1px solid rgba(92, 242, 232, 0.5)",
  borderRadius: 8,
  background: "rgba(0, 0, 0, 0.25)",
  color: "#fff",
  fontSize: 13,
  fontWeight: 500,
  fontFamily: "inherit",
  padding: "2px 6px",
  width: 140,
  outline: "none",
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
  const renameRoom = useAppStore((s) => s.renameRoom);
  const entitlements = useAppStore((s) => s.entitlements);
  const [open, setOpen] = useState(false);
  // While renaming the current Room, holds the in-flight draft; null = idle.
  const [renameDraft, setRenameDraft] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Focus + select the rename input when editing begins.
  useEffect(() => {
    if (renameDraft !== null) inputRef.current?.select();
  }, [renameDraft]);

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

  // Multi-room gating (ADR-0021, issue #109): Rooms beyond the Plan cap are
  // read-only (kept, never deleted); at the cap, "New Room" becomes a Studio
  // nudge rather than creating.
  const readOnly = readOnlyRoomIds(rooms, entitlements.maxRooms);
  const atCap = !canCreateRoom(rooms.length, entitlements.maxRooms);

  const commitRename = () => {
    if (renameDraft === null) return;
    // Trim + ignore-empty is enforced by the store too; the draft is closed
    // either way so a blank entry simply restores the old name.
    void renameRoom(currentRoom.id, renameDraft);
    setRenameDraft(null);
  };

  return (
    <div style={containerStyle} ref={containerRef} data-testid="room-picker">
      <div style={{ ...triggerStyle, cursor: "default" }}>
        {renameDraft !== null ? (
          <input
            ref={inputRef}
            style={renameInputStyle}
            value={renameDraft}
            aria-label="Room name"
            onChange={(e) => setRenameDraft(e.target.value)}
            onPointerDown={(e) => e.stopPropagation()}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitRename();
              } else if (e.key === "Escape") {
                e.preventDefault();
                setRenameDraft(null); // cancel ⇒ restore old name.
              }
            }}
          />
        ) : (
          <>
            <button
              type="button"
              style={{
                ...triggerStyle,
                padding: 0,
                border: "none",
                background: "transparent",
                boxShadow: "none",
                cursor: "pointer",
              }}
              onClick={() => setOpen((o) => !o)}
              aria-haspopup="menu"
              aria-expanded={open}
            >
              <span>{currentRoom.name}</span>
              <span style={chevronStyle} aria-hidden>
                ▾
              </span>
            </button>
            <button
              type="button"
              style={renameButtonStyle}
              title="Rename room"
              aria-label="Rename room"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                setRenameDraft(currentRoom.name);
              }}
            >
              ✎
            </button>
          </>
        )}
      </div>
      {open && (
        <div role="menu" style={menuStyle}>
          {rooms.map((r) => {
            const active = r.id === currentRoom.id;
            const locked = readOnly.has(r.id);
            return (
              <button
                key={r.id}
                role="menuitem"
                type="button"
                style={{
                  ...itemStyle,
                  ...(active ? itemActiveStyle : null),
                  ...(locked ? { opacity: 0.55 } : null),
                }}
                title={locked ? "Read-only — unlock with Studio" : undefined}
                onClick={() => {
                  setOpen(false);
                  if (!active) void switchRoom(r.id);
                }}
              >
                <span>{r.name}</span>
                {active ? (
                  <span aria-hidden style={{ fontSize: 11, opacity: 0.7 }}>
                    ●
                  </span>
                ) : locked ? (
                  <span aria-hidden style={{ fontSize: 11, opacity: 0.7 }}>
                    🔒
                  </span>
                ) : null}
              </button>
            );
          })}
          {atCap ? (
            // At the Plan's Room cap: a quiet Studio nudge, not a creator.
            // (Routing into the Membership page is a follow-up; this closes
            // the menu and reads as an upgrade cue.)
            <button
              role="menuitem"
              type="button"
              style={{ ...newRoomStyle, color: "#c9a24a" }}
              onClick={() => setOpen(false)}
            >
              ✦ More rooms with Studio
            </button>
          ) : (
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
          )}
        </div>
      )}
    </div>
  );
}
