import { AsyncLocalStorage } from "node:async_hooks";
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";

import { toAppUser, type AppUser, type AuthClaims } from "@/lib/auth/app-user";

export type RequestAuth = { userId: string | null; user: AppUser | null };

const SIGNED_OUT: RequestAuth = { userId: null, user: null };
const storage = new AsyncLocalStorage<RequestAuth>();

export const runWithAuth = <T>(value: RequestAuth, fn: () => T) => storage.run(value, fn);

/** Same call shape the code used with Clerk. */
export const auth = async (): Promise<RequestAuth> => storage.getStore() ?? SIGNED_OUT;
export const currentUser = async (): Promise<AppUser | null> => (await auth()).user;

export const createAuthenticator = ({ keys, issuer }: { keys: JWTVerifyGetKey; issuer: string }) =>
  async (request: Request): Promise<RequestAuth> => {
    const header = request.headers.get("authorization");
    const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return SIGNED_OUT;
    try {
      const { payload } = await jwtVerify(token, keys, { issuer, audience: "authenticated" });
      if (!payload.sub) return SIGNED_OUT;
      const user = toAppUser(payload as unknown as AuthClaims);
      return { userId: payload.sub, user };
    } catch {
      return SIGNED_OUT;
    }
  };

let cached: ReturnType<typeof createAuthenticator> | undefined;

/** Verify the Supabase access token of a web Request. */
export const authenticate = (request: Request) => {
  if (!cached) {
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!base) throw new Error("NEXT_PUBLIC_SUPABASE_URL must be set");
    const issuer = `${base.replace(/\/$/, "")}/auth/v1`;
    cached = createAuthenticator({ keys: createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`)), issuer });
  }
  return cached(request);
};
