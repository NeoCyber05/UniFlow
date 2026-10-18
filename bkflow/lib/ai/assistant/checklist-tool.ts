import "server-only";

import { tool } from "ai";
import { z } from "zod";

import { renameChecklistItem } from "@/actions/checklists/rename-checklist-item";
import { setChecklistItemDueDate } from "@/actions/checklists/set-checklist-item-due-date";
import { toggleChecklistItem } from "@/actions/checklists/toggle-checklist-item";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { BOARD_EDITOR_REQUIRED_ERROR } from "@/lib/permissions";
import { auth } from "@/server/auth";
import { BoardMemberRole } from "@/types";

import type { AssistantSession } from "./board-data";
import { formatZonedDateTime } from "./time";

export const createChecklistItemTool = (session: AssistantSession) => tool({
  description: "Sửa một mục checklist trên bảng hiện tại: đặt trạng thái hoàn thành/chưa xong, đổi tên, hoặc đặt/xóa hạn. Gọi getCardDetails trước để lấy đúng cardId và itemId; nếu trùng tên hãy hỏi rõ. Mỗi lần thay đổi một thuộc tính; hạn phải có múi giờ và không được sau hạn thẻ cha.",
  inputSchema: z.object({
    cardId: z.string().min(1), itemId: z.string().min(1),
    change: z.discriminatedUnion("type", [
      z.object({ type: z.literal("completed"), isCompleted: z.boolean() }),
      z.object({ type: z.literal("title"), title: z.string().trim().min(1).max(1000) }),
      z.object({ type: z.literal("dueDate"), dueDate: z.string().max(40).nullable().describe("ISO 8601 kèm offset, hoặc null để bỏ hạn") }),
    ]),
  }),
  execute: async ({ cardId, itemId, change }) => {
    if (session.role === BoardMemberRole.VIEWER) return { ok: false, error: BOARD_EDITOR_REQUIRED_ERROR };
    if ((await auth()).userId !== session.userId) return { ok: false, error: "Không có quyền truy cập." };

    try {
      const card = await db.card.findFirst({
        where: { id: cardId, archivedAt: null, list: { boardId: session.boardId, archivedAt: null, board: { userId: session.userId } } },
        select: { id: true, title: true },
      });
      if (!card) return { ok: false, error: "Không tìm thấy thẻ đang hoạt động trên bảng hiện tại." };
      const input = { boardId: session.boardId, cardId, id: itemId };
      let result;
      if (change.type === "completed") {
        result = await toggleChecklistItem({ ...input, isCompleted: change.isCompleted });
      } else if (change.type === "title") {
        result = await renameChecklistItem({ ...input, title: change.title });
      } else {
        const parsed = change.dueDate === null ? null : z.iso.datetime({ offset: true }).safeParse(change.dueDate);
        if (parsed && !parsed.success) return { ok: false, error: "Hạn không hợp lệ. Hãy dùng ISO 8601 kèm múi giờ." };
        result = await setChecklistItemDueDate({ ...input, dueDate: change.dueDate === null ? null : new Date(change.dueDate) });
      }
      if (result.error || result.fieldErrors || !result.data) return { ok: false, error: result.error || "Không cập nhật được mục checklist. Kiểm tra lại dữ liệu." };
      const item = result.data;
      return {
        ok: true, action: "checklist_item_updated" as const, card: { id: card.id, title: card.title },
        item: { id: item.id, title: item.title, isCompleted: item.isCompleted, dueDate: formatZonedDateTime(item.dueDate, session.timeZone) },
      };
    } catch (error) {
      logger.error("[ASSISTANT_UPDATE_CHECKLIST_ITEM]", error, { action: "assistant-checklist", cardId });
      return { ok: false, error: "Chưa cập nhật được mục checklist. Hãy thử lại." };
    }
  },
});
