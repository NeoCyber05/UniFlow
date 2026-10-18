import { test } from "node:test";
import assert from "node:assert/strict";
import { SignJWT, exportJWK, generateKeyPair, createLocalJWKSet } from "jose";

import { auth, createAuthenticator, runWithAuth } from "./auth";

const ISSUER = "https://proj.supabase.co/auth/v1";

const setup = async () => {
  const { publicKey, privateKey } = await generateKeyPair("ES256");
  const jwk = { ...(await exportJWK(publicKey)), kid: "k1", alg: "ES256", use: "sig" };
  const authenticate = createAuthenticator({ keys: createLocalJWKSet({ keys: [jwk] }), issuer: ISSUER });
  const sign = (claims: Record<string, unknown>, opts: { iss?: string; exp?: string } = {}) =>
    new SignJWT(claims)
      .setProtectedHeader({ alg: "ES256", kid: "k1" })
      .setIssuer(opts.iss ?? ISSUER)
      .setAudience("authenticated")
      .setExpirationTime(opts.exp ?? "1h")
      .sign(privateKey);
  return { authenticate, sign };
};

const req = (token?: string) =>
  new Request("http://x/api/y", { headers: token ? { authorization: `Bearer ${token}` } : {} });

test("valid token gives userId and user", async () => {
  const { authenticate, sign } = await setup();
  const result = await authenticate(req(await sign({ sub: "u1", email: "a@b.com" })));
  assert.equal(result.userId, "u1");
  assert.equal(result.user?.primaryEmailAddress?.emailAddress, "a@b.com");
});

test("missing, malformed, wrong-issuer and expired tokens are signed out", async () => {
  const { authenticate, sign } = await setup();
  assert.equal((await authenticate(req())).userId, null);
  assert.equal((await authenticate(req("not-a-jwt"))).userId, null);
  assert.equal((await authenticate(req(await sign({ sub: "u1" }, { iss: "https://evil/auth/v1" })))).userId, null);
  assert.equal((await authenticate(req(await sign({ sub: "u1" }, { exp: "-1h" })))).userId, null);
});

test("auth() reads the request-bound value and is signed out outside a request", async () => {
  const bound = await runWithAuth({ userId: "u9", user: null }, () => auth());
  assert.equal(bound.userId, "u9");
  assert.equal((await auth()).userId, null);
});
