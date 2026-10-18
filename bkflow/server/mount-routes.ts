import fs from "node:fs";
import { pathToFileURL } from "node:url";
import path from "node:path";
import type { Hono } from "hono";

// shortcut: @types/node is v20 (no globSync typing), runtime is Node 22; drop cast after upgrading @types/node.
const globSync = (fs as unknown as { globSync(pattern: string | string[], opts?: { cwd?: string }): string[] }).globSync;

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;

type RouteModule = Partial<
  Record<(typeof METHODS)[number], (req: Request, ctx: { params: Promise<Record<string, string>> }) => Promise<Response> | Response>
>;

export const toHonoPath = (file: string) =>
  file
    .replace(/\\/g, "/")
    .replace(/^server\/routes\//, "/api/")
    .replace(/\/route\.ts$/, "")
    .replace(/\[(\w+)\]/g, ":$1");

/** Mount every route.ts under server/routes on the Hono app with Next's (req, { params }) signature. */
export const mountRoutes = async (app: Hono, root = process.cwd()) => {
  const files = globSync("server/routes/**/route.ts", { cwd: root }).sort();
  for (const file of files) {
    const mod = (await import(pathToFileURL(path.join(root, file)).href)) as RouteModule;
    const route = toHonoPath(file);
    for (const method of METHODS) {
      const handler = mod[method];
      if (!handler) continue;
      app.on(method, route, (c) => handler(c.req.raw, { params: Promise.resolve(c.req.param()) }));
    }
  }
  return files.length;
};
