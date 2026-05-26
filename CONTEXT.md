# Beauty Notes

A spatial sticky-notes application. A user works inside an infinite **Canvas** containing draggable **Notes**, with zoom, pan, and depth-based motion.

## Language

**Canvas**:
A bounded 3D volume owned by one User that holds Notes — 50 000 × 50 000 world units in X/Y, with discrete depth slots in Z (see Depth). A User has many Canvases and switches between them. Zoom is constrained to 0.1×–4×; "infinite" describes the *feel*, not the math.
_Avoid_: Board, space, file, document, world

**Camera**:
The user's view into a Canvas — position `(x, y, z)`, zoom level, and the depth layer it is currently focused on. The Camera can dolly in Z toward a layer (see ADR-0004), not only pan and zoom. Camera state is per-Canvas, persisted via debounced autosave (see ADR-0005), and restored when the Canvas is reopened.
_Avoid_: Viewport, view

**Note**:
A single draggable, resizable sticky note placed at a position inside a Canvas. The atomic unit of content. Rendered as a 3D mesh in WebGL (see ADR-0001). Holds a single plain-text body — no inline formatting, no embedded media. Visual variety comes from per-Note background colour (chosen from the Palette) and size, not from text styles.
_Avoid_: Card, sticky, item, post-it

**Palette**:
The fixed, curated set of ~6 hues a Note's background can be set to. Each entry defines a base hue, a gradient stop, and a shadow tint. The Note schema stores a `color_id` referencing the Palette entry, never a raw hex — so the Palette can be retuned globally without migrating data. There is no custom colour picker: the restriction is the aesthetic.

**User**:
The person who owns Canvases and the Notes inside them. Canvases are private to their owner — no sharing or collaboration in v1. A User exists from the first app load via anonymous auth and can later be promoted to a signed-up account without losing data (see ADR-0003).
_Avoid_: Account, member

**Depth**:
A discrete layer assignment on each Note — `back`, `mid`, or `front` — that controls both stacking order and how the Note responds to camera pan/zoom (deeper layers move more slowly, producing parallax). New Notes default to `mid`. Depth is changed via the per-selection toolbar (primary) or `[` / `]` keys (accelerator).
_Avoid_: Z-index, layer-order, 3D-position

**Parallax**:
The motion effect that emerges from Notes at different Depths moving at different rates relative to the camera. Not a separate feature — a consequence of Depth + camera movement.
