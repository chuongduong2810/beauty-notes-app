import type { Note } from "./room";

/**
 * Pure section-builder for the desk Notebook (issue #57, ADR-0016).
 *
 * The Notebook is a browsing index into the *current Room's* existing
 * Notes — it holds no content of its own (CONTEXT.md). Its open spread
 * shows three sections, each a short, capped list:
 *
 *  - **Recently Created** — newest `created_at` first.
 *  - **Recently Edited**  — newest `updated_at` first.
 *  - **Bookmarked**       — only Notes the User has Bookmarked
 *    (issue #55), newest `updated_at` first.
 *
 * Kept renderer-free and side-effect-free so the sort/cap/filter rules
 * are unit-testable without an R3F canvas or the store. The component
 * feeds the result straight into the page render.
 */

/** The three Notebook sections, in page order. */
export const NOTEBOOK_SECTION_KEYS = [
  "recentlyCreated",
  "recentlyEdited",
  "bookmarked",
] as const;

export type NotebookSectionKey = (typeof NOTEBOOK_SECTION_KEYS)[number];

/** Human-readable page heading for each section. */
export const NOTEBOOK_SECTION_TITLES: Record<NotebookSectionKey, string> = {
  recentlyCreated: "Recently Created",
  recentlyEdited: "Recently Edited",
  bookmarked: "Bookmarked",
};

/**
 * Max entries shown per section. The Notebook is a quick-access hub, not
 * a full browser — anything past the cap simply isn't listed (a fuller
 * browser is out of scope for this feature).
 */
export const NOTEBOOK_SECTION_LIMIT = 6;

export type NotebookSections = Record<NotebookSectionKey, Note[]>;

/** Descending ISO-timestamp comparator (newest first). */
function byDesc(field: "created_at" | "updated_at") {
  return (a: Note, b: Note) => b[field].localeCompare(a[field]);
}

/**
 * Build the three capped, sorted Notebook sections from a Room's Notes.
 *
 * @param notes - the current Room's Notes (any order).
 * @param limit - max entries per section (defaults to
 *   {@link NOTEBOOK_SECTION_LIMIT}).
 * @returns one capped, sorted list per section key.
 */
export function buildNotebookSections(
  notes: readonly Note[],
  limit: number = NOTEBOOK_SECTION_LIMIT,
): NotebookSections {
  const all = [...notes];
  return {
    recentlyCreated: all.slice().sort(byDesc("created_at")).slice(0, limit),
    recentlyEdited: all.slice().sort(byDesc("updated_at")).slice(0, limit),
    bookmarked: all
      .filter((n) => n.bookmarked)
      .sort(byDesc("updated_at"))
      .slice(0, limit),
  };
}

/**
 * One-line preview of a Note's body for a Notebook entry row. Collapses
 * whitespace, takes the first line, and truncates long text. Empty
 * Notes read as "Untitled note" so a blank row never renders.
 *
 * @param body - the Note's plain-text body.
 * @param maxLen - max characters before truncation (default 40).
 */
export function noteSnippet(body: string, maxLen = 40): string {
  const firstLine = body.split("\n").find((l) => l.trim().length > 0);
  const oneLine = (firstLine ?? "").trim().replace(/\s+/g, " ");
  if (!oneLine) return "Untitled note";
  return oneLine.length > maxLen ? `${oneLine.slice(0, maxLen)}…` : oneLine;
}
