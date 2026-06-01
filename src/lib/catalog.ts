/**
 * The in-code customization Catalog (ADR-0022). A Room persists references
 * (Catalog Item ids) into this Catalog — never raw values — so the Catalog can
 * be retuned or extended globally without a data migration, mirroring the
 * Palette/`color_id` precedent.
 *
 * Items are grouped by `kind`. Each kind ships exactly one free `explorer`
 * default Item, so a null Room reference is equivalent to "the default look"
 * and existing Rooms render unchanged. The remaining Items are premium and
 * gated by entitlement (ADR-0021) rather than hidden.
 */

/** A customizable layer of a Room. */
export type CatalogKind =
  | "furniture"
  | "theme"
  | "lighting"
  | "window_style"
  | "ambience";

/**
 * Membership tier required to apply an Item (ADR-0021). Declared locally to
 * keep this module free of build dependencies on a parallel branch's
 * `entitlements.ts`. Ranked `explorer` < `resident` < `studio`.
 */
export type Tier = "explorer" | "resident" | "studio";

/**
 * A single customization Item. `id` is what a Room stores; `kind` groups Items
 * by layer; `label` is the display name; `required_tier` gates application.
 * `swatch` is an optional display colour for catalog UI previews.
 */
export type CatalogItem = {
  id: string;
  kind: CatalogKind;
  label: string;
  required_tier: Tier;
  /** Optional preview colour (hex) for catalog UI. */
  swatch?: string;
};

/**
 * The minimal structural shape of the entitlements this module reads. Accepted
 * by value (not imported from `entitlements.ts`) so the Catalog stays a pure
 * leaf module. Each flag, when true, unlocks the premium Items it covers.
 */
export type CatalogEntitlements = {
  premiumFurniture?: boolean;
  advancedThemes?: boolean;
  ambiencePresets?: boolean;
  advancedCustomization?: boolean;
};

/** Rank of each Tier for simple ordered comparisons. */
const TIER_RANK: Record<Tier, number> = {
  explorer: 0,
  resident: 1,
  studio: 2,
};

/**
 * The curated Catalog. Each kind leads with its free `explorer` default
 * (id `default-<kind>`), followed by premium Items. Order within a kind is the
 * intended display order.
 */
export const CATALOG: readonly CatalogItem[] = [
  // furniture
  { id: "default-furniture", kind: "furniture", label: "Bare Room", required_tier: "explorer" },
  { id: "cozy-set", kind: "furniture", label: "Cozy Set", required_tier: "resident", swatch: "#c8a27a" },
  { id: "minimal-set", kind: "furniture", label: "Minimal Set", required_tier: "resident", swatch: "#d9d4cc" },
  { id: "studio-set", kind: "furniture", label: "Studio Suite", required_tier: "studio", swatch: "#8a7256" },

  // theme
  { id: "default-theme", kind: "theme", label: "Warm Plaster", required_tier: "explorer", swatch: "#f6efe4" },
  { id: "midnight", kind: "theme", label: "Midnight", required_tier: "resident", swatch: "#1f2433" },
  { id: "sage", kind: "theme", label: "Sage", required_tier: "resident", swatch: "#bde1c9" },
  { id: "noir-studio", kind: "theme", label: "Noir Studio", required_tier: "studio", swatch: "#14110f" },

  // lighting
  { id: "default-lighting", kind: "lighting", label: "Daylight", required_tier: "explorer", swatch: "#fff4d6" },
  { id: "golden-hour", kind: "lighting", label: "Golden Hour", required_tier: "resident", swatch: "#ffd08a" },
  { id: "candlelit", kind: "lighting", label: "Candlelit", required_tier: "resident", swatch: "#ff9d5c" },
  { id: "studio-spot", kind: "lighting", label: "Studio Spot", required_tier: "studio", swatch: "#ffffff" },

  // window_style
  { id: "default-window_style", kind: "window_style", label: "Plain Pane", required_tier: "explorer" },
  { id: "arched", kind: "window_style", label: "Arched", required_tier: "resident" },
  { id: "stained-glass", kind: "window_style", label: "Stained Glass", required_tier: "studio", swatch: "#7ea6c9" },

  // ambience
  { id: "default-ambience", kind: "ambience", label: "Quiet", required_tier: "explorer" },
  { id: "rainy-jazz", kind: "ambience", label: "Rainy Jazz", required_tier: "resident" },
  { id: "forest-dawn", kind: "ambience", label: "Forest Dawn", required_tier: "resident" },
  { id: "deep-focus", kind: "ambience", label: "Deep Focus", required_tier: "studio" },
] as const;

/**
 * All Items of a given kind, in display order.
 *
 * @param kind - The customization layer to list.
 * @returns The Catalog Items for that kind (always at least the default).
 */
export function catalogByKind(kind: CatalogKind): CatalogItem[] {
  return CATALOG.filter((item) => item.kind === kind);
}

/**
 * Look up a single Item by id.
 *
 * @param id - A Catalog Item id (as persisted on a Room).
 * @returns The matching Item, or `undefined` if the id is unknown.
 */
export function catalogItem(id: string): CatalogItem | undefined {
  return CATALOG.find((item) => item.id === id);
}

/**
 * The free `explorer` default Item for a kind — what a null Room reference
 * resolves to, so the Room renders unchanged.
 *
 * @param kind - The customization layer.
 * @returns The `explorer` default Item for that kind.
 * @throws If the Catalog has no default for the kind (a Catalog authoring bug).
 */
export function defaultItemFor(kind: CatalogKind): CatalogItem {
  const fallback = CATALOG.find(
    (item) => item.kind === kind && item.required_tier === "explorer"
  );
  if (!fallback) {
    throw new Error(`Catalog has no explorer default for kind "${kind}"`);
  }
  return fallback;
}

/** Whether a tier is permitted given the entitlement flags. */
function tierUnlocked(tier: Tier, ent: CatalogEntitlements): boolean {
  if (tier === "explorer") return true;
  // `advancedCustomization` is the broad unlock covering all premium tiers.
  return !!ent.advancedCustomization || tierGrantedByFlag(tier, ent);
}

/** Per-kind/tier flag grant, independent of the broad unlock. */
function tierGrantedByFlag(tier: Tier, ent: CatalogEntitlements): boolean {
  const anyPremiumFlag =
    !!ent.premiumFurniture || !!ent.advancedThemes || !!ent.ambiencePresets;
  if (tier === "resident") return anyPremiumFlag;
  // `studio` is the top tier — only the broad `advancedCustomization` unlock
  // grants it (handled by the caller); a single feature flag is not enough.
  return false;
}

/**
 * Whether an Item may be applied given a User's entitlements (ADR-0021).
 * Explorer (free, default) Items are always unlocked. Premium Items unlock
 * when the relevant entitlement permits the Item's tier: any premium feature
 * flag (`premiumFurniture` / `advancedThemes` / `ambiencePresets`) unlocks
 * `resident` Items, while `advancedCustomization` is the broad unlock that
 * permits every tier including `studio`.
 *
 * @param item - The Catalog Item being checked.
 * @param ent - The User's entitlement flags (minimal structural shape).
 * @returns `true` if the Item is permitted, otherwise `false`.
 */
export function isItemUnlocked(
  item: CatalogItem,
  ent: CatalogEntitlements
): boolean {
  // Reference TIER_RANK so the ordered model is explicit and the constant is
  // used: explorer items (rank 0) need no entitlement.
  if (TIER_RANK[item.required_tier] === TIER_RANK.explorer) return true;
  return tierUnlocked(item.required_tier, ent);
}
