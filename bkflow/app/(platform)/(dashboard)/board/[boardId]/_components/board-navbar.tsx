import { Board, Label, List } from "@prisma/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { BoardTitleForm } from "./board-title-form";
import { BoardOptions } from "./board-options";
import { BoardFilters } from "./board-filters";
import { BoardImportantToggle } from "./board-important-toggle";
import { updateWorkspace } from "@/actions/workspaces/update-workspace";
import { WorkspaceIconPicker } from "@/components/workspaces/workspace-icon-picker";
import { useAction } from "@/hooks/use-action";
import { MY_TASKS_ROOT_KEY } from "@/lib/my-tasks/types";

type BoardWorkspace = { id: string; title: string; icon: string | null; color: string };

// Bấm icon trên header để đổi icon/màu workspace đang mở, không phải mở Quản lý workspace
const WorkspaceHeaderIcon = ({ workspace }: { workspace: BoardWorkspace }) => {
  const queryClient = useQueryClient();
  const { execute } = useAction(updateWorkspace, {
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: MY_TASKS_ROOT_KEY });
      void queryClient.invalidateQueries({ queryKey: ["view"] });
    },
    onError: (error) => toast.error(error),
  });
  return (
    <span className="mr-2 flex">
      <WorkspaceIconPicker
        icon={workspace.icon}
        color={workspace.color}
        title={workspace.title}
        onChange={(value) => execute({ id: workspace.id, ...value })}
      />
    </span>
  );
};

interface BoardNavbarProps {
  data: Board & { labels: Label[]; lists: List[] };
  organizationMembers?: any[];
  currentUserId: string;
  currentMemberRole?: string;
  workspace?: BoardWorkspace | null;
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
          {workspace && <WorkspaceHeaderIcon workspace={workspace} />}
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
