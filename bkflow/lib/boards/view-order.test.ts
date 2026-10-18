import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { resolveViewOrder } from "./view-order";

const DEFAULTS = ["todo", "board", "list", "calendar"] as const;

describe("resolveViewOrder", () => {
  it("không có thứ tự đã lưu → mặc định", () => {
    assert.deepEqual(resolveViewOrder(JSON.stringify(DEFAULTS), DEFAULTS, ["todo"]), [...DEFAULTS]);
    assert.deepEqual(resolveViewOrder("not json", DEFAULTS, ["todo"]), [...DEFAULTS]);
    assert.deepEqual(resolveViewOrder("[]", DEFAULTS, ["todo"]), [...DEFAULTS]);
  });

  it("thứ tự cũ thiếu todo → todo lên đầu, id thiếu khác nối cuối", () => {
    assert.deepEqual(
      resolveViewOrder(JSON.stringify(["calendar", "board"]), DEFAULTS, ["todo"]),
      ["todo", "calendar", "board", "list"],
    );
  });

  it("giữ vị trí todo người dùng đã kéo, bỏ id lạ và trùng", () => {
    assert.deepEqual(
      resolveViewOrder(JSON.stringify(["board", "todo", "ghost", "board", "list", "calendar"]), DEFAULTS, ["todo"]),
      ["board", "todo", "list", "calendar"],
    );
  });
});
