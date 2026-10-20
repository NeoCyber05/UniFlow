"use client";

import { useState } from "react";
import { useRouter } from "@/web/shims/next-navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";

import { setCardCourse } from "@/actions/cards/set-card-course";
import { CoursePicker } from "@/components/courses/course-picker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAction } from "@/hooks/use-action";
import { useBoardCalendarInvalidation } from "@/hooks/use-board-calendar-invalidation";
import { boardCoursesQueryKey, useBoardCourses } from "@/hooks/use-board-courses";
import { getCourseColor } from "@/lib/courses/course-colors";
import { cn } from "@/lib/utils";

import { patchBoardCardPreview, patchCardQueryData } from "../card-cache-utils";

type CardCourseSelectProps = {
  cardId: string;
  boardId: string;
  courseId: string | null;
  canEdit: boolean;
};

export const CardCourseSelect = ({ cardId, boardId, courseId, canEdit }: CardCourseSelectProps) => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const invalidateBoardCalendar = useBoardCalendarInvalidation(boardId);
  const { courseOptions, courseById, isSemesterBoard } = useBoardCourses(boardId);
  const [open, setOpen] = useState(false);

  const { execute, isLoading } = useAction(setCardCourse, {
    onSuccess: (card) => {
      // Môn danh mục/tự đặt vừa được tạo: nạp lại để courseById có môn mới
      if (card.courseId && !courseById.has(card.courseId)) void queryClient.invalidateQueries({ queryKey: boardCoursesQueryKey(boardId) });
      patchCardQueryData(queryClient, card.id, { courseId: card.courseId });
      patchBoardCardPreview(boardId, card.id, { courseId: card.courseId });
      invalidateBoardCalendar();
      // Timeline render ở server → làm mới để thanh đổi màu/lọc đúng
      router.refresh();
    },
    onError: (error) => toast.error(error),
  });

  if (!isSemesterBoard) {
    return null;
  }

  const current = courseId ? courseById.get(courseId) ?? null : null;
  const label = current ? current.name : "Cá nhân";

  const trigger = (
    <span className="flex h-8 items-center gap-2 rounded-md border border-neutral-200 bg-white px-3 text-xs font-semibold text-neutral-800">
      <span
        className={cn(
          "h-2.5 w-2.5 rounded-full",
          current ? getCourseColor(current.color).dot : "border border-neutral-400",
        )}
      />
      <span className="max-w-[160px] truncate">{label}</span>
      {canEdit && <ChevronDown className="h-3.5 w-3.5 text-neutral-400" />}
    </span>
  );

  return (
    <div className="flex flex-col gap-y-1.5">
      <span className="text-xs font-semibold text-neutral-600 pl-0.5">Danh mục</span>
      {canEdit ? (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild disabled={isLoading}>
            <button type="button" className="text-left disabled:opacity-60">{trigger}</button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto p-2">
            <CoursePicker
              courses={courseOptions}
              value={courseId}
              noneLabel="Cá nhân"
              onChange={(value) => {
                setOpen(false);
                if (value !== courseId) execute({ id: cardId, boardId, courseId: value });
              }}
            />
          </PopoverContent>
        </Popover>
      ) : (
        trigger
      )}
    </div>
  );
};
