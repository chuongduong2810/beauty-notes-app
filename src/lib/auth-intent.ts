/**
 * Persisted "why is this magic-link return happening?" flag (ADR-0019).
 *
 * Claim and Restore both finish by Supabase firing the same
 * `onAuthStateChange` (the link's hash restores a session). The two need
 * opposite handling — Claim pops the ownership certificate; Restore swaps
 * the device into the permanent account and reopens its Room — but the
 * auth event alone can't tell them apart. We record the User's intent in
 * `localStorage` *before* sending the link and read it back on return.
 *
 * Pure + DOM-guarded: every function no-ops (or returns null) when
 * `window` is absent (SSR / unit tests without jsdom), so importing this
 * module never touches a missing global.
 */

/** Which flow requested the magic link currently in flight. */
export type AuthIntent = "claim" | "restore";

/** Single `localStorage` key backing the flag. */
const AUTH_INTENT_KEY = "bn.auth-intent";

/**
 * Record the intent behind the magic link about to be sent (ADR-0019).
 *
 * @param intent - "claim" or "restore"; the flow that initiated the link.
 * @returns nothing. No-op outside the DOM (no `window`).
 */
export function setAuthIntent(intent: AuthIntent): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(AUTH_INTENT_KEY, intent);
}

/**
 * Read the intent recorded for the in-flight magic link (ADR-0019).
 *
 * @returns the stored {@link AuthIntent}, or null when nothing was
 *   recorded, the stored value is unrecognised, or we're outside the DOM.
 */
export function getAuthIntent(): AuthIntent | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(AUTH_INTENT_KEY);
  return raw === "claim" || raw === "restore" ? raw : null;
}

/**
 * Clear the recorded intent once a magic-link return has been handled
 * (ADR-0019), so a later, unrelated auth event isn't misattributed.
 *
 * @returns nothing. No-op outside the DOM (no `window`).
 */
export function clearAuthIntent(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(AUTH_INTENT_KEY);
}
