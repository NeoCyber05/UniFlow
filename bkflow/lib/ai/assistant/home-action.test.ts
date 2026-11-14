import assert from "node:assert/strict";
import { test } from "node:test";

import { homeSourceAction } from "./home-action";

test("homeSourceAction chỉ trả gmail khi server cấu hình, Gmail đã kết nối và inventory sẵn sàng", () => {
  assert.equal(homeSourceAction({ configured: true, gmailConnected: true, inventoryReady: true }), "gmail");
  assert.equal(homeSourceAction({ configured: false, gmailConnected: true, inventoryReady: true }), "capture");
  assert.equal(homeSourceAction({ configured: true, gmailConnected: false, inventoryReady: true }), "capture");
  assert.equal(homeSourceAction({ configured: true, gmailConnected: true, inventoryReady: false }), "capture");
});
