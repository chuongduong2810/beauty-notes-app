import { useAppStore } from "../store";

/**
 * Small centered "Loading Room" overlay shown while switchRoom or
 * createRoom is in flight (issue #22). Smaller and less heavy than
 * the bootstrap SplashScreen — the canvas is still rendering the
 * previous Room behind a dim, so we just need a clear "we're
 * switching" signal, not a full blocking takeover.
 *
 * Styling reuses the `.splash-*` neon vocabulary in index.html so
 * the loader feels like part of the same HUD family.
 */
export function RoomSwitchingOverlay() {
  const switching = useAppStore((s) => s.switchingRoom);
  if (!switching) return null;
  return (
    <div className="room-switching" role="status" aria-live="polite">
      <div className="room-switching__card">
        <div className="room-switching__ring" aria-hidden="true">
          <div className="room-switching__ring-arc" />
        </div>
        <div className="room-switching__label">Loading Room</div>
      </div>
    </div>
  );
}
