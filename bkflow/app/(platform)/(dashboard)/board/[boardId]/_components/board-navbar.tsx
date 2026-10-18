import { Board, BoardMember, BoardMemberRole, BoardType, Label, List, type Semester } from "@prisma/client";

import { BoardTitleForm } from "./board-title-form";
import { BoardOptions } from "./board-options";
import { BoardMembers } from "./board-members";
import { BoardFilters } from "./board-filters";
import { BoardImportantToggle } from "./board-important-toggle";
import { BoardViewSwitcher } from "./board-view-switcher";
import { BoardSemesterSwitcher } from "./board-semester-switcher";
import { BoardSidebarToggle } from "./board-sidebar-toggle";
import { ClerkOrgMember } from "@/lib/clerk-org-members";

interface BoardNavbarProps {
  data: Board & { members: BoardMember[]; labels: Label[]; lists: List[] };
  organizationMembers: ClerkOrgMember[];
  currentUserId: string;
  currentMemberRole: BoardMemberRole;
  semesters: Semester[];
};

export const BoardNavbar = ({
  data,
  organizationMembers,
  currentUserId,
  currentMemberRole,
  semesters,
}: BoardNavbarProps) => {
  const isAdmin = currentMemberRole === BoardMemberRole.ADMIN;
  const canEdit = currentMemberRole !== BoardMemberRole.VIEWER;

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
          members={data.members}
          currentUserId={currentUserId}
          labels={data.labels}
        />
        <BoardMembers
          boardId={data.id}
          members={data.members}
          organizationMembers={organizationMembers}
          currentUserId={currentUserId}
          canManage={isAdmin}
        />
        <BoardOptions
          id={data.id}
          title={data.title}
          orgId={data.orgId}
          currentUserId={currentUserId}
          currentMemberRole={currentMemberRole}
          canDelete={isAdmin}
          canEdit={canEdit}
          lists={data.lists}
          members={data.members}
          labels={data.labels}
        />
      </div>
    </div>
  );
};
