"use client";

import { CaptureComposer } from "@/components/capture/capture-composer";
import type { QuickAddCourse, QuickAddMember } from "@/lib/my-tasks/parse-quick-add";

export type QuickAddDefaults = {
  myDay?: boolean;
  isImportant?: boolean;
  courseId?: string | null;
  assigneeUserIds?: string[];
  /** Không gõ @ngày → ghim Hôm nay (tab Việc cần làm) */
  myDayWhenNoDue?: boolean;
};

type QuickAddBarProps = {
  /** Bỏ trống → bảng kỳ hiện tại (server tự tìm) */
  boardId?: string;
  listId?: string;
  courses?: QuickAddCourse[];
  members?: QuickAddMember[];
  defaults?: QuickAddDefaults;
  placeholder?: string;
  disabled?: boolean;
  /** Hiện thay cho gợi ý cú pháp khi disabled */
  disabledHint?: React.ReactNode;
  /** Slot bên phải ô nhập (vd nút ✨ Smart Capture, chọn bảng) */
  trailing?: React.ReactNode;
  onCreated?: () => void;
  compact?: boolean;
  variant?: "bar" | "card";
  onCancel?: () => void;
};

/** Ô thêm nhanh một việc: cú pháp #môn @ngày !, gợi ý AI và chip sửa được, chỉ lưu khi bấm Thêm/Enter. */
export const QuickAddBar = ({ onCreated, ...props }: QuickAddBarProps) => (
  <CaptureComposer {...props} onCreated={onCreated ? () => onCreated() : undefined} />
);
