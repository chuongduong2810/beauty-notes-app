# Billing via Stripe Checkout with a Supabase Edge Function webhook syncing memberships

The brief's upgrade flow is "Membership → Choose Plan → Checkout → Return to Room", with the Room updating immediately on return. The app is a Vite SPA + Supabase (anon-first auth, ADR-0003); there is no application server. We need a way to take payment and durably record the resulting **Membership** (ADR-0021) without trusting the client.

## Decision

- **Stripe Checkout (hosted)** is the payment surface. The client never sees card data and never sets entitlements.
- **Two Supabase Edge Functions** (Deno) hold the Stripe secret key:
  - `create-checkout-session` — authenticated; creates a Stripe Checkout Session for the chosen Plan's price, with `success_url`/`cancel_url` back at `/room/:id`, and returns the URL the client redirects to.
  - `stripe-webhook` — verifies the Stripe signature and, on `checkout.session.completed` / `customer.subscription.updated|deleted`, upserts the `memberships` row (tier, status, `current_period_end`, Stripe ids) keyed by `owner_id`. **The webhook is the sole writer of Membership state.**
- **`memberships` is read-only to clients** via RLS (`auth.uid() = owner_id` for select; no client insert/update) — only the service-role webhook writes it. The client derives entitlements from the row it can read.
- **On return to the Room**, the client re-fetches its Membership and recomputes entitlements, so newly unlocked customization appears immediately; existing room state is untouched.

## Considered Options

- **Client-side "mark me subscribed"** — trivially forgeable; entitlements must not be client-writable. Rejected.
- **A dedicated backend service** — heavier than this stack needs; Supabase Edge Functions already sit beside the DB with service-role access. Rejected.
- **A third-party merchant-of-record (Paddle/LemonSqueezy)** — simpler tax/webhooks, but the brief and stack point at Stripe; revisit if tax handling becomes the bottleneck.

## Consequences

- **Activation is out-of-band** and cannot be verified by code review or CI: it requires `STRIPE_SECRET_KEY`, the Plan **price ids**, a deployed webhook with its signing secret, and the Stripe dashboard. The codebase ships behind these as env/config; the live flow is enabled by an operator, not by merging.
- Client code talks to a **`BillingProvider` seam**; tests use a mock so the membership UI, entitlements, and downgrade are fully testable without Stripe. The real provider calls the Edge Function.
- A new migration adds `memberships` with select-only RLS. The webhook uses the service role and bypasses RLS by design.
- Subscription lifecycle (renewal, cancellation, lapse) flows through `customer.subscription.*` webhooks → the read-only-downgrade behavior (ADR-0021) is driven by `status`/`current_period_end`, not the client.
