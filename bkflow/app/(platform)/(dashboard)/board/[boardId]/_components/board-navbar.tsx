import { Board, BoardType, Label, List, type Semester } from "@prisma/client";

import { BoardTitleForm } from "./board-title-form";
import { BoardOptions } from "./board-options";
import { BoardFilters } from "./board-filters";
import { BoardImportantToggle } from "./board-important-toggle";
import { BoardViewSwitcher } from "./board-view-switcher";
import { BoardSemesterSwitcher } from "./board-semester-switcher";
import { BoardSidebarToggle } from "./board-sidebar-toggle";

interface BoardNavbarProps {
  data: Board & { labels: Label[]; lists: List[] };
  organizationMembers?: any[];
  currentUserId: string;
  currentMemberRole?: string;
  semesters: Semester[];
  /** Lọc theo môn (chỉ bảng học kỳ) — nằm cuối hàng tab */
  courseFilter?: React.ReactNode;
}

export const BoardNavbar = ({
  data,
  currentUserId,
  semesters,
  courseFilter,
}: BoardNavbarProps) => {
  const isAdmin = true;
  const canEdit = true;

  return (
    <div className="relative z-[40] shrink-0 bg-gradient-to-b from-black/60 to-black/40 text-white backdrop-blur-sm">
      {/* Hàng 1: danh tính bảng + hành động */}
      <div className="flex h-12 items-center justify-between gap-2 px-3 md:px-6">
        <div className="flex min-w-0 flex-1 items-center">
          <BoardSidebarToggle variant="board-navbar" />
          <BoardTitleForm data={data} canEdit={isAdmin} currentUserId={currentUserId} />
          {data.boardType === BoardType.SEMESTER && data.semesterId && (
            <div className="ml-2 hidden sm:block">
              <BoardSemesterSwitcher
                semesters={semesters}
                currentSemesterId={data.semesterId}
              />
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-x-1.5">
          <BoardImportantToggle boardId={data.id} />
          <BoardFilters
            boardId={data.id}
            labels={data.labels}
          />
          <BoardOptions
            id={data.id}
            title={data.title}
            orgId={data.userId ?? data.id}
            currentUserId={currentUserId}
            canDelete={isAdmin}
            canEdit={canEdit}
            lists={data.lists}
            labels={data.labels}
          />
        </div>
      </div>
      {/* Hàng 2: mọi chế độ xem là tab + phạm vi môn học */}
      <div className="flex h-11 items-stretch gap-3 border-t border-white/10 px-3 md:px-6">
        <BoardViewSwitcher boardId={data.id} boardType={data.boardType} />
        {courseFilter && <div className="ml-auto flex shrink-0 items-center">{courseFilter}</div>}
      </div>
    </div>
  );
};
