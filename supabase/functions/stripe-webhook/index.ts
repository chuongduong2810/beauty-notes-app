// Edge Function: Stripe webhook — the SOLE writer of `memberships` (ADR-0023).
//
// Verifies the Stripe signature, then upserts the User's Membership row using
// the service role (bypassing the table's select-only RLS). Drives the
// read-only-downgrade behaviour (ADR-0021) off `status`/`current_period_end`,
// never the client.
//
// Deno runtime — deployed via `supabase functions deploy stripe-webhook
// --no-verify-jwt` (Stripe calls it unauthenticated; the signature IS the
// auth). Secrets: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET,
// SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL.

import Stripe from "https://esm.sh/stripe@16.12.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { tierForPrice } from "../_shared/plans.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";
const admin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

// deno-lint-ignore no-explicit-any
async function upsertFromSubscription(ownerId: string, sub: any) {
  const priceId = sub.items?.data?.[0]?.price?.id ?? "";
  await admin.from("memberships").upsert(
    {
      owner_id: ownerId,
      tier: tierForPrice(priceId),
      status: sub.status,
      current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
      stripe_customer_id:
        typeof sub.customer === "string" ? sub.customer : sub.customer?.id,
      stripe_subscription_id: sub.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "owner_id" },
  );
}

Deno.serve(async (req) => {
  const sig = req.headers.get("stripe-signature") ?? "";
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig, webhookSecret);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(`Webhook signature verification failed: ${msg}`, {
      status: 400,
    });
  }

  try {
    if (event.type === "checkout.session.completed") {
      // deno-lint-ignore no-explicit-any
      const session = event.data.object as any;
      const ownerId = session.client_reference_id;
      if (ownerId && session.subscription) {
        const sub = await stripe.subscriptions.retrieve(session.subscription);
        await upsertFromSubscription(ownerId, sub);
      }
    } else if (event.type === "customer.subscription.updated") {
      // deno-lint-ignore no-explicit-any
      const sub = event.data.object as any;
      const ownerId = sub.metadata?.owner_id;
      if (ownerId) await upsertFromSubscription(ownerId, sub);
    } else if (event.type === "customer.subscription.deleted") {
      // deno-lint-ignore no-explicit-any
      const sub = event.data.object as any;
      const ownerId = sub.metadata?.owner_id;
      // Lapse → read-only downgrade (ADR-0021); the row is kept, never deleted.
      if (ownerId) {
        await admin
          .from("memberships")
          .update({ status: "canceled", updated_at: new Date().toISOString() })
          .eq("owner_id", ownerId);
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(`Handler error: ${msg}`, { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
