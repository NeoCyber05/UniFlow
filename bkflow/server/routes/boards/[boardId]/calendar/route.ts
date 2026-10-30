import { deadlineWhere } from "@/lib/cards/task-deadline";
import { getVNDay, getVNDayKey } from "@/lib/my-tasks/vn-day";
import { serializeTaskDates } from "@/lib/cards/task-schedule-storage";
import { auth } from "@/server/auth";

import { db } from "@/lib/db";
import { requireBoardMember } from "@/lib/permissions";
import type {
  BoardCalendarCardItem,
  BoardCalendarChecklistItem,
  BoardCalendarItem,
  BoardCalendarResponse,
  BoardCalendarUnscheduledCard,
} from "@/types";

const MAX_RANGE_DAYS = 370;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

const parseRequiredDateParam = (
  searchParams: URLSearchParams,
  key: "from" | "to",
) => {
  const value = searchParams.get(key);

  if (!value) {
    return {
      error: `Missing required "${key}" query parameter.`,
      date: null,
    };
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return {
      error: `Invalid "${key}" query parameter. Use an ISO date string.`,
      date: null,
    };
  }

  return {
    error: null,
    date,
  };
};

const getEffectiveStartTime = (item: BoardCalendarItem) => {
  const effectiveDate = item.type === "card"
    ? item.scheduledStartAt ?? item.scheduledOn ?? item.startDate ?? item.dueDate ?? item.deadlineOn
    : item.dueDate;

  return effectiveDate ? new Date(effectiveDate).getTime() : 0;
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ boardId: string }> },
) {
  try {
    const { boardId } = await params;
    const { userId } = await auth();

    if (!userId) {
      return new Response("Unauthorized", { status: 401 });
    }

    const fromResult = parseRequiredDateParam(
      new URL(request.url).searchParams,
      "from",
    );
    const toResult = parseRequiredDateParam(
      new URL(request.url).searchParams,
      "to",
    );

    if (fromResult.error) {
      return Response.json({ error: fromResult.error }, { status: 400 });
    }

    if (toResult.error) {
      return Response.json({ error: toResult.error }, { status: 400 });
    }

    const from = fromResult.date;
    const to = toResult.date;
    const includeUnscheduled =
      new URL(request.url).searchParams.get("includeUnscheduled") === "true";

    if (!from || !to) {
      return Response.json(
        { error: "Invalid calendar date range." },
        { status: 400 },
      );
    }

    if (from.getTime() > to.getTime()) {
      return Response.json(
        { error: '"from" must be before or equal to "to".' },
        { status: 400 },
      );
    }

    if (to.getTime() - from.getTime() > MAX_RANGE_DAYS * DAY_IN_MS) {
      return Response.json(
        { error: `Calendar range cannot exceed ${MAX_RANGE_DAYS} days.` },
        { status: 400 },
      );
    }

    const dayColumn = (date: Date) => new Date(`${getVNDayKey(getVNDay(date))}T00:00:00.000Z`);
    // `to` là biên mở: timestamp so `< to`, ngày (SQL DATE) so theo ngày VN của mili-giây cuối.
    const lastMoment = new Date(to.getTime() - 1);
    const fromDay = dayColumn(from);
    const toDay = dayColumn(lastMoment);

    // The ownership check runs alongside the queries, which are all scoped to the user's own board.
    const [permission, cards, checklistItems, unscheduledCards] = await Promise.all([
      requireBoardMember({ boardId, userId }),
      db.card.findMany({
        where: {
          archivedAt: null,
          list: {
            archivedAt: null,
            board: {
              id: boardId,
              userId,
            },
          },
          OR: [
            // Hạn nộp (cả dueDate lẫn deadlineOn) nằm trong khoảng.
            deadlineWhere({ gte: from, lte: lastMoment }),
            // Lịch làm: khoảng giờ giao khoảng xem, hoặc ngày làm chỉ-ngày trong khoảng.
            {
              scheduledStartAt: { lt: to },
              scheduledEndAt: { gt: from },
            },
            {
              scheduledOn: {
                gte: fromDay,
                lte: toDay,
              },
            },
            {
              startDate: {
                gte: from,
                lt: to,
              },
            },
            {
              AND: [
                {
                  startDate: {
                    not: null,
                    lt: to,
                  },
                },
                {
                  dueDate: {
                    not: null,
                    gte: from,
                  },
                },
              ],
            },
          ],
        },
        select: {
          id: true,
          title: true,
          order: true,
          startDate: true,
          dueDate: true,
          deadlineOn: true,
          scheduledOn: true,
          scheduledStartAt: true,
          scheduledEndAt: true,
          updatedAt: true,
          isCompleted: true,
          reminder: true,
          listId: true,
          courseId: true,
          userStates: {
            where: {
              userId,
            },
            select: {
              isImportant: true,
            },
          },
          list: {
            select: {
              title: true,
              order: true,
            },
          },
          labels: {
            select: {
              label: {
                select: {
                  id: true,
                  title: true,
                  color: true,
                },
              },
            },
            orderBy: {
              createdAt: "asc",
            },
          },
          _count: {
            select: {
              comments: true,
            },
          },
        },
      }),
      db.checklistItem.findMany({
        where: {
          dueDate: {
            gte: from,
            lt: to,
          },
          checklist: {
            card: {
              archivedAt: null,
              list: {
                archivedAt: null,
                board: {
                  id: boardId,
                  userId,
                },
              },
            },
          },
        },
        select: {
          id: true,
          title: true,
          dueDate: true,
          isCompleted: true,
          order: true,
          checklistId: true,
          checklist: {
            select: {
              title: true,
              order: true,
              cardId: true,
              card: {
                select: {
                  id: true,
                  title: true,
                  order: true,
                  listId: true,
                  courseId: true,
                  userStates: {
                    where: {
                      userId,
                    },
                    select: {
                      isImportant: true,
                    },
                  },
                  list: {
                    select: {
                      title: true,
                      order: true,
                    },
                  },
                  labels: {
                    select: {
                      label: {
                        select: {
                          id: true,
                          title: true,
                          color: true,
                        },
                      },
                    },
                    orderBy: {
                      createdAt: "asc",
                    },
                  },
                },
              },
            },
          },
        },
      }),
      includeUnscheduled
        ? db.card.findMany({
            where: {
              archivedAt: null,
              // Khay chưa xếp = chưa có lịch làm (hạn nộp không tính).
              scheduledOn: null,
              scheduledStartAt: null,
              list: {
                archivedAt: null,
                board: {
                  id: boardId,
                  userId,
                },
              },
            },
            select: {
              id: true,
              title: true,
              order: true,
              isCompleted: true,
              updatedAt: true,
              dueDate: true,
              deadlineOn: true,
              listId: true,
              courseId: true,
              userStates: {
                where: {
                  userId,
                },
                select: {
                  isImportant: true,
                },
              },
              list: {
                select: {
                  title: true,
                  order: true,
                },
              },
              labels: {
                select: {
                  label: {
                    select: {
                      id: true,
                      title: true,
                      color: true,
                    },
                  },
                },
                orderBy: {
                  createdAt: "asc",
                },
              },
              _count: {
                select: {
                  comments: true,
                },
              },
            },
            orderBy: [
              {
                list: {
                  order: "asc",
                },
              },
              {
                order: "asc",
              },
            ],
          })
        : Promise.resolve([]),
    ]);

    if (permission.error) {
      return new Response(permission.error, { status: 403 });
    }

    const cardItems = cards.map((card) => ({
      item: {
        type: "card" as const,
        id: `card:${card.id}`,
        cardId: card.id,
        boardId,
        listId: card.listId,
        listTitle: card.list.title,
        courseId: card.courseId,
        isImportant: card.userStates[0]?.isImportant ?? false,
        title: card.title,
        startDate: card.startDate?.toISOString() ?? null,
        ...serializeTaskDates(card),
        updatedAt: card.updatedAt.toISOString(),
        isCompleted: card.isCompleted,
        reminder: card.reminder,
        labels: card.labels.map(({ label }) => ({
          id: label.id,
          title: label.title,
          color: label.color,
        })),
        assignees: [],
        commentCount: card._count.comments,
      } satisfies BoardCalendarCardItem,
      listOrder: card.list.order,
      cardOrder: card.order,
      checklistOrder: -1,
      checklistItemOrder: -1,
    }));

    const checklistCalendarItems = checklistItems.flatMap((item) => {
      if (!item.dueDate) {
        return [];
      }

      return [{
        item: {
          type: "checklist-item" as const,
          id: `checklist-item:${item.id}`,
          checklistItemId: item.id,
          checklistId: item.checklistId,
          checklistTitle: item.checklist.title,
          cardId: item.checklist.cardId,
          cardTitle: item.checklist.card.title,
          boardId,
          listId: item.checklist.card.listId,
          listTitle: item.checklist.card.list.title,
          courseId: item.checklist.card.courseId,
          isImportant: item.checklist.card.userStates[0]?.isImportant ?? false,
          title: item.title,
          dueDate: item.dueDate.toISOString(),
          isCompleted: item.isCompleted,
          assignee: null,
          labels: item.checklist.card.labels.map(({ label }) => ({
            id: label.id,
            title: label.title,
            color: label.color,
          })),
        } satisfies BoardCalendarChecklistItem,
        listOrder: item.checklist.card.list.order,
        cardOrder: item.checklist.card.order,
        checklistOrder: item.checklist.order,
        checklistItemOrder: item.order,
      }];
    });

    const items: BoardCalendarItem[] = [...cardItems, ...checklistCalendarItems]
      .sort((left, right) => {
        const startDelta =
          getEffectiveStartTime(left.item) - getEffectiveStartTime(right.item);

        if (startDelta !== 0) {
          return startDelta;
        }

        if (left.item.isCompleted !== right.item.isCompleted) {
          return left.item.isCompleted ? 1 : -1;
        }

        if (left.item.type !== right.item.type) {
          return left.item.type === "card" ? -1 : 1;
        }

        return left.listOrder - right.listOrder ||
          left.cardOrder - right.cardOrder ||
          left.checklistOrder - right.checklistOrder ||
          left.checklistItemOrder - right.checklistItemOrder;
      })
      .map(({ item }) => item);

    const mappedUnscheduledCards: BoardCalendarUnscheduledCard[] = unscheduledCards
      .map((card) => ({
        type: "unscheduled-card" as const,
        dueDate: card.dueDate?.toISOString() ?? null,
        deadlineOn: card.deadlineOn?.toISOString().slice(0, 10) ?? null,
        id: `unscheduled-card:${card.id}`,
        cardId: card.id,
        boardId,
        listId: card.listId,
        listTitle: card.list.title,
        courseId: card.courseId,
        isImportant: card.userStates[0]?.isImportant ?? false,
        title: card.title,
        updatedAt: card.updatedAt.toISOString(),
        isCompleted: card.isCompleted,
        labels: card.labels.map(({ label }) => ({
          id: label.id,
          title: label.title,
          color: label.color,
        })),
        assignees: [],
        commentCount: card._count.comments,
        order: card.order,
        listOrder: card.list.order,
      }));

    const response: BoardCalendarResponse = {
      boardId,
      from: from.toISOString(),
      to: to.toISOString(),
      items,
      unscheduledCards: mappedUnscheduledCards,
    };

    return Response.json(response);
  } catch (error) {
    console.error("[BOARD_CALENDAR_GET_ERROR]", error);
    return new Response("Internal Error", { status: 500 });
  }
}
