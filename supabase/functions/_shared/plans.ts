// Plan ↔ Stripe price mapping + CORS for the billing Edge Functions
// (ADR-0023). Price ids are NOT secret; the test-mode ids provisioned for
// this project are the defaults, overridable per-environment via the
// STRIPE_PRICE_* function secrets. (The Stripe SECRET key is never here.)
//
// Deno runtime — not part of the Vite app's tsconfig (`include: ["src"]`),
// so the `Deno.*` globals and https: imports never reach the app's tsc.

export type Tier = "explorer" | "resident" | "studio";
export type PaidTier = Exclude<Tier, "explorer">;

const PRICE_RESIDENT =
  Deno.env.get("STRIPE_PRICE_RESIDENT") ?? "price_1TdS9MIZvUxo1AFbOAASHCsf";
const PRICE_STUDIO =
  Deno.env.get("STRIPE_PRICE_STUDIO") ?? "price_1TdS9NIZvUxo1AFbRoD9ibFa";

/** Stripe price id for a paid Plan (used to build a Checkout Session). */
export const PRICE_BY_TIER: Record<PaidTier, string> = {
  resident: PRICE_RESIDENT,
  studio: PRICE_STUDIO,
};

/** Reverse map (used by the webhook to derive the tier from a subscription's
 *  price). Unknown prices fall back to the free baseline. */
export function tierForPrice(priceId: string): Tier {
  if (priceId === PRICE_RESIDENT) return "resident";
  if (priceId === PRICE_STUDIO) return "studio";
  return "explorer";
}

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

export const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };
