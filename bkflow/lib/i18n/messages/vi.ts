import { viBoard } from "./vi-board";
import { viCalendar } from "./vi-calendar";
import { viCard } from "./vi-card";
import { viCore } from "./vi-core";
import { viExtra } from "./vi-extra";

// Nguồn chuẩn của mọi chuỗi giao diện. Thêm key vào file phân hệ tương ứng trước, rồi dịch sang file ja-*.ts.
export const vi = {
  ...viCore,
  ...viExtra,
  ...viBoard,
  ...viCalendar,
  ...viCard,
} as const;

export type MessageKey = keyof typeof vi;
