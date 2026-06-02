# Spatial Creative Workspace

A spatial sticky-notes application. The workspace is an immersive **Room**: the user stands inside a bounded 3D environment and Pins **Notes** to its **Surfaces**. Mouse drag orbits the camera around eye level; the wheel zooms; a single click on a Note dollies in to focus and edit.

The pre-release v1 (a flat "Canvas" plane with depth slots) was abandoned before public release in favour of v2 — see ADR-0008 and ADR-0011. All glossary terms below are v2.

## Language

**Room**:
A bounded 3D environment owned by one User — 6 m × 6 m × 3 m by default. Contains exactly six Surfaces. A User has many Rooms and switches between them. (See ADR-0008.)
_Avoid_: World, scene, level, environment

**Surface**:
One of the six finite 2D planes that make up the interior of a Room — `wall_north`, `wall_south`, `wall_east`, `wall_west`, `floor`, `ceiling`. Holds zero or more Notes, each Pinned at a normalized `(u, v) ∈ [0, 1]²`. Surfaces are seeded automatically on Room creation; users do not add or remove them in v2.
_Avoid_: Wall (only one of six kinds), face, panel

**Pin**:
The verb for attaching or moving a Note onto a Surface. A Note is always Pinned to exactly one Surface — never floating, never crossing Surfaces. Moving a Note means re-Pinning it (possibly to a different Surface). (See ADR-0010.)
_Avoid_: Place, stick, attach (when ambiguous)

**Focus**:
The state in which one Note fills most of the viewport and is editable. The Camera animates along the Note's Surface normal to frame it; the room behind receives a depth-of-field blur. Entered with a single click on a Note; exited with click-outside or `Escape`. (See ADR-0009.)
_Avoid_: Zoom, edit-mode (Focus encompasses both)

**Note**:
A draggable sticky note Pinned to a Surface at `(u, v)`. The atomic unit of content. Holds a single plain-text body. Dimensions in **centimetres** (default 12 cm × 9 cm). Rendered as a high-poly plane mesh in WebGL with a real cloth simulation (ADR-0012). Visual variety comes from the Palette colour, not text styles.
_Avoid_: Card, sticky, item, post-it

**Bookmark**:
A User-set "keep this handy" flag on a Note. Bookmarking does not move or re-Pin the Note — it stays exactly where it is on its Surface; it simply marks the Note so the Notebook can surface it in its Bookmarked section. Persisted as a boolean on the Note. Distinct from **Pin**, which is the (mandatory, every-Note) verb for attaching a Note to a Surface — a Note is always Pinned but only sometimes Bookmarked.
_Avoid_: Pin (the Surface-attach verb), favourite, star, flag, save

**Camera**:
The User's orbit-controlled view anchored to a look-at target near the Room's centre at eye level (`(0, 1.5, 0)`). Verbs: rotate (yaw + pitch via click-drag around the target), zoom (wheel — dolly toward / away from the target), and focus-transition (animate target + camera to a Note, animate back). Polar angle is clamped between the floor and ceiling; zoom is clamped between close inspection and "just inside the Room". Yaw + pitch + distance are persisted per Room. (See ADR-0009.)
_Avoid_: Viewport, view, eye

**Palette**:
The fixed, curated set of ~6 hues a Note's background can be set to. Each entry defines a base hue, a gradient stop, and a shadow tint. The Note schema stores a `color_id` referencing the Palette entry, never a raw hex — so the Palette can be retuned globally without migrating data. There is no custom colour picker: the restriction is the aesthetic.

**User**:
The person who owns Rooms and the Notes inside them. Rooms are private to their owner — no sharing or collaboration in v2. A User exists from the first app load via anonymous auth and can later be promoted to a signed-up account without losing data (see ADR-0003).
_Avoid_: Account, member

**Claim**:
The act of an anonymous User promoting their session to a permanent, email-identified account — framed in the product as taking lasting ownership of the current Room. Claiming does **not** transfer or reassign ownership: the current (anonymous) User already owns the Room and all its Notes (ADR-0008). The Supabase auth UUID is preserved through an email magic-link promotion (`updateUser({ email })`), so ownership simply becomes durable and recoverable across devices, with **no data migration**. (Recovering a Claimed Room onto *another* device is **Restore** — a different act with a different mechanism; see below.) Claiming now also sets a **Password** (see below) so the Room can later be Restored instantly without an email. Initiated from the Notebook's ownership page; there is no login screen. (See ADR-0020, ADR-0018, ADR-0003.)
_Avoid_: Sign in, log in, register, sign up, create account, migrate, transfer

**Restore**:
The act of bringing a previously **Claimed** account's Rooms back onto a *new* device (or a browser whose guest session was cleared). Where **Claim** promotes the *current* anonymous User in place — same identity, nothing moves — Restore **switches** the device from its throwaway guest identity to the existing permanent account via an email magic link (`signInWithOtp`, not `updateUser`), then reopens a saved Room exactly as it was: its Notes, their layout, the Camera pose, and the Room's name. The City and Weather are fixed set-dressing (ADR-0015), not per-Room state, so there is nothing *environmental* to restore. Because the device leaves its guest identity, the abandoned guest Rooms cannot follow it — so, on the User's explicit consent, they are cleared rather than orphaned. Restore is primarily done by entering the account's email and **Password** (instant, no email); the email magic link remains as a fallback. Framed in the product as *reopening a personal space*, never as logging in; initiated from the Notebook's "Restore My Room" page, with no login screen. (See ADR-0020, ADR-0019, ADR-0018.)
_Avoid_: Sign in, log in, sync, recover account, reclaim, load

**Password**:
A secret the User sets while **Claiming** a Room so they can **Restore** it instantly on another device — typed straight in rather than waiting on an emailed link. It rides *alongside* the email magic link (which stays as the fallback and the recovery path), and never replaces the cozy framing: the User is securing their personal space, not "logging in." A User who Claimed before Passwords existed has none until they set one through the password-recovery flow. The literal word "password" is used in the UI for clarity, but it never appears under a login screen. (See ADR-0020.)
_Avoid_: Login, sign in, credentials, passphrase, secret phrase

**Attachment**:
The visual element that suggests how a Note is held to its Surface — a strip of washi tape across the top edge, a metal push-pin in the upper-left, a decorative sticker corner, or nothing (clean Pin). Each Note has exactly one Attachment style chosen from a fixed palette. Some styles also drive the Note's cloth-solver pin constraints (e.g. tape = two anchors along the top edge; push-pin = single anchor at top centre; sticker = no anchoring effect, visual only). See ADR-0013.
_Avoid_: Mount, fastener, sticker (one specific style), pin (overloaded with the verb)

**Annotation**:
A freehand drawing made directly on a Surface — strokes, doodles, arrows, highlights. Lives on a Surface like a Note does, but holds vector path data instead of text. An Annotation is open-ended (a list of pressure-weighted Strokes); a Note is a discrete textual unit. The two coexist on the same Surface and never mix into one record. See ADR-0014.
_Avoid_: Drawing (overloaded verb), sketch, scribble, doodle, markup

**Stroke**:
One continuous pen-down → pen-up gesture inside an Annotation. Stored as an ordered list of points in `(u, v)` Surface coordinates, each carrying a normalized pressure and a colour reference into the Palette. The atomic unit of undo / redo inside an Annotation.
_Avoid_: Line, path, segment

**Photo Mode**:
A camera-and-render-tuning mode for cinematic captures: DOM overlays hidden, postprocessing dialled up (heavier bloom, deeper DOF, subtle vignette, warm tint), FOV tightened, and the current frame exported as a high-resolution PNG or JPEG. Entered explicitly from a chrome control; exited explicitly. Distinct from the browser-native screenshot — the term is reserved for our in-app cinematic capture.
_Avoid_: Screenshot, capture, photo, snapshot

**Window**:
Fixed architectural set-dressing on a wall Surface through which the City and Weather are visible. Like the desk and lamp, it is decoration rendered in front of a Surface — *not* itself a Surface, not a seventh member of the six, and not persisted data. The wall Surface beneath stays whole, so Notes and Annotations may still be Pinned over the glass. Its **Window Style** is now a per-Room **Customization** choice (ADR-0022), though the Window's role as set-dressing is unchanged. (See ADR-0015, ADR-0022.)
_Avoid_: Opening, glass, viewport, portal

**City**:
The skyline backdrop seen through a Window. It lives *outside* the Room's boundary and is never part of it — the Room stays bounded (ADR-0008) and the City is what lies beyond. Rendered as primitive building geometry with distance fog for depth, not as content the User can edit. (See ADR-0015.)
_Avoid_: World, environment, skybox, background, scene

**Weather**:
The ambient, always-rainy mood of the City: falling rain outside the Window, rain streaks on the glass, overcast light spilling into the Room, and an optional ambient **soundscape**. Weather is a fixed atmosphere — one mood (calm rain), no forecast, no time-of-day — and is not persisted. Its single User-controllable facet is the soundscape: off by default, the User may switch it on and pick one of a few looping ambient tracks (the on/off state and chosen track are session-only, never stored — ADR-0024). Everything else about Weather is non-configurable. The falling rain is rendered by a particle engine (three.quarks, ADR-0024) confined to a slab beyond the Room boundary so it reads only through the Window. Weather is the baseline beneath the customizable, persisted **Ambience** layer (ADR-0022): Ambience is a premium choice layered on top, Weather is the free default.
_Avoid_: Climate, forecast, conditions

**Notebook**:
A physical organizer resting on the desk — fixed set-dressing like the Window and lamp (ADR-0015), not a Surface and not persisted. Clicking it opens a paper book whose pages are an *index into the Room's existing Notes*: Recently Created, Recently Edited, and Bookmarked. The Notebook holds **no content of its own** — selecting an entry navigates the Camera to that Note's real location on its Surface (a Focus transition) and highlights it. It is a browsing affordance, never a container; the Notes it lists live Pinned to Surfaces exactly as before. Scoped to the current Room. (See ADR-0016.)
_Avoid_: Journal, book, binder, diary, index (the data structure), panel, menu

**Room Ledger**:
A summary page in the Notebook describing the current Room at a glance — its ownership **Status** (Unclaimed while a guest, Owned once Claimed), its Note and Bookmark counts, when it was created, and a few recent Notes. It is a read-only overview derived from existing data (no new schema) and hosts the "Claim This Room" entry point into the claim flow. (See ADR-0016, ADR-0018.)
_Avoid_: Dashboard, stats panel, summary, about page

**Search**:
A chrome utility that finds Notes by the text of their body and flies the Camera to the chosen one. Search is scoped to the **current Room** (the workspace is one Room — ADR-0008) and matches against the Note **body** only; the first non-empty line of the body is shown as the Note's title, since a Note has no separate title field. There are no Tags in v2, so "search by tag" is not offered. Choosing a result runs a Focus transition (the same cinematic fly-and-highlight used by a Note click and the Notebook), never an instant jump, and the result surfaces which Surface the Note is on so the User keeps spatial awareness. (See ADR-0017.)
_Avoid_: Filter, query, find (ambiguous), tag search, lookup

**Membership**:
A User's standing in the subscription, at one of three **Plans**. Framed in the product as *belonging to a growing space*, never as a software licence or account plan. A Membership unlocks premium room experiences; it never gates note-taking, room ownership, the Notebook, or Restore — those are always free. Accessed from inside the Notebook. (See ADR-0021, ADR-0023.)
_Avoid_: Subscription (the billing mechanism), licence, account plan, package

**Plan**:
One of the three tiers of **Membership**: **Explorer** (free), **Resident** (plus), **Studio** (premium). Each Plan grants a fixed set of **Entitlements**. "Tier" is an acceptable synonym in code; "Plan" is the product-facing word.
_Avoid_: Level, package, subscription

**Entitlement**:
A capability a **Plan** grants — e.g. "apply premium furniture", "use Photo Mode", "create more than one Room". Entitlements are derived purely from the current Plan, not stored per User. When a Membership lapses the User drops to Explorer's Entitlements, but **never loses notes, Rooms, or ownership**: premium content they already have stays visible and becomes read-only. (See ADR-0021.)
_Avoid_: Permission, feature flag, unlock, grant

**Customization**:
Personalizing a Room beyond its default look by applying **Catalog** Items — **Furniture**, **Theme**, **Lighting**, **Window Style**, **Ambience**. Customization is done *in the Room* (and via **Blueprint Mode**), never through a settings panel, and is persisted per Room. Locked (premium) Items stay visible with a lock rather than hidden. (See ADR-0022.)
_Avoid_: Settings, preferences, decoration (one kind), skin

**Catalog**:
The in-code, curated set of all customization Items, grouped by kind, each tagged with the **Plan** it requires. Like the Palette, a Room stores Item *ids*, never raw values, so the Catalog can be retuned globally without migrating Room data. (See ADR-0022.)
_Avoid_: Store, shop, inventory, library

**Ambience**:
A customizable ambient-mood preset applied to a Room — a chosen layer over the baseline **Weather**. Distinct from **Weather**, which is the single fixed rainy atmosphere (ADR-0015): Weather is the default mood; Ambience is the User's premium choice on top of it. (See ADR-0022.)
_Avoid_: Weather (the fixed baseline), theme, mood (overloaded), vibe

**Camera Viewpoint**:
A User-saved Camera pose in a Room (yaw, pitch, distance) they can fly back to — a Resident Entitlement. Distinct from **Bookmark**, which flags a *Note*: a Viewpoint saves *where you stand*, a Bookmark marks *a note to keep handy*. They never mix. (See ADR-0021.)
_Avoid_: Bookmark (the Note flag), camera bookmark, snapshot, waypoint

**Blueprint Mode**:
A top-down, orthographic plan view of the Room for arranging **Furniture** and **Customization** — a Studio Entitlement. The opposite of the immersive eye-level **Camera**: a god's-eye layout view, entered and exited explicitly. (See ADR-0021.)
_Avoid_: Map, floor plan (the output), top view, editor
