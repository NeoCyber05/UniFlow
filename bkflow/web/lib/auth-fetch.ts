import { supabase } from "./supabase";

const isApi = (url: string) => url.startsWith("/api/") || url.startsWith(`${location.origin}/api/`);

/** Adds the Supabase access token to same-origin /api requests. Call once before rendering. */
export const installAuthFetch = () => {
  const original = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (!isApi(url)) return original(input, init);

    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return original(input, init);

    const headers = new Headers(input instanceof Request ? input.headers : undefined);
    new Headers(init?.headers).forEach((value, key) => headers.set(key, value));
    headers.set("Authorization", `Bearer ${token}`);
    return original(input, { ...init, headers });
  };
};
