import { Navigate, useParams, useSearchParams } from "react-router";
import { Activity, ChevronLeft, ChevronRight } from "lucide-react";
import { format, isToday, isYesterday } from "date-fns";
import Link from "@/web/shims/next-link";

import type { loadOrganizationActivity } from "@/server/views/organization-activity";
import { ActivityItem } from "@/components/activity-item";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { ActivityFilters } from "@/app/(platform)/(dashboard)/organization/[organizationId]/activity/_components/activity-filters";

import { useView } from "../lib/use-view";

type View = Awaited<ReturnType<typeof loadOrganizationActivity>>;

const getPages = (currentPage: number, totalPages: number) => {
  if (totalPages <= 8) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  if (currentPage <= 4) {
    return [1, 2, 3, 4, 5, "...", totalPages - 2, totalPages - 1, totalPages];
  }

  if (currentPage >= totalPages - 3) {
    return [1, 2, 3, "...", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }

  return [
    1,
    "...",
    currentPage - 1,
    currentPage,
    currentPage + 1,
    "...",
    totalPages,
  ];
};

const buildPageHref = (
  searchParams: Record<string, string | undefined> | undefined,
  page: number,
  normalizedParams: Record<string, string | undefined>,
) => {
  const params = new URLSearchParams();

  Object.entries(searchParams ?? {}).forEach(([key, value]) => {
    if (value) {
      params.set(key, value);
    }
  });

  Object.entries(normalizedParams).forEach(([key, value]) => {
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
  });

  params.set("page", String(page));

  return `?${params.toString()}`;
};

const getGroupLabel = (date: Date) => {
  if (isToday(date)) {
    return "Hôm nay";
  }

  if (isYesterday(date)) {
    return "Hôm qua";
  }

  return format(date, "dd/MM/yyyy");
};

const groupAuditLogsByDay = <T extends { createdAt: Date }>(logs: T[]) => {
  const groups = new Map<string, { key: string; label: string; items: T[] }>();

  logs.forEach((log) => {
    const date = new Date(log.createdAt);
    const key = format(date, "yyyy-MM-dd");
    const existingGroup = groups.get(key);

    if (existingGroup) {
      existingGroup.items.push(log);
      return;
    }

    groups.set(key, {
      key,
      label: getGroupLabel(date),
      items: [log],
    });
  });

  return Array.from(groups.values());
};

const ActivitySkeleton = () => (
  <ol className="space-y-4 mt-4">
    <Skeleton className="w-[80%] h-14 rounded-xl" />
    <Skeleton className="w-[50%] h-14 rounded-xl" />
    <Skeleton className="w-[70%] h-14 rounded-xl" />
    <Skeleton className="w-[80%] h-14 rounded-xl" />
    <Skeleton className="w-[75%] h-14 rounded-xl" />
  </ol>
);

type Loaded = Extract<View, { page: number }>;

export default function OrganizationActivityRoute() {
  const { organizationId = "" } = useParams<{ organizationId: string }>();
  const [query] = useSearchParams();
  const qs = query.toString();
  const { data } = useView<View>(`/organization/${organizationId}/activity${qs ? `?${qs}` : ""}`);

  return (
    <div className="w-full">
      {!data ? <ActivitySkeleton /> : data.redirect ? <Navigate to={data.redirect} replace /> : <ActivityContent data={data} />}
    </div>
  );
}

const ActivityContent = ({ data }: { data: Loaded }) => {
  const [query] = useSearchParams();
  const searchParams: Record<string, string | undefined> = Object.fromEntries(query);
  const {
    page, boards, actors, validBoardIds, selectedEventTypes, validUserIds, selectedRange, search,
    hasExplicitFilter, totalPages, normalizedParams, auditLogs, cardMap, boardMap, existingListIds,
    existingChecklistIds, existingChecklistItemIds, memberNames,
  } = data;

  const filters = (
      <ActivityFilters
        boards={boards}
        actors={actors}
        selectedBoardIds={validBoardIds}
        selectedEventTypes={selectedEventTypes}
        selectedUserIds={validUserIds}
        selectedRange={selectedRange}
        searchQuery={search}
      />
    );

    if (auditLogs.length === 0) {
      return (
        <div className="flex flex-col gap-y-4">
          {filters}
          <div className="flex flex-col items-center justify-center min-h-[300px] border border-dashed border-neutral-200 rounded-2xl p-8 text-center bg-neutral-50/50">
            <div className="w-12 h-12 bg-neutral-100 rounded-2xl flex items-center justify-center mb-4">
              <Activity className="h-6 w-6 text-neutral-400" />
            </div>
            <h3 className="font-semibold text-neutral-800 text-base">Không tìm thấy hoạt động nào</h3>
            <p className="text-sm text-neutral-400 max-w-sm mt-1">
              {search
                ? `Không tìm thấy hoạt động nào cho "${search}".`
                : hasExplicitFilter
                ? "Không có hoạt động phù hợp với bộ lọc hiện tại."
                : "Chưa có hoạt động nào trong 30 ngày qua."}
            </p>
          </div>
        </div>
      );
    }

    const pages = getPages(page, totalPages);
    const groupedAuditLogs = groupAuditLogsByDay(auditLogs);

    return (
      <div className="flex flex-col gap-y-6">
        {filters}
        <div className="mt-2 flex flex-col gap-y-7">
          {groupedAuditLogs.map((group) => (
            <section key={group.key} className="flex flex-col gap-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                {group.label}
              </h3>
              <ol className="space-y-4">
                {group.items.map((log) => {
                  const resolvedCardId = log.cardId || (log.entityType === "CARD" ? log.entityId : null);
                  const boardTitle = log.boardId ? boardMap.get(log.boardId) : undefined;
                  const cardInfo = resolvedCardId ? cardMap.get(resolvedCardId) : undefined;
                  const cardTitle = cardInfo?.title;
                  const cardArchived = cardInfo?.isArchived;
                  const listExists = log.entityType === "LIST" ? existingListIds.has(log.entityId) : true;
                  const checklistExists = log.entityType === "CHECKLIST" ? existingChecklistIds.has(log.entityId) : true;
                  const checklistItemExists = log.entityType === "CHECKLIST_ITEM" ? existingChecklistItemIds.has(log.entityId) : true;
                  return (
                    <ActivityItem
                      key={log.id}
                      data={log}
                      boardTitle={boardTitle}
                      cardTitle={cardTitle}
                      cardArchived={cardArchived}
                      listExists={listExists}
                      checklistExists={checklistExists}
                      checklistItemExists={checklistItemExists}
                      memberNames={memberNames}
                    />
                  );
                })}
              </ol>
            </section>
          ))}
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-x-2 pt-6 pb-8">
            <Link
              href={buildPageHref(searchParams, Math.max(1, page - 1), normalizedParams)}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 transition-all text-neutral-600 shadow-sm",
                page <= 1 && "pointer-events-none opacity-40",
              )}
              aria-disabled={page <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Link>
            {pages.map((p, index) => {
              if (typeof p === "string") {
                return (
                  <span
                    key={`ellipsis-${index}`}
                    className="flex h-9 w-9 items-center justify-center text-sm text-neutral-400 select-none"
                  >
                    ...
                  </span>
                );
              }

              return (
                <Link
                  key={`page-${p}`}
                  href={buildPageHref(searchParams, p, normalizedParams)}
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-lg border text-sm font-medium transition-all shadow-sm",
                    p === page
                      ? "border-violet-600 bg-violet-600 text-white shadow-violet-100"
                      : "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50",
                  )}
                >
                  {p}
                </Link>
              );
            })}
            <Link
              href={buildPageHref(searchParams, Math.min(totalPages, page + 1), normalizedParams)}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 bg-white hover:bg-neutral-50 transition-all text-neutral-600 shadow-sm",
                page >= totalPages && "pointer-events-none opacity-40",
              )}
              aria-disabled={page >= totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        )}
      </div>
    );
};
