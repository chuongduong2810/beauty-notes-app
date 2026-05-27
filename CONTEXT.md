# Beauty Notes

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

**Camera**:
The User's orbit-controlled view anchored to a look-at target near the Room's centre at eye level (`(0, 1.5, 0)`). Verbs: rotate (yaw + pitch via click-drag around the target), zoom (wheel — dolly toward / away from the target), and focus-transition (animate target + camera to a Note, animate back). Polar angle is clamped between the floor and ceiling; zoom is clamped between close inspection and "just inside the Room". Yaw + pitch + distance are persisted per Room. (See ADR-0009.)
_Avoid_: Viewport, view, eye

**Palette**:
The fixed, curated set of ~6 hues a Note's background can be set to. Each entry defines a base hue, a gradient stop, and a shadow tint. The Note schema stores a `color_id` referencing the Palette entry, never a raw hex — so the Palette can be retuned globally without migrating data. There is no custom colour picker: the restriction is the aesthetic.

**User**:
The person who owns Rooms and the Notes inside them. Rooms are private to their owner — no sharing or collaboration in v2. A User exists from the first app load via anonymous auth and can later be promoted to a signed-up account without losing data (see ADR-0003).
_Avoid_: Account, member
