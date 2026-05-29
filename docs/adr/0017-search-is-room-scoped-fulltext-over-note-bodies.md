# Search is current-Room-scoped full-text over Note bodies, reusing Focus to fly

The Search feature was asked for as "search by title, content, tags, or keywords," but a v2 **Note** holds only a single plain-text body (CONTEXT.md) — there is no title field and no Tag concept, and the workspace is exactly one **Room** (ADR-0008). We decided Search is a **chrome overlay that does case-insensitive full-text matching over the current Room's Note bodies**, shows the first body line as the title, surfaces each result's Surface for spatial awareness, and **reuses the existing Focus transition** (`focusNote` / `FocusDriver` + `highlightNote`) to fly to and highlight the chosen Note — rather than introducing titles, tags, cross-Room search, or a second camera system.

## Considered Options

- **Add a title field + a Tag concept to satisfy the request literally** — rejected for this feature: tags are a whole separate capability (schema, tagging UI, a new glossary noun) and a title duplicates the body's first line. Both can be added later additively; neither is needed to make navigation effortless now.
- **Cross-Room search** — rejected: the store holds only the current Room's Notes, "fly to a note on a distant wall" is inherently in-Room, and flying across Rooms would mean a Room switch first. A separate feature if ever wanted.
- **A bespoke search camera path** — rejected: the Focus transition already does the cinematic dolly + depth-of-field + arrival highlight. Search selects a Note and hands off to it; the only enhancement is making that transition *spatially aware* for distant Notes (arc toward the target rather than a straight lerp).

## Consequences

- "Search by tag" is intentionally **not** offered in v2. If tagging is added later, Search extends to it without changing this shape.
- Search is **chrome** (a DOM command-palette overlay), unlike the in-world Notebook (ADR-0016) — the client asked for a clean minimal interface, and it matches the existing RoomPicker / ToolPalette chrome pattern.
- Because Search reuses Focus, any improvement to the fly transition (e.g. the spatial-awareness arc) benefits Note clicks and the Notebook too.
