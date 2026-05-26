# Anonymous-First Authentication

On first load the app calls `supabase.auth.signInAnonymously()`, granting the User a Supabase session with a UUID before any UI appears. All Canvas and Note rows are owned by `auth.uid()` regardless of whether that UUID belongs to an anonymous or signed-up User. Promotion to a real account uses `supabase.auth.linkIdentity()`, which preserves the UUID — no data migration is needed.

We chose this over a sign-in wall because the product's value depends on a frictionless first moment: a "calm, tactile" spatial experience cannot start behind an email form. We chose it over local-first / IndexedDB because that path adds a sync engine and conflict-resolution UX that the brief explicitly de-prioritises ("not feature quantity, but user experience quality").

Row Level Security is uniform: every Canvas and Note row carries `owner_id`, and the policy is `auth.uid() = owner_id`. The same policy works for anonymous and authenticated Users — no branching.
