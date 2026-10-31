import type { MessageKey } from "./vi";
import { jaBoard } from "./ja-board";
import { jaCalendar } from "./ja-calendar";
import { jaCard } from "./ja-card";
import { jaCore } from "./ja-core";
import { jaExtra } from "./ja-extra";

// Bộ từ điển tiếng Nhật đầy đủ 100% khớp với MessageKey của tiếng Việt.
export const ja: Record<MessageKey, string> = {
  ...jaCore,
  ...jaExtra,
  ...jaBoard,
  ...jaCalendar,
  ...jaCard,
};
