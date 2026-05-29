# Claiming a Room is UUID-preserving email promotion, not a new account + data migration

The auth brief asks for Supabase Magic Link sign-in framed as "claiming ownership of a room," and lists "seamlessly migrate existing anonymous notes to the authenticated account." Building on anonymous-first auth (ADR-0003), we decided **Claim is `supabase.auth.updateUser({ email })` on the existing anonymous User** — a magic-link email verification that **keeps the same auth UUID**. Because every Room/Note already carries that UUID as `owner_id`, claiming makes the account permanent without moving any data: the "migration" requirement is satisfied by *not* migrating. The entire flow lives in the Notebook (ADR-0016); there is no login screen.

## Considered Options

- **`signInWithOtp({ email })` as a fresh magic-link sign-in** — creates a *new* User (new UUID), which would orphan the anonymous User's Rooms/Notes and force a real data-migration step (re-owning every row, with partial-failure and RLS edge cases). Rejected: it manufactures the very migration problem the UUID-preserving path avoids.
- **`updateUser({ email })` on the anonymous User (chosen)** — sends a confirmation magic link; on confirm the same UUID becomes a permanent, email-identified account. Zero migration, and it matches ADR-0003's "promotion preserves the UUID" stance.

## Consequences

- The Room's `owner_id` **never changes** on claim. RLS (`auth.uid() = owner_id`) is untouched — the same policy covers anonymous and claimed Users.
- "User name" is not collected (no name form — the brief forbids traditional forms); the owner is identified by **email** (its local part may be shown as a friendly name).
- The ownership **certificate** is shown transiently on the post-link return (the `USER_UPDATED` / email-confirmed auth event during this session), **not** on every load of an already-claimed User.
- `emailRedirectTo` points at the current `/room/:id`; Supabase `detectSessionInUrl` restores the (now permanent) session on return, and the existing room bootstrap reloads the same Rooms/Notes.
- Deployment requires Supabase **Anonymous sign-ins** enabled and email auth configured; otherwise claim cannot complete.
