# 03 — Drag-to-move with React Spring, persisted on drag-end

**Tracer goal:** a User can drag a Note across the Canvas with physics-based motion, and the new position survives a page reload. This is the first issue that exercises the React Spring + `@react-spring/three` stack (ADR-0007) and the per-action debounced autosave (ADR-0005).

Builds on Issue 02 (selection exists and is reusable).

## Outcome (demo-able)

- Pointer-down on a Note → Note follows the pointer, with subtle spring lag and slight scale-up (~1.02×) and shadow-deepen on lift.
- Pointer-up → Note settles with spring damping and the new `x, y` are committed to the database.
- Reload the page → Notes appear at their new positions.
- Drag any Note within a multi-selection → all selected Notes move together, maintaining their relative offsets.
- Drag never "snaps" or "jumps" — motion is continuous from pointer-down to pointer-up.

## Why (links)

- PRD §5.3 (Move verb)
- ADR-0005 (per-action debounced autosave: position commits at drag-end)
- ADR-0007 (React Spring for animation)

## Acceptance criteria

- [ ] During drag, the on-screen position updates at 60 fps with no visible network round-trips — the UI is purely optimistic.
- [ ] Exactly one `UPDATE notes SET x = $1, y = $2 WHERE id = $3` per Note per drag, fired *at* drag-end (not during drag).
- [ ] Multi-Note drag fires one batched update (one query or one transaction), not N independent updates.
- [ ] If the network is offline at drag-end, the UI keeps the new position and the update retries on next online event. (Use Supabase's built-in retry or a simple `online`/`offline` listener.)
- [ ] Lift-off (pointer-down) applies a spring scale-up + shadow-deepen animation; settle (pointer-up) reverses it.
- [ ] Dragging is not initiated by clicks on empty Canvas — empty Canvas drag is **pan**, but the Camera stays fixed in this issue, so empty drag is a no-op for now (just don't accidentally drag a Note).
- [ ] Refreshing mid-drag (effectively impossible in practice, but tested via DevTools throttling): a drag in progress that's interrupted leaves the Note at its *last persisted* position, not its in-flight one.

## Touchpoints

### Database
- No schema change.
- `UPDATE notes SET x = $1, y = $2, updated_at = now() WHERE id = $4` per drag-end.
- RLS unchanged.

### Backend (Supabase)
- Standard `supabase.from('notes').update({x, y}).eq('id', id)` calls.
- For multi-Note drag, use `.upsert([...])` or a single RPC that takes an array — pick the simpler one.

### Frontend
- Install `@react-spring/three`.
- New `<DraggableNote>` wrapping the existing `<Note>` from Issue 01/02. Uses `useSpring` to animate `position`, `scale`, and `shadow` props.
- Pointer event flow:
  - `onPointerDown` on the Note mesh → record initial pointer world position, initial Note position, mark drag-active.
  - `onPointerMove` on the Canvas (window-level once drag-active) → compute delta, update Zustand's `notes[i].x, y` optimistically. Spring picks this up and animates the mesh.
  - `onPointerUp` → commit final position to Supabase. Reset drag-active.
- Spring config tunable (tension/friction) — start with `{ tension: 220, friction: 26 }` and adjust by feel.
- Multi-select drag: the dragged Note is the "lead"; other selected Notes follow with a constant offset applied to the same delta.
- Make sure the projection helper from Issue 02 still positions the per-selection toolbar correctly during drag (toolbar should follow the selection in realtime).

## Out of scope

- Camera pan/zoom (still fixed)
- Resize (separate issue)
- Edit text (Issue 04)
- Snapping to a grid or to other Notes
- Drag-to-create-from-toolbar (we use double-click-to-create from Issue 02)
- Z-axis drag (explicitly forbidden by ADR-0004 — depth is an enum, not draggable)

## References

- PRD § 5.3
- ADR-0005
- ADR-0007
- `CONTEXT.md` — Note, Camera
