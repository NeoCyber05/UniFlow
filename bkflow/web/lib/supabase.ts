import { AuthClient } from "@supabase/auth-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** False when the build lacked the Supabase public env vars (they are inlined by Vite at build time). */
export const supabaseConfigured = Boolean(url && anonKey);

// Placeholder values keep the client from throwing at import, which would blank the whole page.
const base = new URL(`${(url || "http://localhost").trim().replace(/\/$/, "")}/`);
const key = anonKey || "missing-anon-key";

// Only auth is used, so skip createClient: it also bundles postgrest, storage and realtime (~370 KB).
// Options mirror supabase-js createClient; storageKey is its default so sessions saved by it stay signed in.
export const supabase = {
  auth: new AuthClient({
    url: new URL("auth/v1", base).href,
    headers: { Authorization: `Bearer ${key}`, apikey: key },
    storageKey: `sb-${base.hostname.split(".")[0]}-auth-token`,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: "implicit",
  }),
};
