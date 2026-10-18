"use client";

import { BoardSidebar } from "./board-sidebar";
import { BoardSidebarToggle } from "./board-sidebar-toggle";
import { BoardSplitDropZone } from "./board-split-drop-zone";

interface BoardShellProps {
  children: React.ReactNode;
  boardNavbar: React.ReactNode;
  courseFilterBar?: React.ReactNode;
}

export const BoardShell = ({
  children,
  boardNavbar,
  courseFilterBar,
}: BoardShellProps) => {
  return (
    <div className="flex-1 flex overflow-hidden relative pt-14 h-screen">
      {/* Sidebar điều hướng cá nhân & hội nhóm */}
      <BoardSidebar />

      {/* Không gian làm việc chính của Bảng */}
      <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden relative">
        <BoardSidebarToggle variant="docked" />
        {boardNavbar}
        {courseFilterBar}
        <main className="relative flex-1 min-h-0 overflow-hidden">
          {children}
          <BoardSplitDropZone />
        </main>
      </div>
    </div>
  );
};
