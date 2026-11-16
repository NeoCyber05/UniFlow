import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConnectedApps } from "@/components/settings/connected-apps";
import { CONNECTOR_APPS } from "@/lib/connectors/composio";

test("settings offers all selected apps with local logos and excludes Instagram", () => {
  const client = new QueryClient();
  client.setQueryData(["connectors"], { configured: true, apps: Object.fromEntries(CONNECTOR_APPS.map((app) => [app, false])) });
  client.setQueryData(["connector-catalog"], {
    source: "composio", complete: true,
    items: [...CONNECTOR_APPS, "instagram"].map((slug) => ({ slug, name: slug, description: "", logoUrl: null, taskReadSupported: slug !== "instagram" })),
  });
  try {
    const html = renderToStaticMarkup(createElement(QueryClientProvider, { client }, createElement(MemoryRouter, null, createElement(ConnectedApps))));
    assert.equal((html.match(/>Kết nối<\/button>/g) ?? []).length, 10);
    assert.doesNotMatch(html, /instagram/);
    for (const slug of CONNECTOR_APPS) {
      const src = ["gmail", "slack"].includes(slug) ? `/${slug}.svg` : `/connector-logos/${slug}.svg`;
      assert.ok(html.includes(`src="${src}"`), slug);
      assert.ok(existsSync(path.join(process.cwd(), "public", src)), `${slug} logo exists`);
    }
  } finally { client.clear(); }
});
