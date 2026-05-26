# 02 — Create and delete Notes (with undo)

**Tracer goal:** a User can double-click empty Canvas to create a Note, click to select it, press Delete to remove it, and Undo via toast — with each action round-tripping to the database.

Builds directly on Issue 01.

## Outcome (demo-able)

- Double-click empty Canvas → a new Note appears at the click position, persisted to `notes`.
- Click an existing Note → it's selected (visual ring or subtle outline).
- Click empty → deselect.
- Press `Delete` on a selected Note (or click the trash icon in the per-selection toolbar) → Note vanishes, row deleted from `notes`, toast appears with "Undo" button.
- Clicking Undo within the toast lifetime → Note reappears in place. The undo path either re-inserts the row with the same id, or restores from an in-memory snapshot taken before delete (implementation choice — must work after refresh-during-toast though: if the toast is open and the User refreshes, the Note stays deleted).

## Why (links)

- PRD §5.3 (Note CRUD)
- PRD §5.4 (selection)
- ADR-0005 (debounced autosave — colour/depth/create/delete commit immediately)

## Acceptance criteria

- [ ] Double-click coordinates → world coordinates conversion is correct: the Note appears under the cursor at any zoom level. (Camera stays fixed for this issue; zoom is still at 1×.)
- [ ] A newly created Note's row contains the correct `canvas_id`, `owner_id`, `x`, `y`, `depth = 'mid'`, default `color_id`, and an empty `body`.
- [ ] Single-click on a Note selects exactly that Note. Shift-click toggles a Note in/out of the selection.
- [ ] Selection state is *not* persisted to the database — it's UI-only.
- [ ] Pressing `Delete` with multiple Notes selected deletes them all in one round-trip (one batched query or one transaction).
- [ ] Undo toast appears for ~5 s with a clear "Undo" affordance, then dismisses.
- [ ] Toast Undo restores all deleted Notes from the same delete action.
- [ ] Refreshing the page during the toast lifetime → deletion stands (no recovery after refresh, per Q13 / ADR-0005 implicit decision).

## Touchpoints

### Database
- No schema change.
- Insert and delete operations against `notes`.
- RLS already enforces `auth.uid() = owner_id` from Issue 01.

### Backend (Supabase)
- Insert via `supabase.from('notes').insert({...})`.
- Delete via `supabase.from('notes').delete().in('id', deletedIds)`.
- Confirm RLS denies insert/delete attempted on another User's Notes (manual test using two anonymous sessions).

### Frontend
- R3F pointer-event handlers on the floor mesh of the Canvas: `onDoubleClick` → unproject click coordinates to world coordinates → create Note.
- R3F pointer-event handler per `<Note>`: `onClick` (with shift modifier detection) → update Zustand selection.
- Zustand selectors: `selectedNoteIds`, `selection` (array of Notes).
- Per-selection floating toolbar (DOM, positioned via screen-projection of the selection's bounding box) with a trash icon. Toolbar only shows when `selectedNoteIds.length > 0`. This is the *first* DOM element living *over* the WebGL canvas — keep its placement helpers (a `useProjectedPosition(worldPos)` hook) reusable; ADR-0002's invisible textarea will use the same helper.
- Keyboard handler: `Delete` / `Backspace` → if anything selected, delete it.
- Toast component: appears bottom-centre, contains "Deleted N Notes" + "Undo" button. Auto-dismisses after 5 s. Implemented with React Spring.
- Undo path: keep the deleted Notes in memory in the Zustand store with a "pending deletion" marker. If Undo fires within toast lifetime, re-insert via Supabase. If toast dismisses, drop the marker.
- `⌘Z` / `Ctrl+Z` handler with the same behaviour as the toast Undo, for the same session.

## Out of scope

- Marquee selection (this issue uses click + shift-click only)
- Long-press on tablet (this issue assumes desktop for now)
- Visual polish on the selection ring — a subtle outline is enough
- Drag-to-move (Issue 03)
- Edit text (Issue 04)
- Multi-Canvas picker

## References

- PRD §§ 5.3, 5.4
- ADR-0005 (autosave timing)
- `CONTEXT.md` — Note, Selection (UI concept), Palette
