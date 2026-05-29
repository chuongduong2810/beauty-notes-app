import { describe, expect, it } from "vitest";
import { buildRoomLedger, createdLabel } from "./room-ledger";
import type { Note } from "./room";

function makeNote(over: Partial<Note> & { id: string }): Note {
  return {
    surface_id: "s1",
    owner_id: "u1",
    u: 0.5,
    v: 0.5,
    width_cm: 12,
    height_cm: 9,
    body: "",
    color_id: "butter",
    bookmarked: false,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...over,
  };
}

const NOW = new Date("2026-05-29T12:00:00.000Z").getTime();

describe("createdLabel", () => {
  it("reads 'Today' for same-day", () => {
    expect(createdLabel("2026-05-29T01:00:00.000Z", NOW)).toBe("Today");
  });
  it("reads 'Yesterday' for one day ago", () => {
    expect(createdLabel("2026-05-28T01:00:00.000Z", NOW)).toBe("Yesterday");
  });
  it("reads 'Nd ago' within a week", () => {
    expect(createdLabel("2026-05-26T01:00:00.000Z", NOW)).toBe("3d ago");
  });
});

describe("buildRoomLedger", () => {
  it("counts notes + bookmarks and reflects claim status", () => {
    const notes = [
      makeNote({ id: "a", bookmarked: true }),
      makeNote({ id: "b" }),
      makeNote({ id: "c", bookmarked: true }),
    ];
    const ledger = buildRoomLedger(
      notes,
      { created_at: "2026-05-29T00:00:00.000Z" },
      false,
      NOW,
    );
    expect(ledger.noteCount).toBe(3);
    expect(ledger.bookmarkCount).toBe(2);
    expect(ledger.status).toBe("Unclaimed");
    expect(ledger.createdLabel).toBe("Today");
  });

  it("reports Owned when claimed", () => {
    const ledger = buildRoomLedger([], { created_at: NOW.toString() }, true, NOW);
    expect(ledger.status).toBe("Owned");
  });

  it("returns recent notes most-recently-edited first, capped", () => {
    const notes = [
      makeNote({ id: "a", updated_at: "2026-05-01T00:00:00.000Z" }),
      makeNote({ id: "b", updated_at: "2026-05-09T00:00:00.000Z" }),
      makeNote({ id: "c", updated_at: "2026-05-05T00:00:00.000Z" }),
    ];
    const ledger = buildRoomLedger(notes, null, false, NOW, 2);
    expect(ledger.recentNotes.map((n) => n.id)).toEqual(["b", "c"]);
    expect(ledger.createdLabel).toBe("—");
  });
});
