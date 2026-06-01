# Workspace customization is per-Room persisted state over an in-code Catalog (amends ADR-0015)

The subscription brief wants Users to personalize their Room — furniture collections, wall/environment themes, lighting presets, window styles, and ambience. ADR-0015 declared the Window, City, and Weather to be **fixed, non-persisted set-dressing**. Customization directly amends that: some set-dressing now varies per Room and is saved.

## Decision

- **A Catalog of customization Items lives in code** (like the Palette, ADR re: `color_id`), grouped by kind: `furniture`, `theme`, `lighting`, `window_style`, `ambience`. Each Item carries an id, display metadata, and a `required_tier` (ADR-0021). Retuning or adding Items needs **no migration**.
- **A Room persists references into the Catalog**, never raw values: new nullable columns `theme_id`, `lighting_id`, `window_style_id`, `ambience_id`, and a `furniture` set (Item ids). Null ⇒ the default look (so existing Rooms render unchanged).
- **Applying an Item is gated by entitlement**, not hidden: locked Items appear in the Catalog with a lock; selecting one nudges toward Membership rather than blocking. On downgrade the Room keeps its applied premium Items **read-only** (ADR-0021) — the Room still *renders* them; the User just can't change them.
- **Ambience vs Weather:** the fixed rainy **Weather** (ADR-0015) stays the baseline mood; a customizable **Ambience** preset is a distinct, named layer the User can choose. They are different terms.

## Considered Options

- **Keep set-dressing fixed (honor ADR-0015 as-is)** — impossible; customization is the core of the paid experience.
- **Store raw customization values on the Room (colors, intensities, model paths)** — bloats the schema and blocks global retuning. Rejected for Catalog references.
- **Per-Room references into an in-code Catalog (chosen)** — small additive schema, global retune without data migration, mirrors the Palette/`color_id` precedent.

## Consequences

- ADR-0015 is amended: Window style, and the ambience layer over Weather, are now per-Room and persisted; the City remains fixed beyond the Room boundary.
- One migration adds the nullable customization columns; null preserves today's look, so the change is backward-compatible.
- Customization is applied *in the Room* (and via Blueprint Mode for furniture layout), not a settings panel — the rendering components read the Room's Catalog references.
- Because references are ids, a future Catalog retune ships without touching User data.
