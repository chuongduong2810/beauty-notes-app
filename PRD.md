# Beauty Notes — Product Requirements Document

A spatial sticky-notes application centred on immersive interaction, fluid motion, and atmospheric visual design.

---

## 1. Overview

Beauty Notes lets a single User work inside an infinite-feeling 3D Canvas containing draggable plain-text Notes. The Camera pans, zooms, and dollies forward through three discrete depth layers, producing real parallax. Every interaction — drag, resize, focus, depth transition — is animated with physics-based springs.

The product's differentiator is **calm, tactile, emotionally-engaging spatial experience**, not feature count. The brief lists Linear, Milanote, Cosmos, and Apple-style motion design as references; the product borrows their *motion vocabulary*, not their feature surface.

---

## 2. Goals & non-goals

### Goals (v1)

1. **Magic first moment.** The first frame after auth must be a usable Canvas, reached in under a second, with zero friction. (See ADR-0003.)
2. **Real spatial feel.** Real perspective Camera, real depth layers, real parallax during pan / zoom / dolly — not CSS faking it.
3. **Tactile motion.** Every drag, resize, focus, and Camera move responds with physics-based springs.
4. **Persistent and predictable.** User work survives tab close; reopening restores the last view per Canvas.
5. **Desktop + tablet parity** for all core verbs (create, select, drag, resize, marquee, pan, zoom, focus).

### Non-goals (v1)

- Collaboration, sharing, multi-user editing
- Realtime sync via Supabase channels
- Rich text, markdown rendering, formatting
- Images, attachments, or embedded media inside Notes
- Free 3D placement of Notes (continuous z drag)
- Custom colour picker
- Persistent undo across refresh / Trash view
- Render optimisations beyond ~100 Notes per Canvas
- `⌘K` command palette
- Mobile phone form factor

---

## 3. Users

The User is a solo creative or thinker who wants a calm spatial space to brainstorm in. They:

- Start **anonymously** — no sign-up required on first load.
- Can promote their anonymous account to a real one later without losing data.
- Never share Canvases with anyone in v1.
- Typically hold dozens of Notes per Canvas, organised by spatial clustering and depth — not by lists or hierarchies.
- Use desktop (mouse + trackpad) and tablet (touch). Phone is out of scope.

---

## 4. Domain model

From `CONTEXT.md`. Glossary terms are bolded.

- **User** — owns Canvases and Notes. Anonymous on first load; can be promoted to a signed-up account via `supabase.auth.linkIdentity` without losing data. (ADR-0003)
- **Canvas** — a bounded 3D volume (50 000 × 50 000 world units in X/Y, three discrete depth slots in Z) owned by one User. A User has many Canvases.
- **Note** — a single draggable, resizable plain-text sticky note placed at a position inside a Canvas. The atomic unit of content. Rendered as a 3D mesh in WebGL.
- **Depth** — a discrete layer assignment on each Note (`back | mid | front`). Controls stacking order *and* parallax behaviour (deeper layers move more slowly). Defaults to `mid`.
- **Camera** — the User's view into a Canvas: position `(x, y, z)`, zoom, and focused depth layer. Can pan, zoom, *and* dolly in Z (ADR-0004). State persisted per Canvas.
- **Palette** — fixed curated set of ~6 hues. Notes reference Palette entries by `color_id` enum, not raw hex.
- **Parallax** — the motion effect emerging from Notes at different Depths moving at different rates relative to the Camera. Not a separate feature — a consequence of Depth + Camera movement.

---

## 5. Functional requirements

### 5.1 First-run experience

- On first load, the app calls `supabase.auth.signInAnonymously()` and receives a session with a UUID.
- A blank Canvas titled "Untitled" is auto-created and owned by that UUID.
- The User lands **directly inside the Canvas** — no splash, no picker, no tutorial.
- On subsequent loads, the most recently used Canvas reopens at its last Camera position.

### 5.2 Canvas management

- The Canvas picker lives as a **top-left dropdown** showing the current Canvas name + chevron.
- Tapping the dropdown opens a small panel listing all Canvases and a "+ New Canvas" entry.
- Each Canvas has its own URL (`/canvas/:id`) for bookmarking and browser navigation.

### 5.3 Note CRUD

| Verb | Gesture | Notes |
|---|---|---|
| **Create** | Double-click empty Canvas (desktop) / double-tap empty Canvas (tablet) | New Note appears at the click position, immediately focused for editing. Defaults to `mid` depth, default Palette colour. |
| **Edit** | Double-click an existing Note | Enters edit mode via the invisible textarea overlay (ADR-0002). |
| **Move** | Drag a Note (one-finger or mouse) | If part of a selection, all selected Notes move together. |
| **Resize** | Drag a corner handle on the focused Note | Free aspect, ~120 px – 800 px in screen pixels at 1× zoom. Only one Note resizes at a time, even within a multi-selection. |
| **Delete** | `Delete` key on selection, or trash icon in per-selection toolbar | Instant hard-delete. Toast with "Undo" button. `⌘Z` works for the session. Permanent after refresh. |

### 5.4 Selection

| Gesture | Action |
|---|---|
| Click / tap a Note | Select |
| Shift-click a Note | Toggle in/out of selection |
| Two-finger tap a Note (tablet) | Toggle in/out of selection |
| Click / tap empty | Deselect |
| Drag on empty | **Pan** the Camera |
| Modifier + drag on empty (desktop) | Marquee select |
| Long-press + drag on empty (tablet) | Marquee select |

The per-selection toolbar floats near the selection and contains: depth picker (back / mid / front), colour picker (Palette), focus button, trash. Visible only while at least one Note is selected.

### 5.5 Camera & navigation

| Action | Input |
|---|---|
| Pan | Drag-empty (mouse, touch); two-finger drag (trackpad) |
| Zoom | Mouse wheel = zoom-and-dolly; `⌘`/`Ctrl`+wheel = finer zoom; trackpad pinch = zoom; touch pinch = zoom |
| Focus on Note | `F` key while selected, or focus icon in per-selection toolbar — Camera dollies forward to the Note's depth layer, pans to centre, zooms to fit |
| Home | "Home" button (top-right corner of Canvas) or `H` key — returns to `(0, 0, mid layer, 1× zoom)` |
| Fit all Notes | Button next to Home, or `Shift+F` — zooms to bounding box of all Notes + padding |

**Zoom range:** 0.1× – 4×.

**Cinematic dolly:** when the wheel zooms past a threshold, the Camera *translates forward in Z* toward the closest depth layer rather than only narrowing FOV. This is the visible payoff for ADR-0001 + ADR-0004 — the back layer slides past, the front layer expands.

### 5.6 Depth assignment

- New Notes default to `mid`.
- Change via the per-selection toolbar (three stacked-plane icons).
- Keyboard accelerators: `[` send backward, `]` bring forward.
- *No* drag-in-z gesture. Depth is an affordance, not a placement axis.

### 5.7 Colour

- Per-selection toolbar shows the **Palette** — ~6 curated hues.
- Each hue renders with glassmorphism: blurred backdrop, soft gradient interior, soft drop shadow.
- No custom hex picker, no colour history, no "more colours…" entry.
- Schema stores `color_id` enum so the Palette can be retuned globally without data migration.

### 5.8 Persistence

Per-action debounced autosave with optimistic UI (ADR-0005):

| Change | Commit timing |
|---|---|
| Note position | At drag-end |
| Note size | At resize-end |
| Note text | 500 ms after typing pauses |
| Note depth | Immediately |
| Note colour | Immediately |
| Camera state | ~1 000 ms after pan / zoom / dolly settles |

- Cross-tab races resolved by **last-write-wins**.
- Supabase Realtime is deliberately not used (ADR-0005).
- All Canvas and Note rows carry `owner_id`. RLS policy: `auth.uid() = owner_id`. Applies uniformly to anonymous and signed-up Users.

---

## 6. Architectural decisions (ADRs)

| # | Title | Summary |
|---|---|---|
| [ADR-0001](./docs/adr/0001-pure-webgl-rendering.md) | Pure WebGL Rendering via R3F | Notes and the Canvas are rendered entirely inside R3F; no DOM elements for Note bodies. |
| [ADR-0002](./docs/adr/0002-invisible-textarea-for-note-editing.md) | Invisible Textarea for Editing | A single transparent `<textarea>` overlays the focused Note during editing, bridging IME, clipboard, screen readers, and iPadOS soft keyboard. |
| [ADR-0003](./docs/adr/0003-anonymous-first-auth.md) | Anonymous-First Auth | `signInAnonymously` on first load; `linkIdentity` for promotion to a real account. RLS works uniformly. |
| [ADR-0004](./docs/adr/0004-3d-volume-canvas-with-camera-dolly.md) | 3D Volume Canvas with Camera Dolly | Canvas is a real 3D volume; Camera dollies forward in Z for focus transitions. Depth assignment remains 2D-affordance-driven. |
| [ADR-0005](./docs/adr/0005-per-action-debounced-autosave-no-realtime.md) | Debounced Autosave, No Realtime | Optimistic per-action writes; Supabase Realtime deliberately not used because the product is solo. |
| [ADR-0006](./docs/adr/0006-no-render-optimisation-for-v1.md) | No Render Optimisation for v1 | One mesh per Note, no culling, no instancing. Budget ~100 Notes per Canvas. |
| [ADR-0007](./docs/adr/0007-react-spring-for-animation.md) | React Spring + `@react-spring/three` | One animation engine, physics-based, WebGL-first. No Framer Motion. |

---

## 7. Visual & motion direction

- **Minimal but atmospheric UI.** The DOM surface is small: a top-left Canvas dropdown, a floating per-selection toolbar, top-right Home / Fit-all buttons, an autosave / undo toast.
- **Soft lighting.** R3F ambient + directional light, gradient sky background.
- **Glassmorphism on Notes.** Blurred backdrop behind the Note, soft gradient interior matching the Palette hue, soft drop shadow with depth-dependent intensity.
- **Physics-based motion.** React Spring everywhere — drag inertia, resize ease-out, focus dolly with overshoot damping, hover bloom.
- **Subtle parallax.** Back layer moves at ~0.5× Camera velocity, mid at 1×, front at ~1.5×. Tunable.
- **Apple-style focus dolly.** When the User focuses a Note, the Camera doesn't just zoom — it *moves forward through space* to that Note's depth layer. The back layer slides past, the front layer expands, parallax is visible throughout the transition.

---

## 8. Performance & constraints

| Constraint | Value |
|---|---|
| Notes per Canvas (v1 budget) | ~100 (ADR-0006) |
| Canvas world bounds | 50 000 × 50 000 in X/Y |
| Depth slots | 3 (back / mid / front) |
| Zoom range | 0.1× – 4× |
| Cross-tab conflict resolution | Last-write-wins |
| Realtime subscriptions | None (ADR-0005) |
| Browser targets | WebGL2-capable evergreen browsers; iPadOS 16+ for tablet *(to confirm)* |

---

## 9. Tech stack

| Layer | Choice |
|---|---|
| Build tooling | Vite |
| Framework | React |
| 3D | Three.js via React Three Fiber + drei |
| WebGL text | `troika-three-text` (SDF) |
| Animation | React Spring + `@react-spring/three` (ADR-0007) |
| State | Zustand |
| Backend | Supabase (Postgres + Auth). Realtime intentionally not used. |
| Routing | React Router, one URL per Canvas *(tactical — to confirm)* |
| Language | TypeScript *(recommended — to confirm)* |
| Styling | Tailwind *(recommended — to confirm)* |
| Tests | Vitest *(natural with Vite — to confirm)* |
| Deployment | Vercel / Netlify / Cloudflare *(to confirm)* |

---

## 10. Data model (sketch)

```sql
-- All tables have RLS: auth.uid() = owner_id

create table canvases (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references auth.users(id),
  name            text not null default 'Untitled',
  camera_x        real not null default 0,
  camera_y        real not null default 0,
  camera_z        real not null default 0,
  camera_zoom     real not null default 1,
  camera_focused_depth text not null default 'mid',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table notes (
  id              uuid primary key default gen_random_uuid(),
  canvas_id       uuid not null references canvases(id) on delete cascade,
  owner_id        uuid not null references auth.users(id),
  x               real not null,
  y               real not null,
  depth           text not null default 'mid' check (depth in ('back','mid','front')),
  width           real not null,
  height          real not null,
  body            text not null default '',
  color_id        text not null default 'warm-white',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index notes_canvas_id_idx on notes(canvas_id);
```

`color_id` references the in-code Palette constant. No FK; the Palette lives in code, not in the database.

---

## 11. Open tactical items

Deferred during the architectural grilling. To resolve at implementation time:

1. **URL routing model.** Confirm React Router and the `/canvas/:id` pattern.
2. **Empty-Canvas hint.** What (if anything) appears on a freshly-created blank Canvas to teach the double-click-to-create gesture.
3. **Font handling on Notes.** Text wraps at fixed size and the Note grows, or text scales with the Note. Recommendation pending: fixed size + wrap.
4. **Browser support floor.** Exact minimum versions for desktop and iPadOS.
5. **TypeScript.** Recommended yes.
6. **CSS approach.** Tailwind, CSS Modules, or vanilla. Recommendation pending: Tailwind for the small DOM chrome.
7. **Test framework.** Vitest is the natural fit with Vite.
8. **Deployment target.** Vercel / Netlify / Cloudflare / Supabase Hosting.
9. **Soft-keyboard quirks on iPadOS** beyond what `<textarea>` provides — covered well enough by ADR-0002 in principle, but needs device testing.
10. **Telemetry / error tracking.** Sentry or equivalent. Out of brief but a v1 implementation will want it.

---

## 12. Risks

| Risk | Mitigation |
|---|---|
| WebGL text quality at small zoom levels | `troika-three-text` is SDF-based and stays sharp at small sizes; verify on Retina iPad. |
| Soft keyboard on iPadOS not showing because Note isn't a focusable DOM element | ADR-0002 — invisible `<textarea>` is the focusable surface. |
| IME composition events lost in WebGL input | Same — IME events fire on the `<textarea>`, then stream into the WebGL mesh. |
| Cross-tab data clobbering | Acceptable for solo v1. Last-write-wins. Add Realtime later if needed. |
| ~100 Notes ceiling hit by an ambitious User | Multi-Canvas (Q1) is the escape valve. If real users hit this, ADR-0006 lays out the path to (b) culling. |
| Free-3D-placement creep | ADR-0004 explicitly forbids it. Depth is an enum, not a continuous z. |
| Custom-colour creep | Palette is in code, `color_id` is enum — schema makes the constraint physical. |

---

*This PRD is a snapshot of the architectural grilling session. The glossary in `CONTEXT.md` and the ADRs in `docs/adr/` are the authoritative sources for individual decisions and may be updated independently.*
