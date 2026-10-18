import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { parseQuickAdd, toSearchKey } from "./parse-quick-add";

const NOW = new Date("2026-10-06T03:00:00Z"); // Thứ Ba 6/10/2026, 10:00 giờ VN
const endOfVN = (iso: string) => new Date(`${iso}T16:59:59.999Z`); // 23:59:59.999 VN

const COURSES = [
  { id: "c-ctdl", name: "Cấu trúc dữ liệu", code: "IT3011" },
  { id: "c-gt", name: "Giải tích 1", code: "MI1111" },
  { id: "c-gt2", name: "Giải tích 2", code: null },
];

const MEMBERS = [
  { userId: "u-an", userName: "Nguyễn Văn An" },
  { userId: "u-binh", userName: "Trần Bình" },
  { userId: "u-bich", userName: "Lê Bích" },
];

describe("toSearchKey", () => {
  it("bỏ dấu, đ → d, viết thường, bỏ ký tự lạ", () => {
    assert.equal(toSearchKey("Đặng Thị Ánh-Dương"), "dangthianhduong");
  });
});

describe("parseQuickAdd", () => {
  it("chỉ có tiêu đề", () => {
    const result = parseQuickAdd("  Đọc   chương 4 ", { now: NOW });
    assert.equal(result.title, "Đọc chương 4");
    assert.equal(result.courseId, null);
    assert.equal(result.dueDate, null);
    assert.equal(result.isImportant, false);
    assert.deepEqual(result.assigneeUserIds, []);
    assert.deepEqual(result.tokens, []);
  });

  it("! đứng riêng → quan trọng; ! dính chữ giữ nguyên", () => {
    const result = parseQuickAdd("Nộp bài ! gấp!", { now: NOW });
    assert.equal(result.isImportant, true);
    assert.equal(result.title, "Nộp bài gấp!");
    assert.deepEqual(result.tokens, [{ kind: "important", label: "Quan trọng" }]);
  });

  it("#mã môn khớp chính xác, không phân biệt hoa thường", () => {
    const result = parseQuickAdd("Lab 3 #it3011", { courses: COURSES, now: NOW });
    assert.equal(result.courseId, "c-ctdl");
    assert.equal(result.title, "Lab 3");
    assert.deepEqual(result.tokens, [{ kind: "course", label: "IT3011" }]);
  });

  it("#tiền tố tên môn không dấu, khớp duy nhất", () => {
    const result = parseQuickAdd("Ôn tập #cautruc", { courses: COURSES, now: NOW });
    assert.equal(result.courseId, "c-ctdl");
  });

  it("#tên mơ hồ (nhiều môn) → giữ chữ, không gán", () => {
    const result = parseQuickAdd("Ôn #giaitich", { courses: COURSES, now: NOW });
    assert.equal(result.courseId, null);
    assert.equal(result.title, "Ôn #giaitich");
  });

  it("+tên khớp đầu từ trong tên thành viên", () => {
    const result = parseQuickAdd("Vẽ ERD +an +binh", { members: MEMBERS, now: NOW });
    assert.deepEqual(result.assigneeUserIds, ["u-an", "u-binh"]);
    assert.equal(result.title, "Vẽ ERD");
  });

  it("+tên mơ hồ (Bình/Bích) → giữ chữ", () => {
    const result = parseQuickAdd("Họp +bi", { members: MEMBERS, now: NOW });
    assert.deepEqual(result.assigneeUserIds, []);
    assert.equal(result.title, "Họp +bi");
  });

  it("+tên lặp lại chỉ gán một lần", () => {
    const result = parseQuickAdd("A +an +An", { members: MEMBERS, now: NOW });
    assert.deepEqual(result.assigneeUserIds, ["u-an"]);
    assert.equal(result.tokens.filter((token) => token.kind === "assignee").length, 1);
  });

  it("@nay / @mai", () => {
    assert.deepEqual(parseQuickAdd("x @nay", { now: NOW }).dueDate, endOfVN("2026-10-06"));
    assert.deepEqual(parseQuickAdd("x @mai", { now: NOW }).dueDate, endOfVN("2026-10-07"));
  });

  it("@thứ: t6 → thứ Sáu tuần này, t3 (hôm nay) → hôm nay, cn → Chủ nhật, t2 → tuần sau", () => {
    assert.deepEqual(parseQuickAdd("x @t6", { now: NOW }).dueDate, endOfVN("2026-10-09"));
    assert.deepEqual(parseQuickAdd("x @t3", { now: NOW }).dueDate, endOfVN("2026-10-06"));
    assert.deepEqual(parseQuickAdd("x @cn", { now: NOW }).dueDate, endOfVN("2026-10-11"));
    assert.deepEqual(parseQuickAdd("x @T2", { now: NOW }).dueDate, endOfVN("2026-10-12"));
  });

  it("@dd/mm: năm nay; đã qua → năm sau; ngày sai → giữ chữ", () => {
    assert.deepEqual(parseQuickAdd("x @15/10", { now: NOW }).dueDate, endOfVN("2026-10-15"));
    assert.deepEqual(parseQuickAdd("x @1/3", { now: NOW }).dueDate, endOfVN("2027-03-01"));
    assert.deepEqual(parseQuickAdd("x @5/10", { now: NOW }).dueDate, endOfVN("2027-10-05"));

    const invalid = parseQuickAdd("x @31/02", { now: NOW });
    assert.equal(invalid.dueDate, null);
    assert.equal(invalid.title, "x @31/02");
  });

  it("token cùng loại: cái sau thắng, chỉ một chip", () => {
    const result = parseQuickAdd("x @mai @t6", { now: NOW });
    assert.deepEqual(result.dueDate, endOfVN("2026-10-09"));
    assert.deepEqual(result.tokens, [{ kind: "due", label: "9/10" }]);
  });

  it("kết hợp đầy đủ", () => {
    const result = parseQuickAdd("Nộp lab 3 #IT3011 ! @mai", { courses: COURSES, now: NOW });
    assert.equal(result.title, "Nộp lab 3");
    assert.equal(result.courseId, "c-ctdl");
    assert.equal(result.isImportant, true);
    assert.deepEqual(result.dueDate, endOfVN("2026-10-07"));
  });

  it("chỉ có token → tiêu đề rỗng", () => {
    assert.equal(parseQuickAdd("@mai !", { now: NOW }).title, "");
  });
});
