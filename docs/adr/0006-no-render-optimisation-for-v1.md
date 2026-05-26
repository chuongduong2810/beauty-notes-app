# No Render Optimisation for v1

The v1 render path is deliberately naive: one R3F mesh per Note, no view-frustum culling, no instanced rendering, no spatial index, no off-screen virtualisation. The supported budget is ~100 Notes per Canvas; beyond that, frame rate is expected to degrade.

We chose this over baseline-culling (~1 000 Notes) or instancing (~10 000 Notes) because the product is a personal solo brainstorming tool, not a knowledge base — real-world Canvas sizes are dozens of Notes, not hundreds, and the multi-Canvas model (Q1) means even ambitious Users split their thinking across Canvases rather than packing one. Instancing in particular fights against the "highly polished animations and transitions" the brief depends on: animating an individual Note's hover, drag, or focus transition is straightforward with one mesh per Note and painful when those meshes are entries in a shared instance buffer.

A future reader looking at the render tree will see no culling and may try to add it. The deliberate constraint is that *performance complexity stays out of the codebase until a real user hits the wall* — at which point the migration to (b) culling is large but bounded, and (c) instancing is a separate decision that should be revisited then.
