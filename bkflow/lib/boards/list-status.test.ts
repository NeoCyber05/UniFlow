import assert from "node:assert/strict";
import { test } from "node:test";

import { getListStatus } from "./list-status";

test("getListStatus maps common column titles", () => {
  assert.equal(getListStatus("Cần làm"), "todo");
  assert.equal(getListStatus("Đang làm"), "doing");
  assert.equal(getListStatus("Chờ duyệt"), "review");
  assert.equal(getListStatus("Bị chặn"), "blocked");
  assert.equal(getListStatus("Xong"), "done");
  assert.equal(getListStatus("In progress"), "doing");
  assert.equal(getListStatus("Tài liệu"), "other");
});
