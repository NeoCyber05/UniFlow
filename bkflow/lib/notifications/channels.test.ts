import { test } from "node:test";
import assert from "node:assert/strict";

import { createTelegramLinkToken, parseWebhookUrl, verifyTelegramLinkToken } from "./channels";

test("webhook URLs are limited to each provider's host over https", () => {
  assert.ok("url" in parseWebhookUrl("slack", "https://hooks.slack.com/services/T/B/x"));
  assert.ok("url" in parseWebhookUrl("discord", "https://discord.com/api/webhooks/1/abc"));
  assert.ok("url" in parseWebhookUrl("teams", "https://prod-1.westus.logic.azure.com/workflows/x"));
  assert.ok("url" in parseWebhookUrl("teams", "https://org.webhook.office.com/webhookb2/x"));

  for (const [channel, url] of [
    ["slack", "http://hooks.slack.com/services/x"],
    ["slack", "https://hooks.slack.com.evil.com/services/x"],
    ["slack", "https://hooks.slack.com/other"],
    ["slack", "https://user:pw@hooks.slack.com/services/x"],
    ["discord", "https://discord.com:8443/api/webhooks/1/a"],
    ["discord", "https://hooks.slack.com/services/x"],
    ["teams", "https://169.254.169.254/latest"],
    ["teams", "not a url"],
  ] as const) {
    assert.ok("error" in parseWebhookUrl(channel, url), `${channel} ${url}`);
  }
});

test("telegram link token round-trips, expires and rejects tampering", () => {
  const userId = "3f2b8c1e-9a4d-4e6f-8b2a-1c3d5e7f9a0b";
  const now = new Date("2026-10-21T00:00:00Z");
  const token = createTelegramLinkToken(userId, "secret", now);

  assert.ok(token.length <= 64 && /^[A-Za-z0-9_-]+$/.test(token));
  assert.equal(verifyTelegramLinkToken(token, "secret", now), userId);
  assert.equal(verifyTelegramLinkToken(token, "other", now), null);
  assert.equal(verifyTelegramLinkToken(token, "secret", new Date(now.getTime() + 16 * 60_000)), null);
  assert.equal(verifyTelegramLinkToken(`${token.slice(0, -1)}${token.endsWith("A") ? "B" : "A"}`, "secret", now), null);
  assert.equal(verifyTelegramLinkToken("short", "secret", now), null);
});
