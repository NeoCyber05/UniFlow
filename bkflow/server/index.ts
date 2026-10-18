import * as Sentry from "@sentry/node";
import { serve } from "@hono/node-server";

import { createApp } from "./app";
import { mountSpa } from "./spa";

const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;
Sentry.init({
  dsn,
  enabled: Boolean(dsn),
  environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
});

const port = Number(process.env.PORT ?? 4000);

// Fail at boot, not as a silent 401 on every request (see getAuthorizedParties in clerk.ts).
if (process.env.NODE_ENV === "production" && !process.env.APP_ORIGINS?.trim()) {
  throw new Error("APP_ORIGINS must be set in production (comma-separated allowed origins)");
}

// package.json has no "type": "module", so tsx compiles to CJS where top-level await is unavailable.
createApp().then((app) => {
  if (process.env.NODE_ENV === "production") mountSpa(app, "web/dist");
  serve({ fetch: app.fetch, port }, () => console.log(`api listening on :${port}`));
});
