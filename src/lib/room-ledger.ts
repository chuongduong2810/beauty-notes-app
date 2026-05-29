import type { Note, Room } from "./room";

/**
 * Read-only summary of a Room for the Notebook's Room Ledger page
 * (CONTEXT.md `Room Ledger`). Pure + derived from existing data — no new
 * schema. Kept renderer-free so the counts/labels are unit-testable.
 */

export type RoomLedger = {
  /** "Owned" once the Room has been Claimed, else "Unclaimed". */
  status: "Owned" | "Unclaimed";
  /** Total Notes in the Room. */
  noteCount: number;
  /** Notes the User has Bookmarked. */
  bookmarkCount: number;
  /** Friendly "created" label (e.g. "Today", "3d ago", or a date). */
  createdLabel: string;
  /** A few most-recently-edited Notes for the ledger's "Recent Notes". */
  recentNotes: Note[];
};

/** Default number of recent Notes shown on the ledger. */
export const ROOM_LEDGER_RECENT_LIMIT = 4;

/**
 * Friendly relative-day label for an ISO timestamp.
 *
 * @param iso - the creation timestamp.
 * @param nowMs - "now" in ms (injected so the label is testable).
 */
export function createdLabel(iso: string, nowMs: number): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const days = Math.floor((nowMs - then) / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

/**
 * Build the Room Ledger summary from a Room's Notes.
 *
 * @param notes - the current Room's Notes.
 * @param room - the current Room (for `created_at`); may be null pre-load.
 * @param claimed - whether the Room has been Claimed (owner is permanent).
 * @param nowMs - "now" in ms, injected for a testable `createdLabel`.
 * @param recentLimit - how many recent Notes to include.
 */
export function buildRoomLedger(
  notes: readonly Note[],
  room: Pick<Room, "created_at"> | null,
  claimed: boolean,
  nowMs: number,
  recentLimit: number = ROOM_LEDGER_RECENT_LIMIT,
): RoomLedger {
  const recentNotes = [...notes]
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    .slice(0, recentLimit);
  return {
    status: claimed ? "Owned" : "Unclaimed",
    noteCount: notes.length,
    bookmarkCount: notes.filter((n) => n.bookmarked).length,
    createdLabel: room ? createdLabel(room.created_at, nowMs) : "—",
    recentNotes,
  };
}
