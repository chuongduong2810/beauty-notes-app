import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useAppStore } from "../store";
import {
  buildCustomizationBrowser,
  type CustomizationGroup,
} from "../lib/customization-browser";
import { defaultItemFor, type CatalogItem, type CatalogKind } from "../lib/catalog";
import {
  ROOM_SIZE_PRESETS,
  appliedRoomSizePresetId,
} from "../lib/room-size";

/**
 * In-room Customization browser (issue #108, ADR-0022). A chrome affordance
 * in the bottom-left opens a panel that lists the Catalog grouped by kind and
 * applies Items *live* to the current Room — Customization happens in the
 * Room, not a settings screen.
 *
 * Premium discovery (ADR-0021/0022): locked Items stay visible with a 🔒 and
 * are never hidden. Tapping one doesn't block anything — it reveals a quiet
 * inline "Unlock with Membership" nudge whose link gently routes to the
 * Membership page (via the store's `membershipRequested` one-shot). No popups,
 * no paywalls; note-taking is never interrupted.
 *
 * Styling follows the same glass-and-cyan vocabulary as the RoomPicker /
 * ToolPalette so the chrome reads as a set.
 */

const containerStyle: CSSProperties = {
  position: "fixed",
  bottom: 16,
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
};

const panelStyle: CSSProperties = {
  marginBottom: 6,
  width: 268,
  maxHeight: "60vh",
  overflowY: "auto",
  padding: 12,
  borderRadius: 12,
  border: "1px solid rgba(255, 255, 255, 0.08)",
  background: "rgba(20, 16, 28, 0.92)",
  backdropFilter: "blur(10px)",
  WebkitBackdropFilter: "blur(10px)",
  boxShadow: "0 10px 32px rgba(0,0,0,0.45)",
  display: "flex",
  flexDirection: "column",
  gap: 12,
};

const panelHeaderStyle: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  color: "rgba(255,255,255,0.92)",
  fontSize: 14,
  fontWeight: 600,
};

const panelHintStyle: CSSProperties = {
  margin: 0,
  color: "rgba(255,255,255,0.5)",
  fontSize: 11,
  lineHeight: 1.4,
};

const groupTitleStyle: CSSProperties = {
  color: "rgba(255,255,255,0.55)",
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: 0.6,
  textTransform: "uppercase",
  margin: "0 0 6px",
};

const chipRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
};

const chipBase: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "5px 10px",
  borderRadius: 999,
  border: "1px solid rgba(255, 255, 255, 0.10)",
  background: "transparent",
  color: "rgba(255,255,255,0.82)",
  fontSize: 12,
  cursor: "pointer",
  fontFamily: "inherit",
};

const chipApplied: CSSProperties = {
  background: "rgba(255,255,255,0.92)",
  color: "#1a1626",
  borderColor: "transparent",
};

const chipLocked: CSSProperties = {
  color: "rgba(255,255,255,0.55)",
};

const swatchStyle = (hex: string): CSSProperties => ({
  width: 12,
  height: 12,
  borderRadius: 3,
  background: hex,
  boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.25)",
});

const nudgeStyle: CSSProperties = {
  marginTop: 4,
  padding: "8px 10px",
  borderRadius: 8,
  background: "rgba(201, 162, 74, 0.12)",
  border: "1px solid rgba(201, 162, 74, 0.35)",
  color: "rgba(255,255,255,0.85)",
  fontSize: 11.5,
  lineHeight: 1.4,
};

const nudgeLinkStyle: CSSProperties = {
  display: "inline-block",
  marginTop: 6,
  padding: 0,
  border: "none",
  background: "transparent",
  color: "#e0b85a",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "inherit",
};

/** Whether an Item is the free default for its kind ("Bare Room" etc.). */
function isDefaultItem(item: CatalogItem): boolean {
  return item.id === defaultItemFor(item.kind).id;
}

export function CustomizationPanel() {
  const currentRoom = useAppStore((s) => s.currentRoom);
  const entitlements = useAppStore((s) => s.entitlements);
  const applyCustomization = useAppStore((s) => s.applyCustomization);
  const addFurniture = useAppStore((s) => s.addFurniture);
  const removeFurniture = useAppStore((s) => s.removeFurniture);
  const resizeRoom = useAppStore((s) => s.resizeRoom);
  const requestMembership = useAppStore((s) => s.requestMembership);

  const [open, setOpen] = useState(false);
  // The label of the locked look/size the User most recently tapped — drives
  // the inline premium-discovery nudge. Null when no nudge is showing.
  const [nudgeLabel, setNudgeLabel] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Click outside closes the panel (and any open nudge).
  useEffect(() => {
    if (!open) return;
    const onDocPointer = (e: PointerEvent) => {
      const node = containerRef.current;
      if (node && !node.contains(e.target as Node)) {
        setOpen(false);
        setNudgeLabel(null);
      }
    };
    document.addEventListener("pointerdown", onDocPointer);
    return () => document.removeEventListener("pointerdown", onDocPointer);
  }, [open]);

  if (!currentRoom) return null;

  const groups: CustomizationGroup[] = buildCustomizationBrowser(
    currentRoom,
    entitlements,
  );

  /** Apply (or toggle) an unlocked Item; clears any showing nudge. */
  const applyItem = (kind: CatalogKind, item: CatalogItem, applied: boolean) => {
    setNudgeLabel(null);
    if (kind === "furniture") {
      // Furniture is an additive set: toggle membership. The free "Bare Room"
      // default represents the empty set, so applying it clears all furniture.
      if (isDefaultItem(item)) {
        for (const id of currentRoom.furniture ?? []) void removeFurniture(id);
      } else if (applied) {
        void removeFurniture(item.id);
      } else {
        void addFurniture(item.id);
      }
      return;
    }
    void applyCustomization(kind, item.id);
  };

  // Room resize is a Studio Entitlement (advancedCustomization). The size
  // presets stay visible for everyone with a lock; tapping one below Studio
  // nudges toward Membership rather than blocking.
  const resizeLocked = !entitlements.advancedCustomization;
  const appliedSizeId = appliedRoomSizePresetId(currentRoom);

  /** Route the premium-discovery nudge's link to the Membership page. */
  const goToMembership = () => {
    requestMembership();
    setOpen(false);
    setNudgeLabel(null);
  };

  return (
    <div style={containerStyle} ref={containerRef} data-testid="customization-panel">
      {open && (
        <div style={panelStyle} role="dialog" aria-label="Customize room">
          <div style={panelHeaderStyle}>
            <span>Customize</span>
            <button
              type="button"
              aria-label="Close customize"
              style={{ ...chipBase, padding: "2px 8px" }}
              onClick={() => {
                setOpen(false);
                setNudgeLabel(null);
              }}
            >
              ×
            </button>
          </div>
          <p style={panelHintStyle}>
            Make this room yours. Locked looks open a Membership — your notes
            stay free.
          </p>

          {groups.map((group) => (
            <div key={group.kind}>
              <p style={groupTitleStyle}>{group.title}</p>
              <div style={chipRowStyle}>
                {group.items.map(({ item, applied, locked }) => (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={applied}
                    style={{
                      ...chipBase,
                      ...(applied ? chipApplied : null),
                      ...(locked ? chipLocked : null),
                    }}
                    onClick={() =>
                      locked
                        ? setNudgeLabel(item.label)
                        : applyItem(group.kind, item, applied)
                    }
                  >
                    {item.swatch && <span style={swatchStyle(item.swatch)} aria-hidden />}
                    <span>{item.label}</span>
                    {locked && <span aria-hidden>🔒</span>}
                  </button>
                ))}
              </div>
            </div>
          ))}

          {/* Room Size — resizing is a Studio Entitlement (room resize). The
              presets stay visible with a lock below Studio; tapping one nudges
              toward Membership rather than blocking (premium discovery). */}
          <div>
            <p style={groupTitleStyle}>Room Size</p>
            <div style={chipRowStyle}>
              {ROOM_SIZE_PRESETS.map((preset) => {
                const applied = preset.id === appliedSizeId;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    aria-pressed={applied}
                    title={preset.blurb}
                    style={{
                      ...chipBase,
                      ...(applied ? chipApplied : null),
                      ...(resizeLocked ? chipLocked : null),
                    }}
                    onClick={() =>
                      resizeLocked
                        ? setNudgeLabel(`The ${preset.label} room`)
                        : (setNudgeLabel(null), void resizeRoom(preset.id))
                    }
                  >
                    <span>{preset.label}</span>
                    {resizeLocked && <span aria-hidden>🔒</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {nudgeLabel && (
            <div style={nudgeStyle} role="note">
              <span>
                <strong>{nudgeLabel}</strong> is part of a Membership. Nothing
                changes here until you choose to upgrade.
              </span>
              <br />
              <button type="button" style={nudgeLinkStyle} onClick={goToMembership}>
                Unlock with Membership →
              </button>
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        style={triggerStyle}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span aria-hidden>🎨</span>
        Customize
      </button>
    </div>
  );
}
