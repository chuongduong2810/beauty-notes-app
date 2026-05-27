import { useEffect } from "react";
import { useAppStore } from "../store";

const TOAST_STYLE: React.CSSProperties = {
  position: "fixed",
  left: "50%",
  bottom: 32,
  transform: "translateX(-50%)",
  display: "flex",
  alignItems: "center",
  gap: 16,
  padding: "10px 16px",
  borderRadius: 999,
  background: "rgba(20, 14, 28, 0.85)",
  color: "#f6efe4",
  fontFamily: "system-ui, sans-serif",
  fontSize: 14,
  backdropFilter: "blur(8px)",
  border: "1px solid rgba(246, 239, 228, 0.15)",
  zIndex: 10,
};

const UNDO_BUTTON_STYLE: React.CSSProperties = {
  background: "transparent",
  border: "1px solid rgba(246, 239, 228, 0.4)",
  color: "#f6efe4",
  padding: "4px 12px",
  borderRadius: 999,
  cursor: "pointer",
  fontSize: 13,
};

export function UndoToast() {
  const toast = useAppStore((s) => s.undoToast);
  const undo = useAppStore((s) => s.undoLastDelete);
  const dismiss = useAppStore((s) => s.dismissUndoToast);

  useEffect(() => {
    if (!toast) return;
    const remaining = toast.expiresAt - Date.now();
    if (remaining <= 0) {
      dismiss();
      return;
    }
    const t = window.setTimeout(dismiss, remaining);
    return () => window.clearTimeout(t);
  }, [toast, dismiss]);

  if (!toast) return null;

  return (
    <div style={TOAST_STYLE} role="status" aria-live="polite">
      <span>Deleted {toast.count} {toast.count === 1 ? "Note" : "Notes"}</span>
      <button type="button" style={UNDO_BUTTON_STYLE} onClick={() => void undo()}>
        Undo
      </button>
    </div>
  );
}
