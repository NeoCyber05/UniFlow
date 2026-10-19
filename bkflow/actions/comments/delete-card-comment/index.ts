"use server";

import { BoardMemberRole } from "@/types";
import { auth, currentUser } from "@/server/auth";

import { createSafeAction } from "@/lib/create-safe-action";
import { db } from "@/lib/db";
import { requireBoardEditor } from "@/lib/permissions";
import { triggerCommentDeleted } from "@/lib/comments/realtime";

import { DeleteCardComment } from "./schema";
import { InputType, ReturnType } from "./types";

const handler = async (data: InputType): Promise<ReturnType> => {
  const { userId } = await auth();
  const user = await currentUser();

  if (!userId || !user) {
    return { error: "Không có quyền truy cập." };
  }

  const { boardId, cardId, commentId } = data;
  let comment;

  try {
    const permission = await requireBoardEditor({ boardId, userId });

    if (permission.error) {
      return { error: permission.error };
    }

    const existingComment = await db.cardComment.findUnique({
      where: {
        id: commentId,
        card: {
          id: cardId,
          list: {
            board: {
              id: boardId,
              userId,
            },
          },
        },
      },
      include: {
        card: {
          select: {
            title: true,
          },
        },
      },
    });

    if (!existingComment) {
      return { error: "Không tìm thấy bình luận." };
    }

    if (
      existingComment.userId !== userId &&
      permission.membership?.role !== BoardMemberRole.ADMIN
    ) {
      return { error: "Bạn không có quyền xóa bình luận của người khác." };
    }

    // Xóa các thông báo chưa đọc liên quan đến bình luận này
    await db.notification.deleteMany({
      where: {
        commentId: existingComment.id,
        readAt: null,
      },
    });

    const replyCount = await db.cardComment.count({
      where: {
        parentId: existingComment.id,
      },
    });

    comment = await db.cardComment.delete({
      where: {
        id: existingComment.id,
      },
    });

    await triggerCommentDeleted({
      boardId,
      cardId,
      actorUserId: userId,
      comment,
      deletedCount: 1 + replyCount,
    });
  } catch {
    return { error: "Xóa bình luận thất bại." };
  }

  return { data: comment };
};

export const deleteCardComment = createSafeAction(DeleteCardComment, handler);
