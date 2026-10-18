import { AsyncLocalStorage } from "node:async_hooks";
import { createClerkClient } from "@clerk/backend";

export type RequestAuth = {
  userId: string | null;
  orgId: string | null;
  sessionClaims: Record<string, unknown> | null;
};

const SIGNED_OUT: RequestAuth = { userId: null, orgId: null, sessionClaims: null };
const storage = new AsyncLocalStorage<RequestAuth>();

let client: ReturnType<typeof createClerkClient> | undefined;
const getClient = () =>
  (client ??= createClerkClient({
    secretKey: process.env.CLERK_SECRET_KEY,
    publishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  }));

export const runWithAuth = <T>(value: RequestAuth, fn: () => T) => storage.run(value, fn);

/** Same call shape as `auth()` from @clerk/nextjs/server. */
export const auth = async (): Promise<RequestAuth> => storage.getStore() ?? SIGNED_OUT;

/** Same call shape as `clerkClient()` from @clerk/nextjs/server. */
export const clerkClient = async () => getClient();

/** Same call shape as `currentUser()` from @clerk/nextjs/server. */
export const currentUser = async () => {
  const { userId } = await auth();
  return userId ? getClient().users.getUser(userId) : null;
};

const getAuthorizedParties = () => {
  const origins = (process.env.APP_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  // Empty list makes Clerk skip the azp check, so refuse to run that way in production.
  if (origins.length === 0 && process.env.NODE_ENV === "production") {
    throw new Error("APP_ORIGINS must be set in production");
  }
  return origins;
};

/** Verify the Clerk session cookie / bearer token of a web Request. */
export const authenticate = async (request: Request): Promise<RequestAuth> => {
  const state = await getClient().authenticateRequest(request, {
    authorizedParties: getAuthorizedParties(),
  });
  // Handshake/signed-out both mean "no user" for an API call; @clerk/react refreshes __session itself.
  if (!state.isSignedIn) return SIGNED_OUT;
  const a = state.toAuth();
  return { userId: a.userId, orgId: a.orgId ?? null, sessionClaims: a.sessionClaims };
};
