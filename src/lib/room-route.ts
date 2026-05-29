/**
 * Hand-rolled URL helpers for the per-Room route `/room/<id>` (issue
 * #22). Hand-rolled instead of pulling in `react-router` for one
 * route — saves a dep and keeps the routing logic in plain testable
 * functions.
 *
 * The "current Room" is determined at boot from `window.location.pathname`
 * (via `parseRoomIdFromPath`). On switch the App calls
 * `history.pushState(null, "", roomPath(newRoomId))` so the URL stays
 * in sync without a full page reload.
 */

const ROOM_PATH_RE = /^\/room\/([^/?#]+)/;

/**
 * Extract a Room id from a URL path. Returns null when the path
 * isn't a Room route or when no id segment is present. Strips
 * trailing path segments, query strings, and hash fragments.
 */
export function parseRoomIdFromPath(path: string): string | null {
  const match = ROOM_PATH_RE.exec(path);
  return match ? match[1] : null;
}

/** Build the canonical Room route for a given Room id. */
export function roomPath(roomId: string): string {
  return `/room/${roomId}`;
}
