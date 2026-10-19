"use client";

import { BoardSidebar } from "./board-sidebar";

interface BoardShellProps {
  children: React.ReactNode;
  boardNavbar: React.ReactNode;
}

export const BoardShell = ({
  children,
  boardNavbar,
}: BoardShellProps) => {
  return (
    <div className="flex-1 flex overflow-hidden relative pt-14 h-screen">
      {/* Sidebar điều hướng cá nhân & hội nhóm */}
      <BoardSidebar />

      {/* Không gian làm việc chính của Bảng */}
      <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden relative">
        {boardNavbar}
        <main className="relative flex-1 min-h-0 overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
};
