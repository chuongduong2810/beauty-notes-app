# Billing Edge Functions (ADR-0023)

Two Deno Edge Functions implement Stripe billing. `create-checkout-session`
turns a chosen Plan into a hosted Checkout URL; `stripe-webhook` is the **sole
writer** of the `memberships` table (via the service role, bypassing the
select-only RLS). The client talks to them through the `stripeBillingProvider`
seam in `src/lib/billing.ts`, selected when `VITE_STRIPE_ENABLED=true`.

## Already provisioned (Stripe **test mode**)

Recurring prices created via the Stripe API for this project:

| Plan     | Price                              | Amount  |
| -------- | ---------------------------------- | ------- |
| Resident | `price_1TdS9MIZvUxo1AFbOAASHCsf`   | $4 / mo |
| Studio   | `price_1TdS9NIZvUxo1AFbRoD9ibFa`   | $9 / mo |

These are the defaults baked into `_shared/plans.ts` (price ids are not
secret). Override per-environment with the `STRIPE_PRICE_*` secrets below.

## Activation (out-of-band — needs the Supabase CLI + Stripe dashboard)

This code is complete but **inactive** until deployed; it cannot be verified by
CI. To go live:

1. **Install + link the Supabase CLI**, then set the function secrets (the
   secret key is gitignored in `.env.local`, never committed):
   ```sh
   supabase secrets set \
     STRIPE_SECRET_KEY=sk_test_... \
     STRIPE_WEBHOOK_SECRET=whsec_... \
     STRIPE_PRICE_RESIDENT=price_1TdS9MIZvUxo1AFbOAASHCsf \
     STRIPE_PRICE_STUDIO=price_1TdS9NIZvUxo1AFbRoD9ibFa
   # SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are injected automatically.
   ```
2. **Deploy** the functions (the webhook is unauthenticated — its Stripe
   signature is the auth):
   ```sh
   supabase functions deploy create-checkout-session
   supabase functions deploy stripe-webhook --no-verify-jwt
   ```
3. **Register the webhook** in the Stripe dashboard (or `stripe listen`)
   pointing at `…/functions/v1/stripe-webhook`, subscribed to
   `checkout.session.completed`, `customer.subscription.updated`,
   `customer.subscription.deleted`. Put its signing secret in
   `STRIPE_WEBHOOK_SECRET` (step 1).
4. **Flip the client on**: set `VITE_STRIPE_ENABLED=true` in `.env.local` and
   rebuild. Until then the app uses the mock checkout, so the flow stays usable.

Local end-to-end test: `supabase functions serve` + `stripe listen --forward-to
localhost:54321/functions/v1/stripe-webhook`.
