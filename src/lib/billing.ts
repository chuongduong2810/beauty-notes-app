/**
 * The billing seam (issue #105, ADR-0023). The Membership upgrade flow talks
 * to a {@link BillingProvider} rather than to Stripe directly, so the
 * Membership UI, entitlements, and downgrade are fully testable without a live
 * payment integration. The real Stripe-backed provider (Edge Function +
 * webhook) arrives in #106; until then {@link getBillingProvider} returns the
 * {@link mockBillingProvider} dev stand-in.
 */

import {
  entitlementsForTier,
  tierFromMembership,
  type Tier,
} from "./entitlements";
import { useAppStore } from "../store";
import { supabase } from "./supabase";

/**
 * The seam the Membership UI calls to start an upgrade. `startCheckout` takes a
 * *paid* Plan (Explorer is the free baseline and is never "bought"). It resolves
 * with no value; the side effect differs by provider (ADR-0023): the real Stripe
 * provider opens the in-app Embedded Checkout modal (sets the store's
 * `checkoutClientSecret`); the mock flips membership in place. The caller just
 * awaits to clear its loading state.
 */
export type BillingProvider = {
  /**
   * Begin checkout for a paid Plan.
   *
   * @param tier - the paid Plan to subscribe to (`resident` or `studio`).
   */
  startCheckout(tier: Exclude<Tier, "explorer">): Promise<void>;
};

/**
 * How far ahead the mock sets a subscription's `current_period_end` so the
 * Membership reads as active and unexpired (ADR-0021). Year 3000 — comfortably
 * beyond any test or demo session.
 */
const MOCK_PERIOD_END = "3000-01-01T00:00:00.000Z";

/**
 * A dev stand-in for the real Stripe provider (#106). It simulates a successful
 * subscription **client-side only**: it does NOT write `memberships` (that row
 * is webhook-written and select-only to clients, ADR-0023). Instead it sets the
 * store's `membership` to an active Membership at the chosen Plan and recomputes
 * `entitlements`, then resolves with no redirect — exactly the post-return state
 * the real flow lands in, so the Membership UI and entitlement-driven discovery
 * can be exercised end-to-end without Stripe.
 *
 * Remove (or relegate behind a dev flag) once the real provider ships in #106.
 */
export const mockBillingProvider: BillingProvider = {
  async startCheckout(tier) {
    const membership = {
      tier,
      status: "active",
      current_period_end: MOCK_PERIOD_END,
    };
    useAppStore.setState({
      membership,
      entitlements: entitlementsForTier(tierFromMembership(membership)),
    });
  },
};

/**
 * The real Stripe-backed provider (#106, ADR-0023). Calls the
 * `create-checkout-session` Edge Function (which holds the Stripe secret and
 * maps the tier to a price) and resolves with the hosted-checkout URL the
 * client redirects to. The resulting subscription is recorded by the
 * `stripe-webhook` function — the client never writes entitlements.
 */
export const stripeBillingProvider: BillingProvider = {
  async startCheckout(tier) {
    const { data, error } = await supabase.functions.invoke(
      "create-checkout-session",
      { body: { tier } },
    );
    if (error) throw error;
    const clientSecret = (data as { clientSecret?: string } | null)
      ?.clientSecret;
    if (!clientSecret) {
      throw new Error("create-checkout-session returned no client secret");
    }
    // Open the in-app Embedded Checkout modal — App renders it from the store.
    useAppStore.setState({ checkoutClientSecret: clientSecret });
  },
};

/**
 * Resolve the active {@link BillingProvider}. Uses the real Stripe provider
 * when `VITE_STRIPE_ENABLED === "true"` (i.e. the Edge Functions are deployed
 * and Stripe is configured — see supabase/functions/README.md); otherwise the
 * {@link mockBillingProvider} dev stand-in, so the flow stays usable and
 * testable without a live Stripe.
 */
export function getBillingProvider(): BillingProvider {
  return import.meta.env.VITE_STRIPE_ENABLED === "true"
    ? stripeBillingProvider
    : mockBillingProvider;
}
