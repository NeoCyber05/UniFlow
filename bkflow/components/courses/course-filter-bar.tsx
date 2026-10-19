"use client";

import { useMemo, useState } from "react";
import { usePathname } from "@/web/shims/next-navigation";
import { AnimatePresence, motion } from "motion/react";
import * as PopoverPrimitive from "@animate-ui/react/primitives/radix-ui/popover";
import {
  blur,
  ReducedMotionConfig,
  scale,
  spring,
  transition,
  useTempoTransition,
} from "@animate-ui/react/utils/motion";
import { Check, ChevronDown, Search, Settings2, X } from "lucide-react";

import { useBoardCourses } from "@/hooks/use-board-courses";
import { useBoardFilters } from "@/hooks/use-board-filters";
import { PERSONAL_COURSE_FILTER } from "@/lib/boards/board-filters";
import { getCourseColor, getCourseShortLabel } from "@/lib/courses/course-colors";
import { cn } from "@/lib/utils";

import { CourseManagerDialog } from "./course-manager-dialog";

// Hằng ngoài component: selector zustand trả về mảng mới mỗi lần sẽ gây render vô hạn
const EMPTY_IDS: string[] = [];
// Số chip hiện trên header; phần còn lại gộp thành "+N"
const MAX_VISIBLE_CHIPS = 2;
// Từ số môn này trở lên mới hiện ô tìm
const SEARCH_THRESHOLD = 6;

type ScopeOption = { id: string; label: string; fullName: string; dotClassName: string };

type CourseFilterBarProps = {
  boardId: string;
  canEdit: boolean;
};

export const CourseFilterBar = ({ boardId, canEdit }: CourseFilterBarProps) => {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [managerOpen, setManagerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const { courses } = useBoardCourses(boardId);
  const selectedCourseIds = useBoardFilters(
    (state) => state.filtersByBoardId[boardId]?.selectedCourseIds ?? EMPTY_IDS,
  );
  const toggleCourse = useBoardFilters((state) => state.toggleCourse);
  const setSelectedCourses = useBoardFilters((state) => state.setSelectedCourses);

  const pop = useTempoTransition(spring.pop);
  const reflow = useTempoTransition(spring.reflow);
  const popOut = useTempoTransition(transition.popOut);
  const checkPop = useTempoTransition(spring.checkPop);

  const options = useMemo<ScopeOption[]>(
    () => [
      ...courses.map((course) => ({
        id: course.id,
        label: getCourseShortLabel(course),
        fullName: course.name,
        dotClassName: getCourseColor(course.color).dot,
      })),
      { id: PERSONAL_COURSE_FILTER, label: "Cá nhân", fullName: "Việc không thuộc môn nào", dotClassName: "" },
    ],
    [courses],
  );

  // Analytics tính ở server, không lọc theo môn
  if (pathname.endsWith("/analytics")) {
    return null;
  }

  const selected = options.filter((option) => selectedCourseIds.includes(option.id));
  const visibleChips = selected.slice(0, MAX_VISIBLE_CHIPS);
  const hiddenCount = selected.length - visibleChips.length;
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = normalizedQuery
    ? options.filter((option) =>
        `${option.label} ${option.fullName}`.toLowerCase().includes(normalizedQuery),
      )
    : options;
  const courseOptions = filtered.filter((option) => option.id !== PERSONAL_COURSE_FILTER);
  const personalOption = filtered.find((option) => option.id === PERSONAL_COURSE_FILTER);

  const renderDot = (option: ScopeOption) =>
    option.id === PERSONAL_COURSE_FILTER ? (
      <span className="h-2 w-2 shrink-0 rounded-full border border-current opacity-70" />
    ) : (
      <span className={cn("h-2 w-2 shrink-0 rounded-full", option.dotClassName)} />
    );

  const renderRow = (option: ScopeOption) => {
    const isChecked = selectedCourseIds.includes(option.id);
    return (
      <div key={option.id} className="group/row relative flex items-center rounded-md hover:bg-neutral-100">
        <button
          type="button"
          role="menuitemcheckbox"
          aria-checked={isChecked}
          onClick={() => toggleCourse(boardId, option.id)}
          className="flex min-w-0 flex-1 items-center gap-2.5 rounded-md px-2 py-1.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
        >
          <span
            className={cn(
              "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors duration-200",
              isChecked ? "border-violet-600 bg-violet-600 text-white" : "border-neutral-300 bg-white",
            )}
          >
            <AnimatePresence initial={false}>
              {isChecked && (
                <motion.span
                  initial={{ opacity: 0, scale: scale.icon, filter: blur.icon }}
                  animate={{ opacity: 1, scale: 1, filter: "blur(0px)", transition: checkPop }}
                  exit={{ opacity: 0, scale: scale.icon, transition: popOut }}
                >
                  <Check className="h-3 w-3" strokeWidth={3} />
                </motion.span>
              )}
            </AnimatePresence>
          </span>
          {renderDot(option)}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-medium text-neutral-800">{option.label}</span>
            {option.fullName !== option.label && (
              <span className="block truncate text-[11px] text-neutral-500">{option.fullName}</span>
            )}
          </span>
        </button>
        {/* Chọn nhanh một môn duy nhất, hữu ích khi có nhiều môn */}
        <button
          type="button"
          onClick={() => {
            setSelectedCourses(boardId, [option.id]);
            setOpen(false);
          }}
          className="mr-1 shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold text-violet-700 opacity-0 transition-opacity duration-200 hover:bg-violet-100 focus-visible:opacity-100 group-hover/row:opacity-100"
        >
          Chỉ môn này
        </button>
      </div>
    );
  };

  return (
    <ReducedMotionConfig>
      <div className="flex items-center gap-1.5">
        {/* Chip môn đang chọn (ẩn trên mobile, chỉ còn số đếm ở nút) */}
        <div className="hidden items-center gap-1.5 md:flex">
          <AnimatePresence mode="popLayout" initial={false}>
            {visibleChips.map((option) => (
              <motion.span
                key={option.id}
                layout="position"
                initial={{ opacity: 0, scale: scale.action, filter: blur.icon }}
                animate={{ opacity: 1, scale: 1, filter: "blur(0px)", transition: pop }}
                exit={{ opacity: 0, scale: scale.action, transition: popOut }}
                transition={reflow}
                className="flex h-7 items-center gap-1.5 rounded-full bg-white py-0 pl-2.5 pr-1 text-xs font-semibold text-neutral-900 shadow-sm"
              >
                {renderDot(option)}
                <span className="max-w-[9rem] truncate" title={option.fullName}>{option.label}</span>
                <button
                  type="button"
                  aria-label={`Bỏ lọc ${option.label}`}
                  onClick={() => toggleCourse(boardId, option.id)}
                  className="flex h-5 w-5 items-center justify-center rounded-full text-neutral-500 transition-colors duration-200 hover:bg-neutral-100 hover:text-neutral-900"
                >
                  <X className="h-3 w-3" />
                </button>
              </motion.span>
            ))}
            {hiddenCount > 0 && (
              <motion.button
                key="more"
                type="button"
                layout="position"
                initial={{ opacity: 0, scale: scale.action }}
                animate={{ opacity: 1, scale: 1, transition: pop }}
                exit={{ opacity: 0, scale: scale.action, transition: popOut }}
                transition={reflow}
                onClick={() => setOpen(true)}
                className="flex h-7 items-center rounded-full bg-white/90 px-2.5 text-xs font-semibold text-neutral-900 shadow-sm"
              >
                +{hiddenCount}
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        <PopoverPrimitive.Root
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            if (!next) setQuery("");
          }}
        >
          <PopoverPrimitive.Trigger asChild>
            <button
              type="button"
              className={cn(
                "flex h-7 items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-white ring-1 ring-white/20 transition-colors duration-200 hover:bg-white/20 data-[state=open]:bg-white/20",
                selected.length === 0 ? "bg-white/10" : "bg-white/5",
              )}
            >
              {selected.length === 0 ? (
                <>
                  <span className="flex -space-x-1">
                    {options.slice(0, 4).map((option) => (
                      <span
                        key={option.id}
                        className={cn(
                          "h-2.5 w-2.5 rounded-full ring-1 ring-black/30",
                          option.dotClassName || "border border-white bg-transparent",
                        )}
                      />
                    ))}
                  </span>
                  Tất cả môn
                </>
              ) : (
                <>
                  Môn học
                  <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-white px-1 text-[10px] font-bold text-neutral-900">
                    {selected.length}
                  </span>
                </>
              )}
              <ChevronDown className="h-3.5 w-3.5 opacity-80 transition-transform duration-200 [[data-state=open]_&]:rotate-180" />
            </button>
          </PopoverPrimitive.Trigger>
          <PopoverPrimitive.Portal>
            <PopoverPrimitive.Content
              align="end"
              sideOffset={8}
              className="z-50 flex w-72 origin-(--radix-popover-content-transform-origin) flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white text-sm shadow-xl outline-none"
            >
              {options.length > SEARCH_THRESHOLD && (
                <div className="flex items-center gap-2 border-b border-neutral-100 px-3">
                  <Search className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
                  <input
                    autoFocus
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Tìm môn học…"
                    className="h-10 w-full bg-transparent text-[13px] outline-none placeholder:text-neutral-400"
                  />
                </div>
              )}
              <div role="menu" className="max-h-72 overflow-y-auto p-1.5 styled-scrollbar">
                {courseOptions.length > 0 && (
                  <p className="px-2 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                    Môn học · {courses.length}
                  </p>
                )}
                {courseOptions.map(renderRow)}
                {personalOption && (
                  <>
                    <p className="px-2 pb-1 pt-2.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                      Khác
                    </p>
                    {renderRow(personalOption)}
                  </>
                )}
                {filtered.length === 0 && (
                  <p className="px-2 py-6 text-center text-xs text-neutral-500">Không có môn nào khớp “{query}”.</p>
                )}
              </div>
              <div className="flex items-center justify-between gap-2 border-t border-neutral-100 bg-neutral-50/80 px-2 py-1.5">
                <button
                  type="button"
                  disabled={selected.length === 0}
                  onClick={() => setSelectedCourses(boardId, [])}
                  className="rounded-md px-2 py-1 text-xs font-medium text-neutral-600 transition-colors duration-200 hover:bg-neutral-200/70 disabled:pointer-events-none disabled:opacity-40"
                >
                  Hiện tất cả
                </button>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      setManagerOpen(true);
                    }}
                    className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-neutral-600 transition-colors duration-200 hover:bg-neutral-200/70"
                  >
                    <Settings2 className="h-3.5 w-3.5" />
                    {courses.length === 0 ? "Thêm môn học" : "Quản lý môn"}
                  </button>
                )}
              </div>
            </PopoverPrimitive.Content>
          </PopoverPrimitive.Portal>
        </PopoverPrimitive.Root>

        {canEdit && (
          <CourseManagerDialog
            boardId={boardId}
            open={managerOpen}
            onOpenChange={setManagerOpen}
          />
        )}
      </div>
    </ReducedMotionConfig>
  );
};
