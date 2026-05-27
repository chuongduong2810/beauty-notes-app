# Abandon v1 — Fresh v2 Schema, No Migration

v1 is scrapped before public release. v2 starts from a clean slate: the v1 `canvases` table and the v1 columns on `notes` (`x`, `y`, `depth`, `canvas_id`) are dropped, and the v1 spatial code paths (CanvasFloor, DraggableNote, drag/edit modules) are deleted at the same release. There is no data migration because there are no users with data to preserve.

We considered a forward-only migration that would project every v1 Note onto `wall_north` of a new Room. We rejected it: maintaining migration code for a private, pre-release codebase is dead weight, and the projection (`x / 50 000 → u`) would produce a wall full of noise rather than a useful starting layout for anyone who happened to have v1 data. Cleaner to start from empty.

The shipped v1 infrastructure that is **not** v1-specific carries forward unchanged: anonymous auth (ADR-0003), the repository pattern, debounced autosave (ADR-0005), React Spring (ADR-0007), Vitest + the TDD workflow. ADR-0001 (pure WebGL via R3F) carries forward; ADR-0002 (invisible textarea) carries forward inside Focus mode. ADR-0006 (no render optimisation for v1) is **superseded by ADR-0012** — v2's cloth solver requires deliberate performance work.

The accepted cost: anyone who installed v1 locally and produced Notes loses them. Acceptable because v1 never shipped beyond developer machines.
