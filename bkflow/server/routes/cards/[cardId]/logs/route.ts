import { auth } from "@/server/clerk";
import { db } from "@/lib/db";
import { requireBoardMember } from "@/lib/permissions";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ cardId: string }> }
) {
  try {
    const { cardId } = await params;
    const { userId, orgId } = await auth();

    if (!userId || !orgId) {
      return new Response("Unauthorized", { status: 401 });
    }

    const card = await db.card.findUnique({
      where: {
        id: cardId,
        list: {
          board: {
            orgId,
          },
        },
      },
      select: {
        list: {
          select: {
            boardId: true,
          },
        },
      },
    });

    if (!card) {
      return new Response("Not Found", { status: 404 });
    }

    const permission = await requireBoardMember({
      boardId: card.list.boardId,
      orgId,
      userId,
    });

    if (permission.error) {
      return new Response(permission.error, { status: 403 });
    }

    const auditLogs = await db.auditLog.findMany({
      where: {
        orgId,
        OR: [
          {
            cardId,
          },
          {
            entityId: cardId,
          },
        ],
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 30,
    });

    return Response.json(auditLogs);
  } catch {
    return new Response("Internal Error", { status: 500 });
  }
}
