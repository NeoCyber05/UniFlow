import { auth } from "@/server/auth";

import { db } from "@/lib/db";
import { requireBoardMember } from "@/lib/permissions";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ cardId: string }> },
) {
  try {
    const { cardId } = await params;
    const { userId } = await auth();

    if (!userId) {
      return new Response("Không có quyền truy cập.", { status: 401 });
    }

    const card = await db.card.findUnique({
      where: {
        id: cardId,
        list: {
          board: {
            userId,
          },
        },
      },
      select: {
        id: true,
        list: {
          select: {
            boardId: true,
          },
        },
      },
    });

    if (!card) {
      return new Response("Không tìm thấy thẻ.", { status: 404 });
    }

    const permission = await requireBoardMember({
      boardId: card.list.boardId,
      
      userId,
    });

    if (permission.error) {
      return new Response(permission.error, { status: 403 });
    }

    const comments = await db.cardComment.findMany({
      where: {
        cardId,
        parentId: null,
      },
      include: {
        reactions: {
          orderBy: {
            createdAt: "asc",
          },
        },
        replies: {
          include: {
            reactions: {
              orderBy: {
                createdAt: "asc",
              },
            },
          },
          orderBy: {
            createdAt: "asc",
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return Response.json(comments);
  } catch {
    return new Response("Lỗi máy chủ.", { status: 500 });
  }
}
