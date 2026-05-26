# Canvas is a 3D Volume with Camera Dolly

A Canvas is a 3D volume (50 000 × 50 000 world units in X/Y, with discrete depth slots in Z), not a flat 2D plane. The Camera has a real `z` translation in addition to pan and zoom — "zooming in" on a Note dollies the Camera forward toward that Note's depth layer rather than only widening FOV.

Notes themselves are still authored in 2D plus a `Depth` enum (`back | mid | front`) — see ADR-0001 and the `Depth` glossary entry. We are *not* adopting free 3D placement; the brutal UX of placing things in z with a 2D pointer remains out of scope.

The reason to do this rather than keep a flat 2D world: the brief's "spatial / parallax / Apple-style motion" goals depend on cinematic camera transitions that pure FOV zoom cannot deliver. Dollying the Camera forward as the user focuses on a Note produces real parallax during the transition itself — the back layer slides past, the front layer expands — which is the differentiating feel the product is paying Three.js for. Without z-translation, the Camera is just a 2D zoom and most of Three.js is decorative.

A future reader seeing camera z-translation might assume free 3D placement was intended and try to add it; the deliberate constraint is that depth-as-an-affordance and camera-z-translation are decoupled.
