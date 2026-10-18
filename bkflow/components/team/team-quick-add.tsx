"use client";

import { useEffect, useMemo } from "react";
import { useLocalStorage } from "usehooks-ts";

import { QuickAddBar } from "@/components/my-tasks/quick-add-bar";
import type { TeamBoardSummary } from "@/lib/team-tasks/types";

type TeamQuickAddProps = {
  orgId: string;
  boards: TeamBoardSummary[];
  /** Tab "Việc của tôi" → tự giao cho user */
  assignToUserId?: string;
};

export const TeamQuickAdd = ({ orgId, boards, assignToUserId }: TeamQuickAddProps) => {
  const [lastBoardId, setLastBoardId] = useLocalStorage<string | null>(
    `uniflow:last-team-board:${orgId}`,
    null,
  );
  const selectedBoard = useMemo(
    () => boards.find((board) => board.id === lastBoardId) ?? boards[0] ?? null,
    [boards, lastBoardId],
  );

  useEffect(() => {
    if (selectedBoard && selectedBoard.id !== lastBoardId) {
      setLastBoardId(selectedBoard.id);
    }
  }, [lastBoardId, selectedBoard, setLastBoardId]);

  return (
    <QuickAddBar
      boardId={selectedBoard?.id}
      members={selectedBoard?.members ?? []}
      defaults={assignToUserId ? { assigneeUserIds: [assignToUserId] } : undefined}
      placeholder={selectedBoard ? `Thêm việc vào "${selectedBoard.title}"…` : "Thêm việc…"}
      disabled={!selectedBoard}
      disabledHint={<span>Nhóm chưa có bảng dự án. Tạo bảng ở thanh bên để bắt đầu.</span>}
      trailing={
        boards.length > 1 ? (
          <select
            value={selectedBoard?.id ?? ""}
            onChange={(event) => setLastBoardId(event.target.value)}
            aria-label="Chọn bảng"
            className="max-w-[10rem] truncate rounded-md border border-neutral-200 bg-neutral-50 px-1.5 py-1 text-xs text-neutral-700"
          >
            {boards.map((board) => (
              <option key={board.id} value={board.id}>
                {board.title}
              </option>
            ))}
          </select>
        ) : null
      }
    />
  );
};
