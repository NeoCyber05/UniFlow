"use server";

import { auth, currentUser } from "@/server/auth";
import { CardComment, NOTIFICATION_TYPE } from "@prisma/client";

import { createNotifications } from "@/lib/notifications/create-notification";
import { createSafeAction } from "@/lib/create-safe-action";
import { db } from "@/lib/db";
import { requireBoardEditor } from "@/lib/permissions";
import { triggerCommentCreated } from "@/lib/comments/realtime";

import { CreateCardComment } from "./schema";
import { InputType, ReturnType } from "./types";

const handler = async (data: InputType): Promise<ReturnType> => {
  const { userId } = await auth();
  const user = await currentUser();

  if (!userId || !user) {
    return { error: "Không có quyền truy cập." };
  }

  const { boardId, cardId, parentId } = data;
  const content = data.content.trim();
  let comment: CardComment;
  let parentComment:
    | {
      id: string;
      parentId: string | null;
      userId: string;
    }
    | null = null;

  if (!content) {
    return { error: "Vui lòng nhập nội dung bình luận." };
  }

  try {
    const permission = await requireBoardEditor({ boardId, userId });

    if (permission.error) {
      return { error: permission.error };
    }

    const card = await db.card.findUnique({
      where: {
        id: cardId,
        list: {
          board: {
            id: boardId,
            userId,
          },
        },
      },
      select: {
        id: true,
        title: true,
        list: {
          select: {
            title: true,
            board: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        },
      },
    });

    if (!card) {
      return { error: "Không tìm thấy thẻ." };
    }

    if (parentId) {
      parentComment = await db.cardComment.findUnique({
        where: {
          id: parentId,
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
          parentId: true,
          userId: true,
        },
      });

      if (!parentComment) {
        return { error: "Không tìm thấy bình luận gốc." };
      }

      if (parentComment.parentId) {
        return { error: "Chỉ hỗ trợ trả lời một cấp." };
      }
    }

    comment = await db.cardComment.create({
      data: {
        cardId,
        content,
        parentId: parentId || null,
        userId,
        userName: user.fullName || user.username || user.primaryEmailAddress?.emailAddress || "Người dùng",
        userImage: user.imageUrl,
      },
    });

    const recipientIds = new Set<string>();
    const notifications = [];
    const actor = {
      userId,
      name: user.fullName || user.username || user.primaryEmailAddress?.emailAddress || "Thành viên",
      image: user.imageUrl,
    };

    if (parentComment && parentComment.userId !== userId) {
      recipientIds.add(parentComment.userId);
      notifications.push({ recipientUserId: parentComment.userId,
        actor,
        type: NOTIFICATION_TYPE.COMMENT_REPLY,
        title: "Có phản hồi mới",
        message: `${actor.name} đã trả lời bình luận của bạn trong thẻ "${card.title}".`,
        boardId: card.list.board.id,
        boardTitle: card.list.board.title,
        cardId: card.id,
        cardTitle: card.title,
        listTitle: card.list.title,
        commentId: comment.id,
      });
    }

    if (notifications.length > 0) {
      await createNotifications(notifications);
    }

    await triggerCommentCreated({
      boardId,
      cardId,
      actorUserId: userId,
      comment,
    });
  } catch {
    return { error: "Tạo bình luận thất bại." };
  }

  return { data: comment };
};

export const createCardComment = createSafeAction(CreateCardComment, handler);
