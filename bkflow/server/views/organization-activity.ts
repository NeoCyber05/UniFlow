import { AUDIT_EVENT_TYPE, Prisma } from "@prisma/client";

import { db } from "@/lib/db";

export type ActivitySearchParams = Record<string, string | undefined>;

const validRanges = new Set(["today", "7d", "30d", "all", "custom"]);

const parseEventTypes = (value?: string): AUDIT_EVENT_TYPE[] => {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((val) => val.trim())
    .filter((val) => Object.values(AUDIT_EVENT_TYPE).includes(val as AUDIT_EVENT_TYPE)) as AUDIT_EVENT_TYPE[];
};

const parseDateParam = (value?: string) => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
};

const getCreatedAtFilter = (
  range: string,
  from?: string,
  to?: string,
): Prisma.DateTimeFilter | undefined => {
  const now = new Date();

  if (range === "all") {
    return undefined;
  }

  if (range === "today") {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return {
      gte: start,
      lte: now,
    };
  }

  if (range === "7d" || range === "30d") {
    const days = range === "7d" ? 7 : 30;
    const start = new Date(now);
    start.setDate(start.getDate() - days);

    return {
      gte: start,
      lte: now,
    };
  }

  if (range === "custom") {
    const fromDate = parseDateParam(from);
    const toDate = parseDateParam(to);

    if (!fromDate && !toDate) {
      return undefined;
    }

    if (toDate) {
      toDate.setHours(23, 59, 59, 999);
    }

    return {
      ...(fromDate ? { gte: fromDate } : {}),
      ...(toDate ? { lte: toDate } : {}),
    };
  }

  return undefined;
};

// Data of app/(platform)/(dashboard)/organization/[organizationId]/activity/page.tsx + _components/activity-list.tsx.
export const loadOrganizationActivity = async (
  resolvedSearchParams: ActivitySearchParams,
  userId: string | null,
  orgId: string | null,
) => {
  const parsedPage = resolvedSearchParams.page ? parseInt(resolvedSearchParams.page, 10) : 1;
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const boardId = resolvedSearchParams.boardId;
  const eventType = resolvedSearchParams.eventType;
  const userIdParam = resolvedSearchParams.userId;
  const { range, from, to, q } = resolvedSearchParams;
  const currentUserId = userId;

  if (!orgId || !currentUserId) {
    return { redirect: "/select-org" } as const;
  }

  const itemsPerPage = 50;
  const selectedRange = range && validRanges.has(range) ? range : "30d";
  const selectedEventTypes = parseEventTypes(eventType);
  const boards = await db.board.findMany({
    where: {
      orgId,
      members: {
        some: {
          userId: currentUserId,
        },
      },
    },
    select: {
      id: true,
      title: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
  const boardIds = boardId ? boardId.split(",") : [];
  const validBoardIds = boards
    .map((b) => b.id)
    .filter((id) => boardIds.includes(id));

  const actorBaseWhere: Prisma.AuditLogWhereInput = {
    orgId,
    boardId: {
      in: validBoardIds.length > 0 ? validBoardIds : boards.map((b) => b.id),
    },
  };
  const actors = await db.auditLog.findMany({
    where: actorBaseWhere,
    distinct: ["userId"],
    select: {
      userId: true,
      userName: true,
      userImage: true,
    },
    orderBy: {
      userName: "asc",
    },
  });
  const userIds = userIdParam ? userIdParam.split(",") : [];
  const validUserIds = actors
    .map((actor) => actor.userId)
    .filter((id) => userIds.includes(id));

  const createdAt = getCreatedAtFilter(selectedRange, from, to);
  const search = q?.trim();
  const normalizedParams = {
    boardId: validBoardIds.length > 0 ? validBoardIds.join(",") : undefined,
    eventType: selectedEventTypes.length > 0 ? selectedEventTypes.join(",") : undefined,
    userId: validUserIds.length > 0 ? validUserIds.join(",") : undefined,
    range: selectedRange === "30d" && !range ? undefined : selectedRange,
    from: selectedRange === "custom" ? from : undefined,
    to: selectedRange === "custom" ? to : undefined,
    q: search || undefined,
  };
  const where: Prisma.AuditLogWhereInput = {
    orgId,
    boardId: {
      in: validBoardIds.length > 0 ? validBoardIds : boards.map((b) => b.id),
    },
    ...(selectedEventTypes.length > 0 ? { eventType: { in: selectedEventTypes } } : {}),
    ...(validUserIds.length > 0 ? { userId: { in: validUserIds } } : {}),
    ...(createdAt ? { createdAt } : {}),
    ...(search ? {
      AND: [
        {
          OR: [
            {
              entityTitle: {
                contains: search,
              },
            },
            {
              userName: {
                contains: search,
              },
            },
          ],
        },
      ],
    } : {}),
  };

  const totalLogs = await db.auditLog.count({
    where,
  });

  const totalPages = Math.ceil(totalLogs / itemsPerPage);

  const auditLogs = await db.auditLog.findMany({
    where,
    orderBy: {
      createdAt: "desc",
    },
    skip: (page - 1) * itemsPerPage,
    take: itemsPerPage,
  });
  const cardIds = Array.from(
    new Set(
      auditLogs
        .map((log) => log.cardId || (log.entityType === "CARD" ? log.entityId : null))
        .filter(Boolean)
    )
  ) as string[];
  const checklistIds = Array.from(
    new Set(
      auditLogs
        .filter((log) => log.entityType === "CHECKLIST")
        .map((log) => log.entityId)
    )
  );
  const checklistItemIds = Array.from(
    new Set(
      auditLogs
        .filter((log) => log.entityType === "CHECKLIST_ITEM")
        .map((log) => log.entityId)
    )
  );
  const accessibleBoardIds = boards.map((board) => board.id);
  const existingCards = cardIds.length > 0
    ? await db.card.findMany({
        where: {
          id: {
            in: cardIds,
          },
          list: {
            board: {
              orgId,
            },
          },
        },
        select: {
          id: true,
          title: true,
          archivedAt: true,
          list: {
            select: {
              archivedAt: true,
            },
          },
        },
      })
    : [];
  const existingChecklists = checklistIds.length > 0
    ? await db.checklist.findMany({
        where: {
          id: {
            in: checklistIds,
          },
          card: {
            list: {
              board: {
                id: {
                  in: accessibleBoardIds,
                },
                orgId,
              },
            },
          },
        },
        select: {
          id: true,
        },
      })
    : [];
  const existingChecklistItems = checklistItemIds.length > 0
    ? await db.checklistItem.findMany({
        where: {
          id: {
            in: checklistItemIds,
          },
          checklist: {
            card: {
              list: {
                board: {
                  id: {
                    in: accessibleBoardIds,
                  },
                  orgId,
                },
              },
            },
          },
        },
        select: {
          id: true,
        },
      })
    : [];
  const cardMap = new Map(
    existingCards.map((card) => [
      card.id,
      {
        title: card.title,
        isArchived: card.archivedAt !== null || card.list.archivedAt !== null,
      },
    ])
  );
  const boardMap = new Map(boards.map((board) => [board.id, board.title]));

  const boardMembers = await db.boardMember.findMany({
    where: {
      board: {
        orgId,
      },
    },
    select: {
      userName: true,
    },
  });
  const memberNames = Array.from(
    new Set([
      ...actors.map((actor) => actor.userName),
      ...boardMembers.map((member) => member.userName),
    ])
  ).filter(Boolean);

  const lists = await db.list.findMany({
    where: {
      archivedAt: null,
      board: {
        orgId,
      },
    },
    select: {
      id: true,
    },
  });
  const existingListIds = new Set(lists.map((list) => list.id));
  const existingChecklistIds = new Set(existingChecklists.map((checklist) => checklist.id));
  const existingChecklistItemIds = new Set(existingChecklistItems.map((item) => item.id));

  const hasExplicitFilter = Boolean(
    validBoardIds.length > 0 ||
    selectedEventTypes.length > 0 ||
    validUserIds.length > 0 ||
    range ||
    from ||
    to ||
    search,
  );

  return {
    page,
    boards,
    actors,
    validBoardIds,
    selectedEventTypes,
    validUserIds,
    selectedRange,
    search,
    hasExplicitFilter,
    totalPages,
    normalizedParams,
    auditLogs,
    cardMap,
    boardMap,
    existingListIds,
    existingChecklistIds,
    existingChecklistItemIds,
    memberNames,
  } as const;
};
