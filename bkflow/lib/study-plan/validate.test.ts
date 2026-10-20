import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { ImageTaskItem } from "@/lib/capture/image-import";

import { isStudyPlanRequest, validateReviewItems } from "./validate";

const item = (patch: Partial<ImageTaskItem>): ImageTaskItem => ({
  title: "x", kind: "EVENT", date: null, start: null, end: null, courseCode: null, description: null, ...patch,
});

describe("validateReviewItems", () => {
  const exams = [item({ title: "Thi IT2110", courseCode: "IT2110", date: "2027-01-15", start: "07:00" })];
  const now = new Date("2027-01-10T00:00:00+07:00");
  const review = (patch: Partial<ImageTaskItem>) =>
    item({ title: "Ôn", courseCode: "it2110", date: "2027-01-12", start: "19:00", end: "20:30", ...patch });

  it("giữ buổi hợp lệ, gắn role review, chuẩn hoá mã", () => {
    const [kept] = validateReviewItems([review({})], exams, now);
    assert.equal(kept.role, "review");
    assert.equal(kept.courseCode, "IT2110");
    assert.equal(kept.kind, "EVENT");
  });

  it("bỏ buổi quá khứ, sau giờ thi, mã lạ, thiếu giờ, end <= start", () => {
    assert.deepEqual(validateReviewItems([
      review({ date: "2027-01-09" }),
      review({ date: "2027-01-15", start: "06:30", end: "07:30" }),
      review({ courseCode: "MI1111" }),
      review({ end: null }),
      review({ start: "20:00", end: "19:00" }),
    ], exams, now), []);
  });

  it("thi không có giờ → buổi ôn phải kết thúc trước ngày thi", () => {
    const noTime = [item({ courseCode: "IT2110", date: "2027-01-15" })];
    assert.equal(validateReviewItems([review({ date: "2027-01-15", start: "01:00", end: "02:00" })], noTime, now).length, 0);
    assert.equal(validateReviewItems([review({ date: "2027-01-14" })], noTime, now).length, 1);
  });
});

describe("isStudyPlanRequest", () => {
  it("khớp các cách nói lên lịch ôn", () => {
    for (const text of ["thi IT2110 ngày 15/1, lên lịch ôn", "Ôn thi giúp mình", "lập kế hoạch ôn tập cuối kỳ"]) {
      assert.equal(isStudyPlanRequest(text), true, text);
    }
  });
  it("không khớp việc thường", () => {
    for (const text of ["Nộp báo cáo lab 2 thứ 6", "thi IT2110 ngày 15/1", "họp nhóm tối nay"]) {
      assert.equal(isStudyPlanRequest(text), false, text);
    }
  });
});
