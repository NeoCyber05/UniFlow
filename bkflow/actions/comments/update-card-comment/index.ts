"use server";

import { auth, currentUser } from "@/server/auth";

import { createSafeAction } from "@/lib/create-safe-action";
import { db } from "@/lib/db";
import { requireBoardEditor } from "@/lib/permissions";
import { triggerCommentUpdated } from "@/lib/comments/realtime";

import { UpdateCardComment } from "./schema";
import { InputType, ReturnType } from "./types";

const handler = async (data: InputType): Promise<ReturnType> => {
  const { userId } = await auth();
  const user = await currentUser();

  if (!userId || !user) {
    return { error: "Không có quyền truy cập." };
  }

  const { boardId, cardId, commentId } = data;
  const content = data.content.trim();
  let comment;

  if (!content) {
    return { error: "Vui lòng nhập nội dung bình luận." };
  }

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
      select: {
        id: true,
        userId: true,
        content: true,
        cardId: true,
        parentId: true,
        userName: true,
        userImage: true,
        createdAt: true,
        updatedAt: true,
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

    if (existingComment.userId !== userId) {
      return { error: "Bạn chỉ có thể chỉnh sửa bình luận của mình." };
    }

    if (existingComment.content === content) {
      comment = existingComment;
    } else {
      comment = await db.cardComment.update({
        where: {
          id: existingComment.id,
        },
        data: {
          content,
        },
      });

      await triggerCommentUpdated({
        boardId,
        cardId,
        actorUserId: userId,
        comment,
      });
    }
  } catch {
    return { error: "Cập nhật bình luận thất bại." };
  }

  return { data: comment };
};

export const updateCardComment = createSafeAction(UpdateCardComment, handler);
