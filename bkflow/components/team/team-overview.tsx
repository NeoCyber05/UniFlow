"use client";

import { useMemo } from "react";
import Image from "@/web/shims/next-image";
import { usePathname, useRouter, useSearchParams } from "@/web/shims/next-navigation";
import { useUser } from "@clerk/react";

import { TaskDetailPanel } from "@/components/my-tasks/task-detail-panel";
import { TaskGroupSection } from "@/components/my-tasks/task-group-section";
import { Skeleton } from "@/components/ui/skeleton";
import { ProgressSummary } from "@/components/stats/progress-summary";
import { useTaskPanelParam } from "@/hooks/use-task-panel-param";
import { toRowTask, useTeamOverview } from "@/hooks/use-team-overview";
import type { MyTaskGroup } from "@/lib/my-tasks/types";
import type { TaskGroup } from "@/lib/my-tasks/buckets";
import {
  computeTeamStats,
  computeWorkload,
  filterTeamTasks,
  groupAllTeamTasks,
  groupMineTasks,
  UNASSIGNED_KEY,
  type TeamGroupBy,
  type TeamStatusFilter,
} from "@/lib/team-tasks/workload";
import { cn } from "@/lib/utils";

import { TeamMemberCard } from "./team-member-card";
import { TeamQuickAdd } from "./team-quick-add";

const TABS = [
  { key: "mine", label: "Việc của tôi" },
  { key: "all", label: "Tất cả việc" },
  { key: "members", label: "Theo thành viên" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const isTab = (value: string | null): value is TabKey =>
  TABS.some((tab) => tab.key === value);

const MAX_AVATARS = 5;

const selectClassName =
  "h-8 rounded-lg border border-neutral-200 bg-white px-2 text-xs text-neutral-700 focus:outline-none focus:ring-2 focus:ring-sky-100";

export const TeamOverview = ({ orgId }: { orgId: string }) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user } = useUser();
  const { taskId, openTask, closeTask } = useTaskPanelParam();
  const { data, tasks, isLoading } = useTeamOverview(orgId);
  const now = new Date();

  const tabParam = searchParams.get("tab");
  const tab: TabKey = isTab(tabParam) ? tabParam : "mine";
  const boardFilter = searchParams.get("board");
  const memberFilter = searchParams.get("member");
  const statusFilter = searchParams.get("status") as TeamStatusFilter | null;
  const groupBy = (searchParams.get("group") as TeamGroupBy | null) ?? "board";

  const setParams = (patch: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());

    Object.entries(patch).forEach(([key, value]) => {
      if (value) params.set(key, value);
      else params.delete(key);
    });

    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const members = data?.members ?? [];
  const boards = data?.boards ?? [];
  const stats = useMemo(() => computeTeamStats(tasks, now), [tasks, now]);

  const groups: MyTaskGroup[] = useMemo(() => {
    const toDTO = (group: TaskGroup<(typeof tasks)[number]>): MyTaskGroup => ({
      key: group.key,
      label: group.label,
      ...(group.collapsed ? { collapsed: true } : {}),
      tasks: group.tasks.map(toRowTask),
    });

    if (tab === "mine") {
      const mine = tasks.filter((task) => user && task.assigneeUserIds.includes(user.id));

      return groupMineTasks(mine, now).map(toDTO);
    }

    if (tab === "all") {
      const filtered = filterTeamTasks(
        tasks,
        { boardId: boardFilter, memberId: memberFilter, status: statusFilter },
        now,
      );

      return groupAllTeamTasks(filtered, groupBy, members, now).map(toDTO);
    }

    return [];
  }, [tab, tasks, user, now, boardFilter, memberFilter, statusFilter, groupBy, members]);

  const workload = useMemo(() => computeWorkload(tasks, members, now), [tasks, members, now]);

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full rounded-2xl" />
        <Skeleton className="h-10 w-80 rounded-xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  const visibleMembers = members.slice(0, MAX_AVATARS);

  return (
    <div className="flex items-start gap-6">
      <div className="min-w-0 flex-1 space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex -space-x-2">
            {visibleMembers.map((member) => (
              <div key={member.userId} title={member.name} className="relative h-8 w-8 overflow-hidden rounded-full ring-2 ring-white">
                <Image fill src={member.imageUrl} alt={member.name} className="object-cover" />
              </div>
            ))}
            {members.length > MAX_AVATARS && (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-100 text-xs font-semibold text-neutral-600 ring-2 ring-white">
                +{members.length - MAX_AVATARS}
              </div>
            )}
          </div>
          <span className="text-xs text-neutral-500">{members.length} thành viên · {boards.length} bảng</span>
        </div>

        <ProgressSummary
          totalCards={stats.total}
          completedCards={stats.completed}
          overdueCards={stats.overdue}
          dueSoonCards={stats.dueThisWeek}
          unscheduledCards={stats.unscheduled}
        />

        <nav className="flex gap-1 rounded-xl bg-neutral-100 p-1">
          {TABS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setParams({ tab: item.key === "mine" ? null : item.key })}
              className={cn(
                "flex-1 rounded-lg px-3 py-1.5 text-sm font-medium text-neutral-600 transition hover:text-neutral-900",
                tab === item.key && "bg-white text-neutral-900 shadow-sm",
              )}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {tab !== "members" && (
          <TeamQuickAdd
            orgId={orgId}
            boards={boards}
            assignToUserId={tab === "mine" ? user?.id : undefined}
          />
        )}

        {tab === "all" && (
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Lọc theo bảng"
              value={boardFilter ?? ""}
              onChange={(event) => setParams({ board: event.target.value || null })}
              className={selectClassName}
            >
              <option value="">Mọi bảng</option>
              {boards.map((board) => (
                <option key={board.id} value={board.id}>{board.title}</option>
              ))}
            </select>
            <select
              aria-label="Lọc theo thành viên"
              value={memberFilter ?? ""}
              onChange={(event) => setParams({ member: event.target.value || null })}
              className={selectClassName}
            >
              <option value="">Mọi người</option>
              {members.map((member) => (
                <option key={member.userId} value={member.userId}>{member.name}</option>
              ))}
              <option value={UNASSIGNED_KEY}>Chưa giao</option>
            </select>
            <select
              aria-label="Lọc theo trạng thái"
              value={statusFilter ?? ""}
              onChange={(event) => setParams({ status: event.target.value || null })}
              className={selectClassName}
            >
              <option value="">Mọi trạng thái</option>
              <option value="open">Đang mở</option>
              <option value="overdue">Quá hạn</option>
              <option value="done">Đã xong</option>
            </select>
            <select
              aria-label="Nhóm theo"
              value={groupBy}
              onChange={(event) => setParams({ group: event.target.value === "board" ? null : event.target.value })}
              className={cn(selectClassName, "ml-auto")}
            >
              <option value="board">Nhóm theo bảng</option>
              <option value="member">Nhóm theo người</option>
              <option value="status">Nhóm theo trạng thái</option>
            </select>
          </div>
        )}

        {tab === "members" ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {workload.map((row) => (
              <TeamMemberCard
                key={row.userId}
                row={row}
                onSelect={(userId) => setParams({ tab: "all", member: userId, status: null, board: null })}
              />
            ))}
          </div>
        ) : groups.every((group) => group.tasks.length === 0) ? (
          <p className="rounded-2xl border border-dashed border-neutral-200 py-10 text-center text-sm text-neutral-500">
            {tab === "mine" ? "Bạn chưa được giao việc nào trong nhóm này." : "Không có việc nào khớp bộ lọc."}
          </p>
        ) : (
          groups.map((group) => (
            <TaskGroupSection
              key={group.key}
              group={group}
              selectedTaskId={taskId}
              onOpen={openTask}
              showAssignees
            />
          ))
        )}
      </div>

      {taskId && <TaskDetailPanel taskId={taskId} onClose={closeTask} />}
    </div>
  );
};
