import * as Sentry from "@sentry/node";
import { Hono } from "hono";
import { compress } from "hono/compress";
import { logger as honoLogger } from "hono/logger";

import { createActionsRoute } from "./actions";
import { actionRegistry } from "./actions-registry.gen";
import { authenticate, runWithAuth } from "./auth";
import { mountRoutes } from "./mount-routes";
import { viewsRoute } from "./views";

export const PUBLIC_API = [/^\/api\/health$/, /^\/api\/webhook$/, /^\/api\/uploadthing(\/.*)?$/, /^\/api\/push\/display$/, /^\/api\/telegram\/webhook$/];

export const createApp = async () => {
  const app = new Hono();
  app.use("*", honoLogger());
  app.onError((err, c) => {
    Sentry.captureException(err);
    console.error(err);
    return c.text("Internal Error", 500);
  });

  app.use("/api/*", async (c, next) => {
    // A malformed token must not 500 public routes such as /api/health.
    const requestAuth = await authenticate(c.req.raw).catch(() => ({ userId: null, user: null }));
    const isPublic = PUBLIC_API.some((re) => re.test(c.req.path));
    if (!requestAuth.userId && !isPublic) return c.text("Unauthorized", 401);
    return runWithAuth(requestAuth, next);
  });

  // Only buffered JSON routes: gzip would hold back chunks of streaming responses (AI chat) until the end.
  app.use("/api/views/*", compress());
  app.use("/api/actions/*", compress());
  app.route("/api/actions", createActionsRoute(actionRegistry));
  app.route("/api/views", viewsRoute);
  await mountRoutes(app);
  return app;
};
