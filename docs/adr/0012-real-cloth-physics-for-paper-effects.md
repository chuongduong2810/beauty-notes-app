# Real Cloth Physics for Paper Effects

The brief's "subtle realistic effects — shadows, depth, slight bending, natural movement" are delivered by a **real-time cloth solver** applied to a high-poly Note mesh (~20 × 20 vertices), not by a baked / shader-only approximation. Each Note is a constrained particle grid with stretch, bending, and pin constraints; lift-off on grab, sag under gravity at unsupported corners, and ambient sway emerge from the simulation rather than from authored animation.

We chose this over a cheaper shader-driven pseudo-cloth because the brief's "tactile, cinematic" language is the v2 differentiator. Pseudo-cloth tops out at "paper-ish, especially if you don't look closely"; a properly tuned solver behaves like paper under any camera angle, which matters once the user can rotate the head freely. The Camera in v2 rotates — every Note is seen from many angles, and pre-baked deformation no longer holds up.

We deliberately rejected off-the-shelf flag-cloth solvers as a starting point. Their default tuning models stretchy fabric, not bending-stiff paper, and reaching paper-like behaviour from those defaults is itself the bulk of the work. We will use **XPBD (Extended Position-Based Dynamics)** because (a) it is unconditionally stable under high constraint stiffness — exactly the regime paper lives in — and (b) bending constraints in XPBD are well-understood. Implementation lives on the GPU as a fragment-shader compute step (ping-pong float textures), so cost is roughly flat in Note count.

## Time-box and fallback

This is the highest-risk decision in v2. We hold it to a strict scope:

- **Time-box: 14 days of focused work.** If by day 14 the result is not both (a) visibly better than a static plane and (b) at 60 fps with ≥ 50 visible Notes on a 2021 base iPad, we drop to the **shader pseudo-cloth fallback**: a vertex shader composing static corner curl, ambient sinusoidal sway, pin-aware sag, and a one-shot wave on grab. The fallback ships in roughly 3 days and uses the same Note mesh topology, so swapping the material does not touch the data model or any other v2 decision.
- **Performance budget for the solver:** ≤ 4 ms / frame at the iPad target with 100 Notes visible. Notes outside the camera frustum or beyond ~4 m freeze their simulation. The Focused Note uses higher substep counts.
- **Anti-jiggle:** 4–8 substeps per frame; aggressive velocity damping; solver sleeps when no input arrives for ~500 ms.

## Why this isn't reckless

The fallback exists and is fully designed — switching to it is a one-PR material swap, not a re-architecture. The data model (Note as a Pinned plane) does not depend on which material we ship. If the solver works, v2 looks like the brief; if it doesn't, v2 still ships with paper that *reads* as paper, just less alive.
