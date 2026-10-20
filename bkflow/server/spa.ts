import path from "node:path";
import { serveStatic } from "@hono/node-server/serve-static";
import type { Hono, MiddlewareHandler } from "hono";
import { compress } from "hono/compress";

// Vite content-hashes /assets/* names, so a file there never changes; the rest (index.html, sw.js) must revalidate
// or a deploy leaves browsers on old chunk hashes.
const cacheControl: MiddlewareHandler = async (c, next) => {
  await next();
  if (c.res.ok) c.header("Cache-Control", c.req.path.startsWith("/assets/") ? "public, max-age=31536000, immutable" : "no-cache");
};

/** Serve the built SPA. Register after the api routes; unknown /api/* paths stay 404. */
export const mountSpa = (app: Hono, dist: string) => {
  const index = path.posix.join(dist, "index.html");
  app.use("/*", compress(), cacheControl);
  app.use("/*", serveStatic({ root: dist }));
  app.get("*", (c, next) => (c.req.path.startsWith("/api/") ? next() : serveStatic({ path: index })(c, next)));
};
