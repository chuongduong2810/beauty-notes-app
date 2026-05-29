import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy .env.example to .env.local and fill in.",
  );
}

// Deployment note (ADR-0003, ADR-0018): the Supabase project must have
// BOTH Anonymous sign-ins (for the guest-first bootstrap) and email auth
// (for magic-link Room claims) enabled. `detectSessionInUrl` defaults to
// true, so the magic-link hash returned to /room/<id> is auto-processed.
export const supabase: SupabaseClient = createClient(url, anonKey, {
  auth: { persistSession: true, autoRefreshToken: true },
});
