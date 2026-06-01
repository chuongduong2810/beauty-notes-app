# Subscription tiers, entitlements derived from tier, and read-only downgrade

The product is adding a subscription (`subscriptions.md`) while keeping the core promise: notes, room ownership, the notebook, and restore stay free forever. We need a model for *what each tier unlocks* and *what happens when a subscription lapses*.

## Decision

- **Three Plans / Tiers:** `explorer` (free), `resident` (plus), `studio` (premium). A User has at most one active **Membership** at a tier.
- **Entitlements are a pure function of the tier**, computed in code — not stored per-feature, not per-user flags. One `entitlementsForTier(tier)` mapping is the single source of truth:
  - **Explorer (free):** full note-taking, room ownership, notebook, restore, default customization, **one** Room.
  - **Resident (plus):** premium furniture collections, advanced themes, ambience presets, **Camera Viewpoints**, **Photo Mode**.
  - **Studio (premium):** everything in Resident **plus** multiple Rooms, advanced customization, **Blueprint Mode**, all premium collections.
- **Membership state lives in Supabase** (`memberships`: `owner_id`, `tier`, `status`, `current_period_end`, Stripe ids), synced from billing (ADR-0023). The client derives entitlements from the current Membership; absent/expired ⇒ `explorer`.
- **Downgrade is read-only, never destructive.** When a Membership lapses, premium content the User already has (applied premium customization, extra Rooms beyond the free limit) **remains visible but becomes read-only/locked** until they re-subscribe. Notes, Rooms, and room **ownership are never lost or hidden**. Multi-room: free Users keep every Room they own and may open/edit them, but **cannot create** a new Room beyond the free limit, and Rooms beyond it are read-only.

## Considered Options

- **Per-feature flags stored per user** — flexible but drifts from the source of truth, needs migrations per feature, and complicates downgrade. Rejected for a pure tier→entitlement mapping.
- **Hard-limit free Users to one Room (delete/hide extras)** — cleaner tiers but destroys/removes a capability current free Users have. Rejected: violates the brief's "never lose rooms" and is hostile.
- **Gate new-Room *creation*, grandfather existing, extras read-only (chosen)** — mirrors the brief's downgrade philosophy exactly and loses no data.

## Consequences

- Gating is a single chokepoint: feature code asks `entitlements.canX` rather than checking tiers inline, so retiering is one map edit.
- `createRoom` becomes entitlement-gated (Explorer capped at the free Room count); the RoomPicker shows owned Rooms regardless, marking read-only ones.
- Premium discovery (ADR per brief) shows locked items rather than hiding them — the read-only model makes "visible but locked" the norm everywhere.
- Re-subscribing instantly re-enables editing; nothing is migrated because nothing was removed.
