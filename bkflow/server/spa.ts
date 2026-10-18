import path from "node:path";
import { serveStatic } from "@hono/node-server/serve-static";
import type { Hono } from "hono";

/** Serve the built SPA. Register after the api routes; unknown /api/* paths stay 404. */
export const mountSpa = (app: Hono, dist: string) => {
  const index = path.posix.join(dist, "index.html");
  app.use("/*", serveStatic({ root: dist }));
  app.get("*", (c, next) => (c.req.path.startsWith("/api/") ? next() : serveStatic({ path: index })(c, next)));
};
