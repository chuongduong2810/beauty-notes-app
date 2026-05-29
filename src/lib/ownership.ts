import type { Session } from "@supabase/supabase-js";
import { roomPath } from "./room-route";

/**
 * Ownership facts derived from the current Supabase Session (issue #70,
 * ADR-0018). Pure — no Supabase / renderer access — so the claim UI
 * (issue #71) can read these without owning the auth client.
 */
export type Ownership = {
  /** True while the User is still anonymous (an unclaimed "guest"). A
   *  null Session is treated as a guest too. */
  isGuest: boolean;
  /** The permanent email once the Room is claimed, else null. */
  email: string | null;
  /** The email's local part (before "@") for a friendly label, else null. */
  displayName: string | null;
};

/**
 * Derive {@link Ownership} from a Supabase Session.
 *
 * @param session - the current Session, or null when not signed in.
 * @returns isGuest (anonymous or no session), the permanent email if any,
 *   and a displayName taken from the email's local part.
 */
export function ownershipFromSession(session: Session | null): Ownership {
  // No session at all is treated as a guest, as is an anonymous User.
  const isGuest = !session ? true : !!session.user?.is_anonymous;
  const email = session?.user?.email ?? null;
  const displayName = email ? email.split("@")[0] : null;
  return { isGuest, email, displayName };
}

/**
 * Build the magic-link return URL for a claim: the same per-Room route
 * the User is already on, so clicking the link lands them back in their
 * Room with the now-permanent session (issue #70).
 *
 * @param roomId - the Room being claimed.
 * @param origin - the page origin, e.g. `window.location.origin`.
 * @returns `${origin}/room/${roomId}`.
 */
export function claimRedirectUrl(roomId: string, origin: string): string {
  return origin + roomPath(roomId);
}
