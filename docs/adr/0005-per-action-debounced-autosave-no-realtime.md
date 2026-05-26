# Per-Action Debounced Autosave, No Realtime

Persistence is per-action debounced with optimistic UI: position commits at drag-end, size at resize-end, text after a ~500 ms typing pause, depth/colour immediately, and Camera state ~1000 ms after pan/zoom/dolly settles. Cross-tab races are resolved by last-write-wins. Supabase Realtime is deliberately *not* used.

We chose this over Realtime channels (the natural-looking alternative given Supabase is the backend) because the app is solo-only (ADR-0003 + Q2) — there is no second User to sync with, only the same User in two tabs, which is a rare and tolerable edge case. Adding Realtime to gain cross-tab parity would pull a persistent WebSocket connection and a subscription layer into the architecture for negligible product value, and it would invite scope creep toward multiplayer that we have explicitly deferred.

A future reader looking at the Supabase client setup will see no Realtime subscriptions and may attempt to add them; the deliberate constraint is that *persistence is one-way, client-to-server only*, until the product needs collaboration.
