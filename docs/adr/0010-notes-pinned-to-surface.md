# Notes Pinned to a Surface at (u, v)

A Note's position is `(surface_id, u, v)` where `u, v ∈ [0, 1]` are normalized coordinates along the chosen Surface's two axes. A Note is always Pinned to exactly one Surface — never floating, never crossing Surfaces, never holding a free 3D coordinate. Moving a Note means re-Pinning it (possibly to a different Surface). Dimensions are stored in centimetres (default 12 × 9 cm).

We did not reopen the "free 3D placement" door that ADR-0004 deliberately closed. Even inside a 3D Room, placing things in continuous 3D space with a 2D pointer is brutal UX. Constraining a Note to a Surface keeps the placement problem 2D — we just changed *which* 2D plane it is, per Note. Dragging a Note across the Room raycasts against all Surfaces and re-orients the Note to the hit Surface's normal in realtime; release commits the new `(surface_id, u, v)`. If the release ray hits no Surface, the Note springs back to its prior Pin.

Stacking on a Surface is resolved by `created_at` — later Notes render in front. The v1 `depth` enum is retired; three discrete depth slots no longer make sense once parallax emerges from real Camera rotation across six real Surfaces.

Multi-select is removed in v2 (see ADR-0009). Selection collapses into "the currently Focused Note". Bulk operations were never in scope.

The accepted cost: re-Pinning a Note across Surfaces is a richer interaction than v1's straight 2D drag, and the raycast-against-all-Surfaces hover state must read clearly so the user always knows where the Note is about to land.
