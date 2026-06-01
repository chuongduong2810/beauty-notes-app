// Edge Function: create a Stripe Checkout Session for a paid Plan (ADR-0023).
//
// Authenticated (the caller's Supabase JWT). The client never sees a price or
// sets entitlements — it sends a tier; this function maps it to a price and
// returns the hosted-checkout URL to redirect to. The resulting subscription
// is recorded by `stripe-webhook` (the sole writer of `memberships`).
//
// Deno runtime — deployed via `supabase functions deploy create-checkout-session`.
// Secrets: STRIPE_SECRET_KEY (+ optional STRIPE_PRICE_RESIDENT/STUDIO).

import Stripe from "https://esm.sh/stripe@16.12.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PRICE_BY_TIER, corsHeaders, jsonHeaders, type PaidTier } from "../_shared/plans.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // Authenticate the caller from their JWT (RLS-scoped client).
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: jsonHeaders,
      });
    }

    const { tier, roomId, origin } = (await req.json()) as {
      tier: PaidTier;
      roomId: string;
      origin: string;
    };
    const price = PRICE_BY_TIER[tier];
    if (!price) {
      return new Response(JSON.stringify({ error: `unknown tier: ${tier}` }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    // Return to the same Room the User upgraded from (brief: "Return to Room").
    const returnUrl = `${origin}/room/${roomId}`;
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price, quantity: 1 }],
      success_url: returnUrl,
      cancel_url: returnUrl,
      // The webhook reads these to attribute the subscription to the owner.
      client_reference_id: user.id,
      customer_email: user.email ?? undefined,
      subscription_data: { metadata: { owner_id: user.id } },
    });

    return new Response(JSON.stringify({ url: session.url }), { headers: jsonHeaders });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: jsonHeaders },
    );
  }
});
