# Mouse-Look Camera + Click-to-Focus

The v2 Camera sits at a fixed position inside the Room — roughly room centre, about 1.6 m above the floor — and rotates on yaw + pitch via mouse click-drag. There is no Camera translation outside of focus transitions: the user stays put and looks around. Pitch is clamped to ±80° to prevent gimbal flips and ceiling-staring. Yaw and pitch are persisted per Room (debounced autosave per ADR-0005), so reopening a Room restores the last view.

A single click on a Note triggers a **focus transition**: the Camera animates along that Note's Surface normal until the Note fills roughly 80 % of the viewport, the rest of the Room receives a depth-of-field blur, and the textarea overlay from ADR-0002 activates for editing in the same gesture. Click outside the Note, press `Escape`, or single-click another Note → animate back to the prior camera orientation (and forward to the new Note if applicable).

We deliberately rejected a fly-through / first-person walking camera. The brief's "immersive 3D room" is achieved by *what the user sees* and the Notes' tactility, not by walking around. Camera translation introduces motion sickness, content-out-of-frame failures, and a much bigger interaction surface (collision, clipping, navmesh). Fixing the Camera position keeps the spatial experience cinematic and the interaction model small.

The single-click-to-focus gesture replaces v1's two-step `click-to-select` + `double-click-to-edit`. Multi-select goes away in v2 (see ADR-0010); the focused Note is the only selection-equivalent. Per-selection toolbars from v1 collapse into a small toolbar shown only inside Focus mode.

ADR-0002 (invisible textarea for editing) is **not** superseded. The same textarea pattern is reused inside Focus mode, just over a much larger projected rectangle — IME, clipboard, spellcheck, and iPadOS soft-keyboard behaviour all carry over for free.
