/**
 * Pure view-model builder for the in-room Customization browser (issue #108,
 * ADR-0022). Mirrors the `notebook-sections` / `room-ledger` precedent: a
 * renderer-free, side-effect-free function so the apply/lock rules are
 * unit-testable without an R3F canvas or the store. The CustomizationPanel
 * feeds the result straight into its grid.
 *
 * For each Catalog `kind` it resolves which Item the Room currently has
 * `applied` (a null reference resolves to the kind's free default, so a bare
 * Room shows its defaults selected) and whether each Item is `locked` for the
 * User's entitlements (ADR-0021). Locked Items are *kept visible with a lock*,
 * never hidden — the panel turns a locked tap into a gentle Membership nudge.
 */

import {
  catalogByKind,
  defaultItemFor,
  isItemUnlocked,
  type CatalogEntitlements,
  type CatalogItem,
  type CatalogKind,
} from "./catalog";

/** The customization layers shown in the browser, in display order. */
export const CUSTOMIZATION_KINDS: readonly CatalogKind[] = [
  "theme",
  "lighting",
  "window_style",
  "ambience",
  "furniture",
] as const;

/** Human-readable group heading for each Catalog kind. */
export const CUSTOMIZATION_KIND_TITLES: Record<CatalogKind, string> = {
  theme: "Theme",
  lighting: "Lighting",
  window_style: "Window",
  ambience: "Ambience",
  furniture: "Furniture",
};

/**
 * The Room fields the browser reads, one Catalog reference per single-layer
 * kind plus the additive furniture set. A subset of {@link Room} so callers
 * (and tests) can pass a partial Room without the camera/timestamp noise.
 */
export type CustomizableRoom = {
  theme_id?: string | null;
  lighting_id?: string | null;
  window_style_id?: string | null;
  ambience_id?: string | null;
  furniture?: string[];
};

/** Maps each single-layer kind to the Room field holding its applied id. */
const FIELD_BY_KIND: Record<
  Exclude<CatalogKind, "furniture">,
  keyof CustomizableRoom
> = {
  theme: "theme_id",
  lighting: "lighting_id",
  window_style: "window_style_id",
  ambience: "ambience_id",
};

/** One Catalog Item as shown in the browser, with its applied/locked state. */
export type CustomizationItemView = {
  item: CatalogItem;
  /** Whether this Item is the one currently applied to the Room. */
  applied: boolean;
  /** Whether the Item is locked for the current entitlements (ADR-0021). */
  locked: boolean;
};

/** One Catalog kind's group: its heading plus its Items in display order. */
export type CustomizationGroup = {
  kind: CatalogKind;
  title: string;
  items: CustomizationItemView[];
};

/**
 * Whether a single-layer Item is the one applied to the Room. A null/absent
 * reference resolves to the kind's free default, so a bare Room shows its
 * default Item selected (matching how the render layer falls back).
 */
function singleLayerApplied(
  item: CatalogItem,
  room: CustomizableRoom,
): boolean {
  const field = FIELD_BY_KIND[item.kind as Exclude<CatalogKind, "furniture">];
  const appliedId = room[field] ?? defaultItemFor(item.kind).id;
  return item.id === appliedId;
}

/**
 * Whether a furniture Item is applied. Furniture is an additive set, so an
 * Item is applied when it's in the set; the free default ("Bare Room")
 * represents the empty set and reads as applied when nothing else is.
 */
function furnitureApplied(item: CatalogItem, room: CustomizableRoom): boolean {
  const set = room.furniture ?? [];
  if (item.id === defaultItemFor("furniture").id) return set.length === 0;
  return set.includes(item.id);
}

/**
 * Build the per-kind Customization browser groups for a Room and a User's
 * entitlements (ADR-0021/0022).
 *
 * @param room - the Room's Customization references (subset of {@link Room}).
 * @param entitlements - the User's entitlement flags (minimal Catalog shape).
 * @returns one group per kind in {@link CUSTOMIZATION_KINDS} order, each Item
 *   tagged with whether it's currently `applied` and whether it's `locked`.
 */
export function buildCustomizationBrowser(
  room: CustomizableRoom,
  entitlements: CatalogEntitlements,
): CustomizationGroup[] {
  return CUSTOMIZATION_KINDS.map((kind) => ({
    kind,
    title: CUSTOMIZATION_KIND_TITLES[kind],
    items: catalogByKind(kind).map((item) => ({
      item,
      applied:
        kind === "furniture"
          ? furnitureApplied(item, room)
          : singleLayerApplied(item, room),
      locked: !isItemUnlocked(item, entitlements),
    })),
  }));
}
