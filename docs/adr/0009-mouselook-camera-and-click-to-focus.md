# Orbit Camera + Click-to-Focus

The v2 Camera is an **orbit camera** anchored to a look-at target near the Room's centre at eye level (`(0, 1.5, 0)`). Mouse drag rotates around the target (yaw + pitch); the mouse wheel zooms (camera dollies toward / away from the target); damping smooths every input. Polar angle is clamped so the camera cannot pass below the floor or above the ceiling. Zoom is clamped to `minDistance ≈ 0.4 m` (close inspection) and `maxDistance ≈ 2.7 m` (just inside the Room without clipping walls). Yaw + pitch + distance are persisted per Room (debounced autosave, ADR-0005), so reopening a Room restores the last view.

A single click on a Note triggers a **focus transition**: the Camera animates the orbit target to the Note's centre and the camera position to a point along the Note's Surface normal at a distance where the Note fills roughly 80 % of the viewport. The rest of the Room receives a depth-of-field blur, and the textarea overlay from ADR-0002 activates for editing in the same gesture. Click outside the Note, press `Escape`, or single-click another Note → animate target + camera back to the prior orbit state (and forward to the new Note if applicable).

We originally specified a fixed-position rotation-only camera here. A follow-up product brief asked explicitly for "freely change the camera angle and perspective" and "rotate and navigate around the space naturally" — a fixed-position camera cannot satisfy that. Orbit controls are the cinematic / smooth / immersive 3D-viewer pattern that the brief language describes.

We rejected **first-person + WASD walking** (`PointerLockControls`). The brief specifies "mouse controls", and WASD adds an input modality plus a navmesh / collision problem we don't want to own in v2. Orbit is mouse-only, framerate-independent, and bounded by simple distance + polar-angle clamps rather than collision.

We rejected an **unconstrained 6-DoF fly camera**. Free-fly cameras cause motion sickness, leave the Room geometry trivially, and require their own re-centering UI.

The orbit target is shared with focus transitions — the same `(target, distance, yaw, pitch)` state animates between an "explore" pose (centred at room middle) and a "focus" pose (centred at a Note). One animation system, one input model.

The single-click-to-focus gesture replaces v1's two-step `click-to-select` + `double-click-to-edit`. Multi-select is removed in v2 (see ADR-0010); the focused Note is the only selection-equivalent. Per-selection toolbars from v1 collapse into a small toolbar shown only inside Focus mode.

ADR-0002 (invisible textarea for editing) is **not** superseded. The same textarea pattern is reused inside Focus mode, just over a much larger projected rectangle — IME, clipboard, spellcheck, and iPadOS soft-keyboard behaviour all carry over for free.
