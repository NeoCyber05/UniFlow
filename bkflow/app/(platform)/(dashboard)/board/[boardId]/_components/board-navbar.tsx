import { Board, BoardType, Label, List, type Semester } from "@prisma/client";

import { BoardTitleForm } from "./board-title-form";
import { BoardOptions } from "./board-options";
import { BoardFilters } from "./board-filters";
import { BoardImportantToggle } from "./board-important-toggle";
import { BoardSemesterSwitcher } from "./board-semester-switcher";

interface BoardNavbarProps {
  data: Board & { labels: Label[]; lists: List[] };
  organizationMembers?: any[];
  currentUserId: string;
  currentMemberRole?: string;
  semesters: Semester[];
  /** Lọc theo môn (chỉ bảng học kỳ). */
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
          {courseFilter}
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
    </div>
  );
};
