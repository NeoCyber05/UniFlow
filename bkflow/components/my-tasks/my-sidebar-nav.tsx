"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "@/web/shims/next-link";
import { usePathname } from "@/web/shims/next-navigation";
import { useQueryClient } from "@tanstack/react-query";
import type { Semester } from "@prisma/client";
import {
  Activity,
  ChevronDown,
  ChevronRight,
  GraduationCap,
  Plus,
  Trash2,
  Settings2,
  Sun,
  CalendarDays,
  ListTodo,
  BookOpen,
  FileText,
} from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ManageSemestersDialog } from "@/components/semesters/manage-semesters-dialog";
import { useCreateNotePage, useNotePages } from "@/components/notes/note-pages-list";
import { buildPageTree, getPagePath, type PageNode, type PageSummary } from "@/lib/notes/page-tree";
import { PageActionsMenu, PageIcon, readRecentPages, TrashDialog } from "@/components/notes/page-actions";
import { useMyTaskCounts, useMyTasksContext } from "@/hooks/use-my-tasks";
import { useBoardFilters } from "@/hooks/use-board-filters";
import { PERSONAL_COURSE_FILTER } from "@/lib/boards/board-filters";
import { getCourseColor } from "@/lib/courses/course-colors";
import { MY_TASKS_CONTEXT_KEY } from "@/lib/my-tasks/types";
import { formatSemesterLabel } from "@/lib/semesters";
import { cn } from "@/lib/utils";
import { viewQueryOptions } from "@/web/lib/use-view";

const EMPTY_COURSE_IDS: string[] = [];

const itemClassName = (isActive: boolean) =>
  cn(
    "flex h-8 w-full items-center gap-x-2.5 rounded-md px-2.5 text-sm text-sidebar-foreground hover:bg-sidebar-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
    isActive && "bg-sidebar-accent font-medium text-sidebar-accent-foreground",
  );

const Count = ({ value }: { value: number | undefined }) =>
  value ? (
    <span className="ml-auto rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
      {value}
    </span>
  ) : null;

const SidebarPages = ({ pathname }: { pathname: string }) => {
  const [open, setOpen] = useState(true);
  const { data: pages } = useNotePages();
  const { create, creating } = useCreateNotePage();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const tree = useMemo(() => buildPageTree(pages ?? []), [pages]);
  const activeId = pathname.startsWith("/pages/") ? decodeURIComponent(pathname.slice("/pages/".length)) : null;
  // Keep the open page visible: its ancestors start expanded.
  const ancestorIds = useMemo(() => new Set(activeId ? getPagePath(pages ?? [], activeId).slice(0, -1).map(page => page.id) : []), [pages, activeId]);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  useEffect(() => setRecentIds(readRecentPages()), [pathname]);
  const favorites = (pages ?? []).filter(page => page.isFavorite);
  const recent = recentIds.flatMap(id => pages?.find(page => page.id === id) ?? []);

  const quickLinks = (title: string, items: PageSummary[]) => items.length > 0 && (
    <div className="space-y-0.5 pb-2">
      <p className="flex h-7 items-center px-2.5 text-xs font-medium text-muted-foreground">{title}</p>
      {items.map(page => {
        const href = `/pages/${encodeURIComponent(page.id)}`;
        return (
          <Link key={page.id} href={href} aria-current={page.id === activeId ? "page" : undefined} className={itemClassName(page.id === activeId)}>
            <PageIcon icon={page.icon} className="h-3.5 w-3.5 text-sm" />
            <span className="truncate">{page.title || "Trang chưa đặt tên"}</span>
          </Link>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-0.5">
      {quickLinks("Yêu thích", favorites)}
      {quickLinks("Gần đây", recent)}
      <div className={cn(itemClassName(pathname === "/pages"), "group gap-x-1 pr-1")}>
        <button type="button" onClick={() => setOpen(value => !value)} aria-expanded={open} aria-label={open ? "Thu gọn trang" : "Mở rộng trang"} className="flex size-5 items-center justify-center rounded hover:bg-foreground/10">
          <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-90")} />
        </button>
        <Link href="/pages" aria-current={pathname === "/pages" ? "page" : undefined} className="flex min-w-0 flex-1 items-center gap-x-2 self-stretch">
          <FileText aria-hidden="true" className="h-4 w-4" />Trang của tôi
        </Link>
        <button type="button" disabled={creating} onClick={() => void create()} aria-label="Tạo trang mới" className="flex size-6 items-center justify-center rounded opacity-0 hover:bg-foreground/10 focus-visible:opacity-100 group-hover:opacity-100">
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
      {open && tree.map(node => (
        <PageTreeItem key={node.id} node={node} depth={1} activeId={activeId} ancestorIds={ancestorIds} expanded={expanded} setExpanded={setExpanded} onCreate={create} creating={creating} />
      ))}
    </div>
  );
};

type PageTreeItemProps = {
  node: PageNode;
  depth: number;
  activeId: string | null;
  ancestorIds: Set<string>;
  expanded: Record<string, boolean>;
  setExpanded: (update: (current: Record<string, boolean>) => Record<string, boolean>) => void;
  onCreate: (parentId: string) => Promise<void>;
  creating: boolean;
};

const PageTreeItem = ({ node, depth, ...props }: PageTreeItemProps) => {
  const { activeId, ancestorIds, expanded, setExpanded, onCreate, creating } = props;
  const active = node.id === activeId;
  const open = expanded[node.id] ?? ancestorIds.has(node.id);
  const hasChildren = node.children.length > 0;

  return (
    <>
      <div className={cn(itemClassName(active), "group gap-x-1 pr-1")} style={{ paddingLeft: `${depth * 12 + 4}px` }}>
        <button
          type="button"
          onClick={() => setExpanded(current => ({ ...current, [node.id]: !open }))}
          aria-expanded={hasChildren ? open : undefined}
          aria-label={open ? "Thu gọn" : "Mở rộng"}
          className={cn("flex size-5 shrink-0 items-center justify-center rounded hover:bg-foreground/10", !hasChildren && "invisible")}
        >
          <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-90")} />
        </button>
        <Link href={`/pages/${encodeURIComponent(node.id)}`} aria-current={active ? "page" : undefined} className="flex min-w-0 flex-1 items-center gap-x-2 self-stretch">
          <PageIcon icon={node.icon} className="h-3.5 w-3.5 text-sm" />
          <span className="truncate">{node.title || "Trang chưa đặt tên"}</span>
        </Link>
        <PageActionsMenu page={node} className="opacity-0 focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100" />
        <button
          type="button"
          disabled={creating}
          onClick={() => { setExpanded(current => ({ ...current, [node.id]: true })); void onCreate(node.id); }}
          aria-label={`Tạo trang con trong ${node.title || "trang"}`}
          className="flex size-6 shrink-0 items-center justify-center rounded opacity-0 hover:bg-foreground/10 focus-visible:opacity-100 group-hover:opacity-100"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
      {open && node.children.map(child => <PageTreeItem key={child.id} node={child} depth={depth + 1} {...props} />)}
    </>
  );
};

export const MySidebarNav = () => {
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { data: context } = useMyTasksContext();
  const { data: counts } = useMyTaskCounts();
  const [manageOpen, setManageOpen] = useState(false);
  const [trashOpen, setTrashOpen] = useState(false);

  const semesters = useMemo<Semester[]>(
    () =>
      (context?.semesters ?? []).map((semester) => ({
        ...semester,
        startDate: new Date(semester.startDate),
        endDate: new Date(semester.endDate),
        createdAt: new Date(semester.createdAt),
        updatedAt: new Date(semester.updatedAt),
      })),
    [context?.semesters],
  );
  const currentSemester = semesters.find((semester) => semester.id === context?.currentSemesterId);
  const board = context?.board ?? null;
  const boardId = board?.id;
  const selectedCourseIds = useBoardFilters((state) =>
    boardId ? state.filtersByBoardId[boardId]?.selectedCourseIds ?? EMPTY_COURSE_IDS : EMPTY_COURSE_IDS
  );
  const isAtSemesterBoard = board ? pathname.startsWith(`/board/${board.id}`) : false;
  const calendarHref = board ? `/board/${board.id}/calendar` : null;
  const isCalendarActive = calendarHref !== null && pathname === calendarHref;
  const isSemesterBoardActive =
    (isAtSemesterBoard && !isCalendarActive && selectedCourseIds.length === 0) ||
    (context?.currentSemesterId ? pathname === `/semester/${context.currentSemesterId}` : false);
  const clearBoardFilters = () => { if (boardId) useBoardFilters.getState().clearFilters(boardId); };
  const prefetchBoard = (view: "list" | "calendar") => {
    if (!boardId) return;
    void queryClient.prefetchQuery(viewQueryOptions(`/board/${boardId}/layout`));
    void queryClient.prefetchQuery(viewQueryOptions(`/board/${boardId}/${view}`));
  };

  const courseHref = (courseKey: string) =>
    board
      ? `/board/${board.id}?course=${courseKey}`
      : context?.currentSemesterId
        ? `/semester/${context.currentSemesterId}`
        : "#";

  const semesterBoardHref = board
    ? `/board/${board.id}/list`
    : context?.currentSemesterId
      ? `/semester/${context.currentSemesterId}`
      : null;

  return (
    <div className="space-y-4">
      <nav aria-label="Không gian học tập" className="space-y-0.5">
        {[
          { href: "/my/today", label: "Hôm nay", icon: Sun },
          { href: "/my/courses", label: "Học phần", icon: BookOpen },
        ].map(item => <Link
          key={item.href}
          href={item.href}
          aria-current={pathname === item.href ? "page" : undefined}
          className={itemClassName(pathname === item.href)}
        ><item.icon aria-hidden="true" className="h-4 w-4" />{item.label}{item.href === "/my/today" && <Count value={counts?.today} />}</Link>)}
        <SidebarPages pathname={pathname} />
      </nav>
      <div className="space-y-0.5">
      <DropdownMenu>
        <DropdownMenuTrigger className="flex h-7 w-full items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-muted-foreground hover:bg-muted">
          <GraduationCap className="h-3.5 w-3.5" />
          {currentSemester ? formatSemesterLabel(currentSemester.title) : "Chọn học kỳ"}
          <ChevronDown className="h-3 w-3" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          {semesters.map((semester) => (
            <DropdownMenuItem key={semester.id} asChild>
              <Link href={`/semester/${semester.id}`} className="flex items-center justify-between">
                {formatSemesterLabel(semester.title)}
                {semester.id === context?.currentSemesterId && (
                  <span className="text-[10px] font-semibold text-violet-600">Hiện tại</span>
                )}
              </Link>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setManageOpen(true)}>
            <Settings2 className="h-3.5 w-3.5" />
            Quản lý học kỳ
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {semesterBoardHref && (
        <Link href={semesterBoardHref} onMouseEnter={() => prefetchBoard("list")} onFocus={() => prefetchBoard("list")} onClick={clearBoardFilters} aria-current={isSemesterBoardActive ? "page" : undefined} className={itemClassName(isSemesterBoardActive)}>
          <ListTodo className="h-4 w-4" />
          Việc cần làm
          <Count value={counts?.today} />
        </Link>
      )}
      {calendarHref && (
        <Link href={calendarHref} onMouseEnter={() => prefetchBoard("calendar")} onFocus={() => prefetchBoard("calendar")} onClick={clearBoardFilters} aria-current={isCalendarActive ? "page" : undefined} className={itemClassName(isCalendarActive)}>
          <CalendarDays className="h-4 w-4" />
          Lịch
        </Link>
      )}
      </div>

      {context?.courses && context.courses.length > 0 && (
        <div className="space-y-0.5">
          <p className="flex h-7 items-center px-2.5 text-xs font-medium text-muted-foreground">Môn học</p>
          {context.courses.map((course) => {
            const isCourseActive =
              isAtSemesterBoard &&
              selectedCourseIds.length === 1 &&
              selectedCourseIds[0] === course.id;

            return (
              <Link key={course.id} href={courseHref(course.id)} className={itemClassName(isCourseActive)}>
                <span className={cn("h-2 w-2 shrink-0 rounded-full", getCourseColor(course.color).dot)} />
                <span className="truncate">{course.name}</span>
                <Count value={counts?.byCourse[course.id]} />
              </Link>
            );
          })}
          {(() => {
            const isPersonalActive =
              isAtSemesterBoard &&
              selectedCourseIds.length === 1 &&
              selectedCourseIds[0] === PERSONAL_COURSE_FILTER;

            return (
              <Link href={courseHref(PERSONAL_COURSE_FILTER)} className={itemClassName(isPersonalActive)}>
                <span className="h-2 w-2 shrink-0 rounded-full border border-neutral-400" />
                Cá nhân
                <Count value={counts?.byCourse[PERSONAL_COURSE_FILTER]} />
              </Link>
            );
          })()}
        </div>
      )}

      <div className="space-y-0.5">
        <Link href="/settings/appearance" className={itemClassName(pathname === "/settings/appearance")}>
          <Settings2 aria-hidden="true" className="h-4 w-4" />Cài đặt → Giao diện
        </Link>
        {context?.personalOrgId && (
          <Link
            href={`/organization/${context.personalOrgId}/activity`}
            className={itemClassName(pathname === `/organization/${context.personalOrgId}/activity`)}
          >
            <Activity className="h-4 w-4" />
            Nhật ký hoạt động
          </Link>
        )}
        <button type="button" onClick={() => setTrashOpen(true)} className={itemClassName(false)}>
          <Trash2 className="h-4 w-4" />
          Thùng rác
        </button>
        <TrashDialog open={trashOpen} onOpenChange={setTrashOpen} />
      </div>

      <ManageSemestersDialog
        open={manageOpen}
        onOpenChange={(open) => {
          setManageOpen(open);
          if (!open) void queryClient.invalidateQueries({ queryKey: MY_TASKS_CONTEXT_KEY });
        }}
        semesters={semesters}
      />
    </div>
  );
};
