import "server-only";

import { db } from "@/lib/db";
import { requireBoardMemberForUser } from "@/lib/permissions";

type CardUserStatePatch = {
  isImportant?: boolean;
  myDayAt?: Date | null;
};

/**
 * Ghi trạng thái riêng của user trên thẻ. Chỉ cần là thành viên bảng (kể cả VIEWER),
 * vì không đổi dữ liệu dùng chung. Không ghi audit log.
 */
export const setCardUserState = async ({
  cardId,
  userId,
  patch,
}: {
  cardId: string;
  userId: string;
  patch: CardUserStatePatch;
}) => {
  const card = await db.card.findUnique({
    where: { id: cardId },
    select: { id: true, list: { select: { boardId: true } } },
  });

  if (!card) {
    return { error: "Không tìm thấy thẻ." };
  }

  const permission = await requireBoardMemberForUser({ boardId: card.list.boardId, userId });

  if (permission.error) {
    return { error: permission.error };
  }

  const state = await db.cardUserState.upsert({
    where: { cardId_userId: { cardId, userId } },
    create: { cardId, userId, ...patch },
    update: patch,
  });

  return { data: state };
};
