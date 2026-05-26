# 01 — Walking skeleton: anonymous auth, one Canvas, one Note

**Tracer goal:** a User opens the app and sees a single Note rendered as a WebGL mesh inside their own Canvas. No interactions, no editing. Just proof that the full stack — Supabase Auth → Postgres + RLS → React + R3F render — is wired end-to-end.

## Outcome (demo-able)

Open the app cold. Within a second:
- A new anonymous Supabase session exists in `localStorage`.
- A row in `canvases` exists owned by `auth.uid()`.
- A row in `notes` exists (seeded server-side or client-side on first run) belonging to that Canvas.
- The R3F scene renders, the Note appears as a coloured plane with `troika-three-text` displaying the body text.
- Refreshing the page does **not** create a second Canvas or a second Note — the same ones reload.

## Why (links)

- ADR-0001 (pure WebGL rendering) — proves the render path works at all
- ADR-0003 (anonymous-first auth) — proves the auth handshake works at all
- PRD §5.1 (first-run experience), §10 (data model)

## Acceptance criteria

- [ ] Clearing `localStorage` + reloading produces a new anonymous user with a new Canvas and a new Note (no leakage).
- [ ] Opening DevTools → Supabase, `select * from canvases` for the session's user returns exactly one row.
- [ ] Same query for `notes` returns exactly one row whose `canvas_id` matches.
- [ ] Note text "Welcome to Beauty Notes" (or similar seeded text) is visible and readable on the WebGL canvas.
- [ ] RLS check: a manual query as a *different* anonymous user returns zero rows from the first user's tables.

## Touchpoints

### Database
- New migration creating `canvases` and `notes` tables per PRD §10.
- RLS enabled on both with policy `auth.uid() = owner_id` for select/insert/update/delete.
- `notes_canvas_id_idx` index.
- A `default_palette_color_id` constant lives in code; `color_id` column defaults to it.

### Backend (Supabase)
- Anonymous auth enabled in the Supabase project settings.
- A Postgres function `ensure_initial_canvas()` (or equivalent client-side logic) that, on first sign-in for a User, creates an "Untitled" Canvas and a seed Note. Idempotent — running twice is a no-op.
- Environment vars for `SUPABASE_URL` and `SUPABASE_ANON_KEY` checked in via `.env.example`.

### Frontend
- Vite + React + TypeScript scaffold.
- Supabase client singleton; on app boot, call `signInAnonymously()` if no session.
- After auth, call `ensure_initial_canvas()` (RPC) and fetch the Canvas + its Notes.
- Zustand store holds: `session`, `currentCanvas`, `notes[]`.
- R3F `<Canvas>` mounted full-window with an orthographic-ish perspective camera at `(0, 0, mid layer)`.
- One `<Note>` component per `notes[]` entry: a `<mesh>` with a flat plane geometry, a glass-like material (transparent + soft colour from Palette), and a `<Text>` from `troika-three-text` for the body.
- Loading state: while auth and first fetch are in flight, a blank gradient-sky background renders (no spinner — calm).

## Out of scope (deliberately)

- Creating, editing, dragging, resizing, or deleting Notes
- Multi-Canvas picker
- Camera pan/zoom/dolly (Camera is fixed at home for v1 of the slice)
- Selection
- Toolbars
- Toasts
- Per-Note colour variation (use one default Palette entry for now)
- Glassmorphism polish — a flat coloured plane is acceptable

## References

- `CONTEXT.md` — User, Canvas, Note, Camera, Palette
- `docs/adr/0001-pure-webgl-rendering.md`
- `docs/adr/0003-anonymous-first-auth.md`
- `PRD.md` §§ 5.1, 10
