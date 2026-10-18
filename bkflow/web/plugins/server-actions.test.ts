import { test } from "node:test";
import assert from "node:assert/strict";

import { actionKeyFromId, stubSource } from "./server-actions";

test("matches only action index imports", () => {
  assert.equal(actionKeyFromId("@/actions/boards/update-board"), "boards/update-board");
  assert.equal(actionKeyFromId("@/actions/boards/update-board/schema"), null);
  assert.equal(actionKeyFromId("@/lib/db"), null);
});

test("stub exports the action name bound to its key", () => {
  assert.equal(
    stubSource("boards/update-board", "updateBoard"),
    'import { callAction } from "@/web/lib/call-action";\nexport const updateBoard = callAction("boards/update-board");\n',
  );
});
