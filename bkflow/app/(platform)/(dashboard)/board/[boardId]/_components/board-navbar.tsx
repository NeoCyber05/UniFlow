import { Board, Label, List } from "@prisma/client";

import { BoardTitleForm } from "./board-title-form";
import { BoardOptions } from "./board-options";
import { BoardFilters } from "./board-filters";
import { BoardImportantToggle } from "./board-important-toggle";
import { WorkspaceIcon } from "@/components/workspaces/workspace-icon";

interface BoardNavbarProps {
  data: Board & { labels: Label[]; lists: List[] };
  organizationMembers?: any[];
  currentUserId: string;
  currentMemberRole?: string;
  workspace?: { title: string; icon: string | null; color: string } | null;
  /** Lọc theo môn (chỉ bảng workspace). */
  courseFilter?: React.ReactNode;
}

export const BoardNavbar = ({
  data,
  currentUserId,
  workspace,
  courseFilter,
}: BoardNavbarProps) => {
  const isAdmin = true;
  const canEdit = true;

  return (
    <div className="relative z-[40] shrink-0 bg-[var(--board-header)]/95 text-white backdrop-blur-sm">
      {/* Hàng 1: danh tính bảng + hành động */}
      <div className="flex h-12 items-center justify-between gap-2 px-3 md:px-6">
        <div className="flex min-w-0 flex-1 items-center">
          {workspace && <WorkspaceIcon icon={workspace.icon} color={workspace.color} title={workspace.title} size="md" className="mr-2" />}
          {/* Bảng workspace đổi tên qua switcher để tên workspace và bảng không lệch */}
          <BoardTitleForm data={data} canEdit={isAdmin && !workspace} currentUserId={currentUserId} />
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
