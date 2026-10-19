export type ListStatus = "todo" | "doing" | "review" | "blocked" | "done" | "other";

const RULES: [ListStatus, RegExp][] = [
  ["done", /xong|hoàn thành|hoàn tất|done|complete/],
  ["blocked", /chặn|kẹt|tạm dừng|hoãn|block|hold/],
  ["review", /duyệt|kiểm tra|review|chờ|qa/],
  ["doing", /đang|progress|doing/],
  ["todo", /cần làm|chưa|todo|to do|backlog|việc mới|ý tưởng/],
];

/** Đoán trạng thái cột từ tên (cột không lưu trạng thái riêng). */
export const getListStatus = (title: string): ListStatus => {
  const normalized = title.toLowerCase();
  return RULES.find(([, pattern]) => pattern.test(normalized))?.[0] ?? "other";
};
