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

/**
 * The seam the Membership UI calls to start an upgrade. `startCheckout` takes a
 * *paid* Plan (Explorer is the free baseline and is never "bought") and, for a
 * real provider, resolves with the hosted-checkout `{ url }` the client
 * redirects to (ADR-0023). The mock resolves with `void` — it has no redirect.
 */
export type BillingProvider = {
  /**
   * Begin checkout for a paid Plan.
   *
   * @param tier - the paid Plan to subscribe to (`resident` or `studio`).
   * @returns `{ url }` to redirect to (real provider), or `void` when the flow
   *   completed in-process (the mock).
   */
  startCheckout(tier: Exclude<Tier, "explorer">): Promise<{ url: string } | void>;
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
 * Resolve the active {@link BillingProvider}. Returns the
 * {@link mockBillingProvider} for now; the real Stripe-backed provider is
 * wired in #106 (it will be selected here behind config/env).
 */
export function getBillingProvider(): BillingProvider {
  return mockBillingProvider;
}
