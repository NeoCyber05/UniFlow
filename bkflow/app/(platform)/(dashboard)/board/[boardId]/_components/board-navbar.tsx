import { Board, Label, List } from "@prisma/client";

import { BoardFilters } from "./board-filters";
import { BoardImportantToggle } from "./board-important-toggle";

type BoardWorkspace = { id: string; title: string; icon: string | null; color: string };

interface BoardNavbarProps {
  data: Board & { labels: Label[]; lists: List[] };
  organizationMembers?: any[];
  currentUserId: string;
  currentMemberRole?: string;
  workspace?: BoardWorkspace | null;
  /** Lọc theo môn (chỉ bảng workspace). */
  courseFilter?: React.ReactNode;
  /** light: không nền tối, dùng cho Lịch / Sơ đồ / Thống kê */
  tone?: "dark" | "light";
}

export const BoardNavbar = ({
  data,
  courseFilter,
  tone = "dark",
}: BoardNavbarProps) => {
  return (
    <div
      className={tone === "dark" ? "relative z-[40] shrink-0 bg-[var(--board-header)]/95 text-white backdrop-blur-sm" : "relative z-[40] shrink-0"}
    >
      {/* Tên bảng đã có ở sidebar: thanh này chỉ giữ các bộ lọc */}
      <div className="flex h-12 items-center justify-end gap-2 px-3 md:px-6">
        <div className="flex shrink-0 items-center gap-x-1.5">
          {courseFilter}
          <BoardImportantToggle boardId={data.id} tone={tone} />
          <BoardFilters
            boardId={data.id}
            labels={data.labels}
            tone={tone}
          />
        </div>
      </div>
    </div>
  );
};
