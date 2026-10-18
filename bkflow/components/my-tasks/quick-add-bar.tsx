"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Loader2, Plus, Star, User, BookOpen } from "lucide-react";
import { toast } from "sonner";

import { quickAddCard } from "@/actions/cards/quick-add-card";
import { MY_TASKS_ROOT_KEY } from "@/lib/my-tasks/types";
import {
  parseQuickAdd,
  type QuickAddCourse,
  type QuickAddMember,
  type QuickAddToken,
} from "@/lib/my-tasks/parse-quick-add";
import { cn } from "@/lib/utils";

const TOKEN_ICONS: Record<QuickAddToken["kind"], React.ComponentType<{ className?: string }>> = {
  course: BookOpen,
  assignee: User,
  important: Star,
  due: CalendarDays,
};

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
};

export const QuickAddBar = ({
  boardId,
  listId,
  courses,
  members,
  defaults,
  placeholder = "Thêm việc…",
  disabled = false,
  disabledHint,
  trailing,
  onCreated,
  compact = false,
}: QuickAddBarProps) => {
  const queryClient = useQueryClient();
  const [value, setValue] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const parsed = useMemo(
    () => parseQuickAdd(value, { courses, members }),
    [value, courses, members],
  );
  const hint = members ? "+tên  ! quan trọng  @mai  @t6  @15/10" : "#môn  ! quan trọng  @mai  @t6  @15/10";

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (disabled || isSubmitting || !parsed.title) return;

    setIsSubmitting(true);

    const result = await quickAddCard({
      title: parsed.title,
      boardId,
      listId,
      courseId: parsed.courseId ?? defaults?.courseId ?? undefined,
      assigneeUserIds: Array.from(new Set([
        ...(defaults?.assigneeUserIds ?? []),
        ...parsed.assigneeUserIds,
      ])),
      dueDate: parsed.dueDate ?? undefined,
      isImportant: parsed.isImportant || Boolean(defaults?.isImportant),
      myDay: Boolean(defaults?.myDay) || (Boolean(defaults?.myDayWhenNoDue) && !parsed.dueDate),
    });

    setIsSubmitting(false);

    const fieldError = result.fieldErrors
      ? Object.values(result.fieldErrors).flat().find(Boolean)
      : undefined;

    if (result.error || fieldError) {
      // Giữ nguyên chữ đã gõ để người dùng sửa
      toast.error(result.error ?? fieldError);
      return;
    }

    setValue("");
    await queryClient.invalidateQueries({ queryKey: MY_TASKS_ROOT_KEY });
    onCreated?.();
  };

  return (
    <div className="space-y-1.5">
      <form
        onSubmit={onSubmit}
        className={cn(
          "flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 shadow-sm focus-within:border-violet-300 focus-within:ring-2 focus-within:ring-violet-100",
          compact ? "py-1.5" : "py-2.5",
          disabled && "opacity-60",
        )}
      >
        {isSubmitting
          ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-violet-500" />
          : <Plus className="h-4 w-4 shrink-0 text-violet-500" />}
        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          aria-label="Thêm việc nhanh"
          className="min-w-0 flex-1 bg-transparent text-sm text-neutral-800 outline-none placeholder:text-neutral-400"
        />
        {trailing}
      </form>
      <div className="flex min-h-5 flex-wrap items-center gap-1.5 px-1 text-[11px] text-neutral-400">
        {disabled && disabledHint ? (
          disabledHint
        ) : parsed.tokens.length > 0 ? (
          parsed.tokens.map((token, index) => {
            const Icon = TOKEN_ICONS[token.kind];

            return (
              <span
                key={`${token.kind}-${index}`}
                className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 font-medium text-violet-700 ring-1 ring-violet-200"
              >
                <Icon className="h-3 w-3" />
                {token.label}
              </span>
            );
          })
        ) : (
          !compact && <span>{hint}</span>
        )}
      </div>
    </div>
  );
};
