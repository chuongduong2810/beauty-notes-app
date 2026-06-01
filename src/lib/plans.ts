/**
 * Product-facing descriptions of the three Plans for the Membership page
 * (issue #105). Pure presentation data derived from the entitlements model
 * (ADR-0021) — the perks lines mirror what {@link entitlementsForTier} grants,
 * framed in the brief's cozy "expand your space" language rather than as a
 * feature checklist. Kept here (not inline in the Notebook) so the copy is one
 * place and is unit-testable.
 */

import type { Tier } from "./entitlements";

/** A Plan as shown on the Membership page. */
export type PlanCard = {
  /** The tier this card represents. */
  tier: Tier;
  /** Product-facing Plan name (ADR-0021: Explorer / Resident / Studio). */
  name: string;
  /** Short price label. Explorer is free; paid Plans show a per-month price. */
  price: string;
  /** Perk lines, each tracing to an entitlement the tier unlocks. Rendered as
   *  one quiet · -separated line on the compact card. */
  perks: string[];
};

/**
 * The three Plans in upgrade order (Explorer → Resident → Studio). Perks are
 * derived from the entitlements each tier unlocks (ADR-0021): Resident adds
 * premium furniture, advanced themes, ambience, Camera Viewpoints, and Photo
 * Mode; Studio adds unlimited Rooms, Blueprint Mode, and advanced customization.
 */
export const PLAN_CARDS: readonly PlanCard[] = [
  {
    tier: "explorer",
    name: "Explorer",
    price: "Free",
    perks: [
      "Unlimited notes & sketches",
      "Your room, kept forever",
      "The default cozy look",
      "One room to call home",
    ],
  },
  {
    tier: "resident",
    name: "Resident",
    price: "$4/mo",
    perks: [
      "Premium furniture & themes",
      "Ambience presets",
      "Saved Camera Viewpoints",
      "Photo Mode",
    ],
  },
  {
    tier: "studio",
    name: "Studio",
    price: "$9/mo",
    perks: [
      "Everything in Resident",
      "Unlimited rooms",
      "Blueprint Mode",
      "Advanced customization",
    ],
  },
] as const;
