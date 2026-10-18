import { test } from "node:test";
import assert from "node:assert/strict";

import { toAppUser } from "./app-user";

test("maps Google-style claims", () => {
  const user = toAppUser({
    sub: "u1",
    email: "a@b.com",
    user_metadata: { full_name: "An Nguyen", avatar_url: "https://x/y.png" },
  });
  assert.equal(user.id, "u1");
  assert.equal(user.fullName, "An Nguyen");
  assert.equal(user.firstName, "An");
  assert.equal(user.lastName, "Nguyen");
  assert.equal(user.imageUrl, "https://x/y.png");
  assert.equal(user.primaryEmailAddress?.emailAddress, "a@b.com");
  assert.equal(user.emailAddresses[0].emailAddress, "a@b.com");
  assert.equal(user.primaryEmailAddressId, user.emailAddresses[0].id);
});

test("email-only account falls back to the email local part", () => {
  const user = toAppUser({ sub: "u2", email: "binh@x.com" });
  assert.equal(user.fullName, "binh");
  assert.equal(user.username, "binh");
  assert.equal(user.imageUrl, "");
});

test("no email and no name", () => {
  const user = toAppUser({ sub: "u3" });
  assert.equal(user.fullName, "");
  assert.equal(user.primaryEmailAddress, null);
  assert.deepEqual(user.emailAddresses, []);
});
