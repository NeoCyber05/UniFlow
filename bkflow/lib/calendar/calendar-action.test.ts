import assert from "node:assert/strict";
import { test } from "node:test";
import { runCalendarAction } from "./calendar-action";

test("network and validation failures reach the calendar error handler instead of discarding its draft", async () => {
  const network = await runCalendarAction(async () => { throw new Error("offline"); });
  assert.ok(network.error);
  const invalid = await runCalendarAction(async () => ({ fieldErrors: { title: ["Thiếu tiêu đề"] } }));
  assert.equal(invalid.error, "Thiếu tiêu đề");
  assert.deepEqual(invalid.fieldErrors, { title: ["Thiếu tiêu đề"] });
});
