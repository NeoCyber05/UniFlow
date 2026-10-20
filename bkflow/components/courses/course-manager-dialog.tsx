"use client";

import { useState } from "react";
import { tr } from "@/lib/i18n";
import { useRouter } from "@/web/shims/next-navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Check, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { createCourse } from "@/actions/courses/create-course";
import { deleteCourse } from "@/actions/courses/delete-course";
import { reorderCourses } from "@/actions/courses/reorder-courses";
import { updateCourse } from "@/actions/courses/update-course";
import { ConfirmModal } from "@/components/modals/confirm-modal";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAction } from "@/hooks/use-action";
import { boardCoursesQueryKey, useBoardCourses } from "@/hooks/use-board-courses";
import { useBoardFilters } from "@/hooks/use-board-filters";
import type { BoardCourse } from "@/lib/courses/board-courses";
import {
  COURSE_COLOR_KEYS,
  getCourseColor,
  isCourseColorKey,
  pickNextCourseColor,
  type CourseColorKey,
} from "@/lib/courses/course-colors";
import { cn } from "@/lib/utils";

type CourseFormState = {
  name: string;
  code: string;
  credits: string;
  color: CourseColorKey;
};

type CourseManagerDialogProps = {
  boardId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const toCredits = (value: string) => (value.trim() ? Number(value) : null);

export const CourseManagerDialog = ({ boardId, open, onOpenChange }: CourseManagerDialogProps) => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { courses } = useBoardCourses(boardId);
  const toggleCourse = useBoardFilters((state) => state.toggleCourse);
  const selectedCourseIds = useBoardFilters(
    (state) => state.filtersByBoardId[boardId]?.selectedCourseIds,
  );

  // extraUsedColors: màu vừa tạo nhưng `courses` trong closure chưa kịp cập nhật
  const emptyForm = (extraUsedColors: string[] = []): CourseFormState => ({
    name: "",
    code: "",
    credits: "",
    color: pickNextCourseColor([...courses.map((course) => course.color), ...extraUsedColors]),
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CourseFormState>(() => emptyForm());

  const refreshCourses = () =>
    queryClient.invalidateQueries({ queryKey: boardCoursesQueryKey(boardId) });

  const resetForm = (extraUsedColors?: string[]) => {
    setEditingId(null);
    setForm(emptyForm(extraUsedColors));
  };

  const { execute: executeCreate, isLoading: isCreating } = useAction(createCourse, {
    onSuccess: (course) => {
      toast.success(tr("course.added", { name: course.name }));
      void refreshCourses().then(() => resetForm([course.color]));
    },
    onError: (error) => toast.error(error),
  });

  const { execute: executeUpdate, isLoading: isUpdating } = useAction(updateCourse, {
    onSuccess: () => {
      toast.success(tr("course.updated"));
      void refreshCourses().then(() => resetForm());
    },
    onError: (error) => toast.error(error),
  });

  const { execute: executeDelete, isLoading: isDeleting } = useAction(deleteCourse, {
    onSuccess: (course) => {
      toast.success(tr("course.deleted", { name: course.name }));
      if (selectedCourseIds?.includes(course.id)) {
        toggleCourse(boardId, course.id);
      }
      void refreshCourses();
      // Thẻ của môn vừa xóa đã về Cá nhân ở DB → tải lại dữ liệu trang
      router.refresh();
    },
    onError: (error) => toast.error(error),
  });

  const { execute: executeReorder, isLoading: isReordering } = useAction(reorderCourses, {
    onSuccess: () => void refreshCourses(),
    onError: (error) => toast.error(error),
  });

  const isBusy = isCreating || isUpdating || isDeleting || isReordering;

  const startEdit = (course: BoardCourse) => {
    setEditingId(course.id);
    setForm({
      name: course.name,
      code: course.code ?? "",
      credits: course.credits?.toString() ?? "",
      // Màu lạ (ngoài 10 màu) → về violet
      color: isCourseColorKey(course.color) ? course.color : "violet",
    });
  };

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const payload = {
      boardId,
      name: form.name,
      code: form.code.trim() || null,
      credits: toCredits(form.credits),
      color: form.color,
    };

    if (payload.credits !== null && Number.isNaN(payload.credits)) {
      toast.error(tr("course.creditsInvalid"));
      return;
    }

    if (editingId) {
      executeUpdate({ id: editingId, ...payload });
    } else {
      executeCreate(payload);
    }
  };

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;

    if (target < 0 || target >= courses.length) return;

    const next = [...courses];
    [next[index], next[target]] = [next[target], next[index]];
    executeReorder({
      boardId,
      items: next.map((course, order) => ({ id: course.id, order: order + 1 })),
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) resetForm();
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="sm:max-w-lg rounded-xl bg-white p-6 text-neutral-900">
        <DialogHeader>
          <DialogTitle>{tr("course.inSemester")}</DialogTitle>
          <DialogDescription>
            {tr("course.colorHint")}
          </DialogDescription>
        </DialogHeader>

        <ul className="max-h-64 space-y-1 overflow-y-auto">
          {courses.length === 0 && (
            <li className="rounded-lg border border-dashed border-neutral-200 px-3 py-4 text-center text-sm text-neutral-500">
              {tr("course.emptyList")}
            </li>
          )}
          {courses.map((course, index) => (
            <li
              key={course.id}
              className={cn(
                "flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-neutral-50",
                editingId === course.id && "bg-violet-50",
              )}
            >
              <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", getCourseColor(course.color).dot)} />
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{course.name}</span>
              {course.code && <span className="text-xs text-neutral-400">{course.code}</span>}
              {course.credits !== null && (
                <span className="text-xs text-neutral-400">{course.credits} TC</span>
              )}
              <Button type="button" variant="ghost" size="icon-sm" title={tr("course.moveUp")} disabled={isBusy || index === 0} onClick={() => move(index, -1)}>
                <ArrowUp className="h-3.5 w-3.5" />
              </Button>
              <Button type="button" variant="ghost" size="icon-sm" title={tr("course.moveDown")} disabled={isBusy || index === courses.length - 1} onClick={() => move(index, 1)}>
                <ArrowDown className="h-3.5 w-3.5" />
              </Button>
              <Button type="button" variant="ghost" size="icon-sm" title={tr("common.edit")} disabled={isBusy} onClick={() => startEdit(course)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <ConfirmModal
                title={tr("course.deleteTitle", { name: course.name })}
                description={tr("course.deleteDesc")}
                onConfirm={() => executeDelete({ id: course.id, boardId })}
                disabled={isBusy}
              >
                <Button type="button" variant="ghost" size="icon-sm" title={tr("common.delete")} disabled={isBusy} className="hover:bg-rose-50">
                  <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                </Button>
              </ConfirmModal>
            </li>
          ))}
        </ul>

        <form onSubmit={onSubmit} className="space-y-3 rounded-lg border border-neutral-100 bg-neutral-50/70 p-3">
          <p className="text-xs font-semibold text-neutral-600">
            {editingId ? tr("course.editTitle") : tr("course.add")}
          </p>
          <Input
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            placeholder={tr("course.namePlaceholder")}
            disabled={isBusy}
            autoFocus
          />
          <div className="grid grid-cols-2 gap-2">
            <Input
              value={form.code}
              onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))}
              placeholder={tr("course.codePlaceholder")}
              disabled={isBusy}
            />
            <Input
              type="number"
              min={0}
              max={10}
              value={form.credits}
              onChange={(event) => setForm((current) => ({ ...current, credits: event.target.value }))}
              placeholder={tr("course.credits")}
              disabled={isBusy}
            />
          </div>
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={tr("course.color")}>
            {COURSE_COLOR_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={form.color === key}
                aria-label={key}
                onClick={() => setForm((current) => ({ ...current, color: key }))}
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full",
                  getCourseColor(key).dot,
                  form.color === key && "ring-2 ring-offset-2 ring-neutral-400",
                )}
              >
                {form.color === key && <Check className="h-3.5 w-3.5 text-white" />}
              </button>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            {editingId && (
              <Button type="button" variant="ghost" size="sm" onClick={() => resetForm()} disabled={isBusy}>
                {tr("common.cancel")}
              </Button>
            )}
            <Button type="submit" size="sm" disabled={isBusy || !form.name.trim()} className="bg-violet-600 hover:bg-violet-700">
              {editingId ? tr("common.save") : tr("course.add")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
