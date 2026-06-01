/**
 * Which of a User's Rooms are read-only under their current Plan
 * (issue #109, ADR-0021). Multi-room is a Studio Entitlement; Explorer is
 * capped at one Room. The downgrade rule is **never destructive**: a User
 * who owns more Rooms than their cap keeps every one — the extras just
 * become read-only until they re-subscribe, rather than being deleted or
 * hidden.
 *
 * "Extras" are the Rooms beyond the most-recently-updated `maxRooms`, so the
 * Rooms a User actively works in stay editable and the stalest ones lock.
 */

import type { Room } from "./room";

/**
 * Compute the set of read-only Room ids given the User's Room list and their
 * `maxRooms` entitlement.
 *
 * @param rooms - all Rooms the User owns (any order; sorted here by recency).
 * @param maxRooms - the active-Room cap from the current Plan's entitlements
 *   (`Infinity` for Studio).
 * @returns the ids of Rooms that are read-only (empty when within the cap).
 */
export function readOnlyRoomIds(rooms: Room[], maxRooms: number): Set<string> {
  if (rooms.length <= maxRooms) return new Set();
  const byRecency = [...rooms].sort((a, b) =>
    b.updated_at.localeCompare(a.updated_at),
  );
  // Keep the most-recent `maxRooms` active; everything after is read-only.
  return new Set(byRecency.slice(maxRooms).map((r) => r.id));
}

/**
 * Whether the User may create another Room — true only while the number of
 * Rooms they own is below their `maxRooms` cap (issue #109). Blocked creation
 * routes to Membership rather than erroring (the brief: never block, nudge).
 *
 * @param roomCount - how many Rooms the User currently owns.
 * @param maxRooms - the active-Room cap from the current Plan's entitlements.
 */
export function canCreateRoom(roomCount: number, maxRooms: number): boolean {
  return roomCount < maxRooms;
}
