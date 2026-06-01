# Email + password as a coexisting, password-primary auth path alongside magic link

ADR-0018 made Claim a magic-link `updateUser({ email })` and ADR-0019 made Restore a magic-link `signInWithOtp` — both deliberately password-free, because the brief forbids traditional login forms. The client now wants **email + password** auth for two reasons: Supabase's built-in email service rate-limits magic links (so cross-device Restore can fail to deliver), and they want users to get back in **instantly**, without an inbox round-trip.

We decided to **add email+password as the primary path, coexisting with magic link rather than replacing it** — not to abandon the magic link or the cozy framing. Custom SMTP would have fixed the rate limit alone, but it does not deliver the instant no-email return, which is a genuine product goal here.

## Decision

- **Restore is primarily `signInWithPassword({ email, password })`** — instant, zero email. The magic-link `signInWithOtp` stays as the fallback (for users who have no password yet, and as part of recovery).
- **Claim now also sets a password**: `updateUser({ email, password })` on the anonymous user. The UUID is still preserved (ADR-0018 intact); the password just rides along.
- **"Confirm email" stays ON.** Claim still sends one verification email (rare). A verified email keeps password-reset and the magic-link fallback trustworthy and blocks email-squatting. The instant-login win is realized at Restore (the frequent action), which is password-only.
- **The word "password" is used literally** in the UI (clear, works with password managers, `type=password`, `autocomplete`), but the surrounding framing stays spatial — still "Claim This Room" / "Reopen Your Room", never a "Login" screen. No login vocabulary enters the glossary.
- **One "set / reset password" flow** serves both forgotten passwords and legacy password-less claimed users: `resetPasswordForEmail` → `PASSWORD_RECOVERY` → a set-new-password Notebook page → `updateUser({ password })`.

## Considered Options

- **Custom SMTP only (Resend/SendGrid/SES), keep magic-link-only** — lifts the email rate limit with zero design change. Rejected as the *sole* fix: it doesn't deliver instant, email-free return. (Still worth doing for the remaining transactional emails.)
- **Replace magic link entirely with password** — rejected: orphans existing claimed users who have no password, and password-reset still needs email, so the email path can't be deleted anyway.
- **Email+password coexisting, password-primary (chosen)** — instant return for the common case, magic link as fallback/recovery, nobody stranded, ADR-0018/0019 mechanics preserved.

## Consequences

- **Guest cleanup ordering changes for password-Restore.** Issue #84's consented hard-delete was built around the *async* magic link (delete while still anonymous, before the link swaps the session). `signInWithPassword` swaps the session *synchronously*, so we **verify, then clean via the saved session**: capture the anon session; call `signInWithPassword` to validate (on failure the guest data is intact); on success briefly re-apply the saved anon session, run `deleteRoomsForOwner`, then re-apply the permanent session. No data loss on a wrong password, no orphans.
- **Email is not fully eliminated.** Claim still sends one confirmation email; password reset sends one. Both are rare and low-volume — the rate-limit pain was the *per-Restore* magic link, which password removes.
- **Password policy:** minimum 8 characters, no composition rules (length over complexity); validated client-side and enforced by the Supabase project setting. Enable leaked-password protection if the plan supports it.
- **Deployment (Supabase dashboard, not code):** the email+password provider enabled (default), "Confirm email" left ON, minimum password length set to 8, and a custom SMTP provider configured to lift the email rate limit for the remaining confirmation/reset emails.
- **No glossary login vocabulary.** `Claim`/`Restore` keep their `_Avoid_: sign in, log in` stance; "password" is the only new term.
