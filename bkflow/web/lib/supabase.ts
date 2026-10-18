import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** False when the build lacked the Supabase public env vars (they are inlined by Vite at build time). */
export const supabaseConfigured = Boolean(url && anonKey);

// Placeholder values keep createClient from throwing at import, which would blank the whole page.
export const supabase = createClient(url || "http://localhost", anonKey || "missing-anon-key", {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});
