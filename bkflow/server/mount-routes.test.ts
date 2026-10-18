import { test } from "node:test";
import assert from "node:assert/strict";

import { toHonoPath } from "./mount-routes";

test("converts route file paths to Hono paths", () => {
  assert.equal(toHonoPath("server/routes/health/route.ts"), "/api/health");
  assert.equal(toHonoPath("server/routes/boards/[boardId]/tasks/route.ts"), "/api/boards/:boardId/tasks");
  assert.equal(toHonoPath("server/routes/uploadthing/route.ts"), "/api/uploadthing");
});

test("normalises Windows separators", () => {
  assert.equal(toHonoPath("server\\routes\\cards\\[cardId]\\route.ts"), "/api/cards/:cardId");
});
