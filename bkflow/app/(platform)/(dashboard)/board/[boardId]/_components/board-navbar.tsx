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
}

export const BoardNavbar = ({
  data,
  currentUserId,
  semesters,
}: BoardNavbarProps) => {
  const isAdmin = true;
  const canEdit = true;

  return (
    <div className="relative shrink-0 z-[40] flex h-14 w-full items-center justify-between bg-gradient-to-b from-black/50 to-black/30 px-3 text-white backdrop-blur-sm md:px-6">
      <div className="flex min-w-0 flex-1 items-center pr-2">
        <div className="flex min-w-0 items-center">
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
      </div>
      <div className="flex shrink-0 items-center justify-end gap-x-1.5 md:gap-x-2">
        <BoardViewSwitcher boardId={data.id} boardType={data.boardType} />
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
  );
};
