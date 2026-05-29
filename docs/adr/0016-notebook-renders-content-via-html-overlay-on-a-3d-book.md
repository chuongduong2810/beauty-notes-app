# The Notebook renders its page content via Html overlays on a 3D book, not pure WebGL

The desk Notebook (CONTEXT.md) needs to show legible, scrollable, *clickable* lists of Notes on its open pages while still reading as a real book in the Room. We decided to render the **book body as primitive 3D geometry with paper-textured pages, but the page *content* (note entries, section tabs) as DOM via drei `<Html transform>`** laid onto the open pages — the same overlay pattern already used by `HoverTooltip` and the focus-mode `NoteEditor`. Open/close and page-turn are animated with react-spring (ADR-0007).

## Considered Options

- **Pure WebGL pages** (troika `<Text>` per entry, raycast hit-tests for clicks) — consistent with ADR-0001, but rich text lists, wrapping, per-row hover/click affordances, and scrolling are expensive to hand-build in WebGL and read poorly at book scale. Rejected for cost/legibility.
- **Pure DOM panel** — trivial to build, but the brief explicitly wants the Notebook to "feel like a natural extension of the room rather than a traditional UI panel." Rejected.
- **Hybrid: 3D book + `<Html transform>` content (chosen)** — the book is in-world geometry that opens and turns pages; the readable/interactive content rides on the pages as DOM. Reuses an established pattern and keeps the lists usable.

## Consequences

- This is a deliberate, second deviation from ADR-0001's "pure WebGL" stance (the first being the `NoteEditor` textarea, ADR-0002). The overlay is content-only; the physical book stays WebGL.
- The Notebook is set-dressing (ADR-0015): hard-coded to the default 6×6×3 m Room's desk and **not persisted**. Its contents are *derived* from the current Room's Notes on open, never stored. Only the per-Note `bookmarked` flag is persisted (on the Note, not the Notebook).
- Selecting an entry reuses the existing Focus transition (`focusNote` / `FocusDriver`, ADR-0009) rather than a bespoke camera path.
- Scoped to the current Room — the store only holds the current Room's Notes. Cross-Room browsing is out of scope for this feature.
