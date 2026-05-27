# Beauty Notes

A spatial sticky-notes application.

In **v1** (shipped) a user works inside a flat-feeling **Canvas** containing draggable **Notes**, with zoom, pan, and depth-based motion.

In **v2** (planned) the workspace becomes an immersive **Room**: the user stands inside a bounded 3D environment and Pins Notes to its Surfaces. Mouse-drag rotates the head; a single click on a Note dollies the camera in to focus and edit. The v2 terms below are canonical going forward; v1 terms remain defined for the currently-shipped code that still uses them. (See ADR-0008.)

## Language — v2 (canonical)

**Room**:
A bounded 3D environment owned by one User — 6 m × 6 m × 3 m by default. Contains exactly six Surfaces. A User has many Rooms and switches between them. Replaces v1's Canvas. (See ADR-0008.)
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

**Note** (v2):
A draggable sticky note Pinned to a Surface at `(u, v)`. The atomic unit of content. Holds a single plain-text body. Dimensions in **centimetres** (default 12 cm × 9 cm). Rendered as a high-poly plane mesh in WebGL with a real cloth simulation (ADR-0012). Visual variety comes from the Palette colour, not text styles.
_Avoid_: Card, sticky, item, post-it

**Camera** (v2):
The User's orbit-controlled view anchored to a look-at target near the Room's centre at eye level (`(0, 1.5, 0)`). Verbs: rotate (yaw + pitch via click-drag around the target), zoom (wheel — dolly toward / away from the target), and focus-transition (animate target + camera to a Note, animate back). Polar angle is clamped between the floor and ceiling; zoom is clamped between close inspection and "just inside the Room". Yaw + pitch + distance are persisted per Room. (See ADR-0009.)
_Avoid_: Viewport, view, eye

**Palette**:
The fixed, curated set of ~6 hues a Note's background can be set to. Each entry defines a base hue, a gradient stop, and a shadow tint. The Note schema stores a `color_id` referencing the Palette entry, never a raw hex — so the Palette can be retuned globally without migrating data. There is no custom colour picker: the restriction is the aesthetic.

**User**:
The person who owns Rooms and the Notes inside them. Rooms are private to their owner — no sharing or collaboration in v2. A User exists from the first app load via anonymous auth and can later be promoted to a signed-up account without losing data (see ADR-0003).
_Avoid_: Account, member

## Language — v1 (shipped, deprecated going forward)

**Canvas** *(deprecated, v1-only)*:
The v1 spatial container — a 50 000 × 50 000 unit X/Y volume with three discrete Z depth slots. Superseded by **Room** in v2 (ADR-0008). One-way migration mapping is described in ADR-0011.

**Depth** *(deprecated, v1-only)*:
The v1 enum (`back | mid | front`) that controlled stacking and parallax. v2 has no depth enum — stacking on a Surface is by `created_at`, and parallax emerges from real Camera rotation instead.

**Parallax** *(deprecated, v1-only)*:
The motion effect from differing Depths in v1. In v2, parallax is a natural consequence of mouse-look Camera rotation across a real 3D Room and is not a separate concept.
