/**
 * Password policy helpers for email+password auth (ADR-0020). Pure — no
 * Supabase / renderer access — so the Claim and "set / reset password" UI
 * can validate input client-side before calling Supabase, which enforces
 * the same minimum length server-side.
 */

/**
 * Minimum acceptable password length. Length over complexity: ADR-0020
 * deliberately uses a length floor with no composition rules. Mirrors the
 * Supabase project's minimum-password-length setting.
 */
export const MIN_PASSWORD_LENGTH = 8;

/**
 * Short, human-readable hint describing the password policy, for display
 * next to a password field.
 */
export const PASSWORD_HINT = "At least 8 characters";

/**
 * Validate a candidate password against the policy.
 *
 * @param pw - the raw password string the User typed.
 * @returns true iff `pw` is at least {@link MIN_PASSWORD_LENGTH} characters.
 *   No composition rules are applied (length over complexity, per ADR-0020).
 */
export function isValidPassword(pw: string): boolean {
  return pw.length >= MIN_PASSWORD_LENGTH;
}
