import assert from "node:assert/strict";
import { it } from "node:test";

import { pickCatalogCandidates } from "./catalog-candidates";

it("chỉ trả môn có từ trùng, tối đa 5, mã trùng đứng đầu", () => {
  assert.deepEqual(pickCatalogCandidates("đi chợ mua rau", []), []);

  const triet = pickCatalogCandidates("ôn thi triết mác lênin", []);
  assert.equal(triet[0].id, "catalog:SSH1111");
  assert.ok(triet.length <= 5);

  assert.equal(pickCatalogCandidates("nộp bài IT3011 và giải tích", [])[0].id, "catalog:IT3011");
  // Môn đã có trong bảng không gửi lại
  assert.ok(!pickCatalogCandidates("bài IT3011", [{ code: "IT3011" }]).some((c) => c.code === "IT3011"));
});
