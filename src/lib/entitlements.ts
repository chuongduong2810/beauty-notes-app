/**
 * Subscription tiers and the entitlements they unlock (issue #102, ADR-0021).
 *
 * This module is the single source of truth for *what each tier unlocks*.
 * It is deliberately pure — no store, Supabase, or component imports — so any
 * layer (gating chokepoints, premium-discovery UI, room creation) can derive
 * capabilities from a tier without owning any client.
 */

/**
 * A subscription tier. A User has at most one active Membership at a tier;
 * absent/expired Memberships fall back to `"explorer"` (the free baseline).
 *
 * - `explorer` — free baseline.
 * - `resident` — plus tier.
 * - `studio`   — premium tier.
 */
export type Tier = "explorer" | "resident" | "studio";

/**
 * The capability set a tier unlocks. Per ADR-0021 entitlements are computed
 * from the tier — never stored per-feature or per-user — so retiering is a
 * single map edit here.
 */
export type Entitlements = {
  /** Maximum number of Rooms the User may create. `Infinity` for Studio. */
  maxRooms: number;
  /** Access to premium furniture collections. */
  premiumFurniture: boolean;
  /** Access to advanced themes. */
  advancedThemes: boolean;
  /** Access to ambience presets. */
  ambiencePresets: boolean;
  /** Access to Camera Viewpoints. */
  cameraViewpoints: boolean;
  /** Access to Photo Mode. */
  photoMode: boolean;
  /** Access to Blueprint Mode (Studio only). */
  blueprintMode: boolean;
  /** Access to advanced customization (Studio only). */
  advancedCustomization: boolean;
};

/**
 * Compute the {@link Entitlements} unlocked by a {@link Tier}. This is the
 * single source of truth for tier → capabilities (ADR-0021).
 *
 * - **Explorer (free):** `maxRooms: 1`, every premium capability off.
 * - **Resident (plus):** Explorer plus premium furniture, advanced themes,
 *   ambience presets, Camera Viewpoints, and Photo Mode (`maxRooms` stays 1).
 * - **Studio (premium):** everything in Resident plus `maxRooms: Infinity`,
 *   Blueprint Mode, and advanced customization.
 *
 * @param tier - the subscription tier to resolve.
 * @returns the full capability set for that tier.
 */
export function entitlementsForTier(tier: Tier): Entitlements {
  const explorer: Entitlements = {
    maxRooms: 1,
    premiumFurniture: false,
    advancedThemes: false,
    ambiencePresets: false,
    cameraViewpoints: false,
    photoMode: false,
    blueprintMode: false,
    advancedCustomization: false,
  };

  if (tier === "explorer") {
    return explorer;
  }

  const resident: Entitlements = {
    ...explorer,
    premiumFurniture: true,
    advancedThemes: true,
    ambiencePresets: true,
    cameraViewpoints: true,
    photoMode: true,
  };

  if (tier === "resident") {
    return resident;
  }

  // Studio: everything in Resident, plus unlimited Rooms and the top-tier
  // capabilities.
  return {
    ...resident,
    maxRooms: Infinity,
    blueprintMode: true,
    advancedCustomization: true,
  };
}

/**
 * A Membership as stored in Supabase (`memberships`), or `null` when the User
 * has none. Only the fields needed to derive the active tier are modelled here;
 * billing ids (Stripe, etc.) are irrelevant to entitlement derivation.
 */
export type Membership = {
  /** The tier this Membership grants while active. */
  tier: Tier;
  /** Billing status, e.g. `"active"`. Anything but `"active"` ⇒ explorer. */
  status: string;
  /** ISO timestamp when the current period ends; past ⇒ expired ⇒ explorer. */
  current_period_end?: string | null;
} | null;

/**
 * Derive the User's effective {@link Tier} from their current Membership.
 *
 * A Membership grants its tier only while it is *active and unexpired*. Every
 * other case — no Membership, `status !== "active"`, or a `current_period_end`
 * in the past — falls back to `"explorer"` (the free baseline, ADR-0021).
 *
 * @param membership - the current Membership, or `null` when the User has none.
 * @param nowMs - the current time in epoch milliseconds, used to test expiry.
 *   Defaults to `Date.now()`; pass an explicit value in tests for determinism.
 * @returns the granted tier when active and unexpired, else `"explorer"`.
 */
export function tierFromMembership(
  membership: Membership,
  nowMs: number = Date.now(),
): Tier {
  if (!membership || membership.status !== "active") {
    return "explorer";
  }

  // A set period end that is at or before now means the Membership has lapsed.
  if (membership.current_period_end != null) {
    const periodEndMs = Date.parse(membership.current_period_end);
    if (!Number.isNaN(periodEndMs) && periodEndMs <= nowMs) {
      return "explorer";
    }
  }

  return membership.tier;
}
