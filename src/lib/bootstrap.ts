import { supabase } from "./supabase";
import { supabaseCanvasRepository } from "./supabase-canvas-repository";
import { ensureInitialCanvas } from "./ensure-initial-canvas";
import type { CanvasRow, NoteRow } from "./canvas-repository";
import type { Session } from "@supabase/supabase-js";

export type BootstrapResult = {
  session: Session;
  canvas: CanvasRow;
  notes: NoteRow[];
};

/**
 * One-shot session + first-canvas bootstrap.
 *
 * Memoised at module scope so concurrent callers (React 18 StrictMode's
 * double effect, HMR, a stray remount) all await the same promise. The
 * Supabase client is a single global with one session slot — if two
 * `signInAnonymously()` calls run in parallel the second's JWT wins and
 * any in-flight insert from the first user fails RLS with `auth.uid()`
 * pointing at a different user.
 */
let inFlight: Promise<BootstrapResult> | null = null;

export function bootstrapSessionAndCanvas(): Promise<BootstrapResult> {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    const { data: { session: existing } } = await supabase.auth.getSession();
    let session = existing;
    if (!session) {
      const { data, error } = await supabase.auth.signInAnonymously();
      if (error) throw error;
      if (!data.session) throw new Error("signInAnonymously returned no session");
      session = data.session;
    }
    const repo = supabaseCanvasRepository(supabase);
    const { canvas, notes } = await ensureInitialCanvas(repo, session.user.id);
    return { session, canvas, notes };
  })();
  // If the bootstrap rejects, drop the cached promise so a manual retry
  // (or HMR reload) can try again instead of resolving to the same error.
  inFlight.catch(() => {
    inFlight = null;
  });
  return inFlight;
}
