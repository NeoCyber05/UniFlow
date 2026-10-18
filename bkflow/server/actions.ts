import { Hono } from "hono";
import superjson from "superjson";

import { logger } from "@/lib/logger";

type Registry = Record<string, (input: unknown) => Promise<unknown>>;

export const createActionsRoute = (registry: Registry) =>
  new Hono().post("/:domain/:name", async (c) => {
    const key = `${c.req.param("domain")}/${c.req.param("name")}`;
    if (!Object.hasOwn(registry, key)) return c.text("Unknown action", 404);
    const action = registry[key];

    let input: unknown;
    try {
      input = superjson.parse(await c.req.text());
    } catch {
      return c.text("Invalid body", 400);
    }

    try {
      // createSafeAction already validates input with zod and returns { fieldErrors | error | data }.
      const result = await action(input);
      return c.body(superjson.stringify(result), 200, { "content-type": "application/json" });
    } catch (error) {
      logger.error("[ACTION_ERROR]", error, { route: "/api/actions", action: key });
      return c.text("Internal Error", 500);
    }
  });
