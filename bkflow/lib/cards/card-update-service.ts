import { ENTITY_TYPE, type Card, type Prisma } from "@prisma/client";

import type {
  UpdateCardInput,
  UpdateCardResult,
} from "@/lib/cards/update-card-contract";
import { createAuditLog } from "@/lib/create-audit-log";
import { db } from "@/lib/db";
import { syncCardReminder } from "@/lib/notifications/reminder-deliveries";
import { deleteCardReminderNotifications } from "@/lib/notifications/reminder-notifications";
import { checkBoardOwnership } from "@/lib/permissions";
import {
  triggerCardUpdated,
  triggerRelatedDependencyCardsUpdated,
} from "@/lib/cards/realtime";
import {
  buildUpdateCardAuditMessage,
  getUpdateCardAuditEventType,
  UPDATE_CARD_AUDIT_ACTION,
} from "@/lib/cards/card-audit-messages";
import {
  buildCardUpdateData,
  getChangedCardFields,
  getEffectiveCardDates,
  hasDateChanged,
  shouldDeleteReminderNotifications,
  validateCardDateRange,
  validateReminderConfig,
} from "@/lib/cards/card-date-rules";
import { validateTaskSchedule } from "@/lib/cards/task-schedule";
import {
  toTaskDeadlineStorage,
  toTaskScheduleStorage,
} from "@/lib/cards/task-schedule-storage";

type UpdateCardServiceInput = {
  data: UpdateCardInput;
  userId: string;
  orgId?: string;
};

/** Ranh giới tác dụng phụ, để test thay bằng mock. */
export type CardUpdateEffects = {
  createAuditLog: typeof createAuditLog;
  triggerCardUpdated: typeof triggerCardUpdated;
  triggerRelatedDependencyCardsUpdated: typeof triggerRelatedDependencyCardsUpdated;
  deleteCardReminderNotifications: typeof deleteCardReminderNotifications;
  syncCardReminder: typeof syncCardReminder;
};

const defaultEffects: CardUpdateEffects = {
  createAuditLog,
  triggerCardUpdated,
  triggerRelatedDependencyCardsUpdated,
  deleteCardReminderNotifications,
  syncCardReminder,
};

export const DESCRIPTION_CONFLICT_ERROR_CODE = "DESCRIPTION_CONFLICT";
export const DESCRIPTION_CONFLICT_ERROR_MESSAGE =
  "Dữ liệu đã được cập nhật bởi một thành viên khác. Vui lòng lưu và reload lại.";
export const CARD_CONFLICT_ERROR_CODE = "CARD_CONFLICT";
export const CARD_CONFLICT_ERROR_MESSAGE =
  "Thẻ đã được cập nhật ở nơi khác. Vui lòng tải lại rồi thử lại.";

export const updateCardService = async (
  { data, userId }: UpdateCardServiceInput,
  database: typeof db = db,
  effects: CardUpdateEffects = defaultEffects,
): Promise<UpdateCardResult> => {
  const {
    id,
    boardId,
    startDate,
    dueDate,
    deadlineOn,
    scheduledOn,
    scheduledStartAt,
    scheduledEndAt,
    isCompleted,
    reminder,
    dueDateTimezoneOffset,
    descriptionBaseUpdatedAt,
    expectedUpdatedAt,
    ...values
  } = data;
  let card: Card;

  try {
    const permission = await checkBoardOwnership(boardId, userId, database);

    if (permission.error) {
      return { error: permission.error };
    }

    const cardWhere = {
      id,
      archivedAt: null,
      list: {
        archivedAt: null,
        board: {
          id: boardId,
          userId,
        },
      },
    };

    const currentCard = await database.card.findFirst({ where: cardWhere });

    if (!currentCard) {
      return {
        error: "Không tìm thấy thẻ.",
      };
    }

    // Hạn dạng giờ (dueDate) và hạn chỉ-ngày (deadlineOn) loại trừ nhau.
    if (dueDate && deadlineOn) {
      return { error: "Hạn nộp chỉ có ngày hoặc có giờ, không đồng thời." };
    }

    const deadlineOnDate = deadlineOn === undefined
      ? undefined
      : toTaskDeadlineStorage({ dueDate: null, deadlineOn }).deadlineOn as Date | null;
    const nextDueDate = deadlineOnDate ? null : dueDate;
    const nextDeadlineOn = dueDate ? null : deadlineOnDate;

    // Lịch làm được thay nguyên khối: trường không gửi coi như bỏ.
    const scheduleTouched = scheduledOn !== undefined ||
      scheduledStartAt !== undefined ||
      scheduledEndAt !== undefined;
    let scheduleStorage: ReturnType<typeof toTaskScheduleStorage> | null = null;

    if (scheduleTouched) {
      const nextSchedule = {
        scheduledOn: scheduledOn ?? null,
        scheduledStartAt: scheduledStartAt ?? null,
        scheduledEndAt: scheduledEndAt ?? null,
      };
      const scheduleError = validateTaskSchedule(nextSchedule);

      if (scheduleError) {
        return { error: scheduleError };
      }

      scheduleStorage = toTaskScheduleStorage(nextSchedule);
    }

    const startDateChanged = hasDateChanged(startDate, currentCard.startDate);
    const dueDateChanged = hasDateChanged(nextDueDate, currentCard.dueDate);
    const deadlineOnChanged = hasDateChanged(
      nextDeadlineOn as Date | null | undefined,
      currentCard.deadlineOn,
    );
    const scheduledOnChanged = scheduleStorage
      ? hasDateChanged(scheduleStorage.scheduledOn as Date | null, currentCard.scheduledOn)
      : false;
    const scheduledStartChanged = scheduleStorage
      ? hasDateChanged(scheduleStorage.scheduledStartAt as Date | null, currentCard.scheduledStartAt)
      : false;
    const scheduledEndChanged = scheduleStorage
      ? hasDateChanged(scheduleStorage.scheduledEndAt as Date | null, currentCard.scheduledEndAt)
      : false;
    const scheduleChanged = scheduledOnChanged || scheduledStartChanged || scheduledEndChanged;
    const deadlineChanged = dueDateChanged || deadlineOnChanged;
    const reminderChanged = reminder !== undefined && reminder !== currentCard.reminder;
    const reminderConfigChanged = deadlineChanged || reminderChanged;
    const { effectiveStartDate, effectiveDueDate } = getEffectiveCardDates({
      startDate,
      dueDate: nextDueDate,
      currentCard,
    });

    // Chỉ kiểm tra khoảng start/due legacy khi chính request này đổi chúng;
    // dữ liệu legacy cũ không được chặn các thao tác không liên quan.
    if (startDate !== undefined) {
      const dateRangeError = validateCardDateRange(
        effectiveStartDate,
        effectiveDueDate,
      );

      if (dateRangeError) {
        return { error: dateRangeError };
      }
    }

    if (reminderConfigChanged) {
      const effectiveReminder = reminder !== undefined
        ? reminder
        : currentCard.reminder;
      const reminderError = validateReminderConfig({
        dueDate: effectiveDueDate,
        deadlineOn: (nextDeadlineOn !== undefined ? nextDeadlineOn : currentCard.deadlineOn)
          ?.toISOString().slice(0, 10) ?? null,
        reminder: effectiveReminder,
      });

      if (reminderError) {
        return { error: reminderError };
      }
    }

    const deadlineCleared = deadlineChanged &&
      effectiveDueDate === null &&
      (nextDeadlineOn !== undefined ? nextDeadlineOn : currentCard.deadlineOn) === null;
    const changeInput = {
      ...values,
      startDate,
      dueDate: nextDueDate,
      isCompleted,
      reminder,
    };
    const changedFields = getChangedCardFields({
      input: changeInput,
      currentCard,
      startDateChanged,
      dueDateChanged,
      reminderChanged,
      reminderConfigChanged,
      deadlineCleared,
    });

    if (deadlineOnChanged) changedFields.push("deadlineOn");
    if (scheduledOnChanged) changedFields.push("scheduledOn");
    if (scheduledStartChanged) changedFields.push("scheduledStartAt");
    if (scheduledEndChanged) changedFields.push("scheduledEndAt");

    if (changedFields.length === 0) {
      return { data: currentCard };
    }

    const descriptionChanged = changedFields.includes("description");
    const metadataChanged = changedFields.some((field) => field !== "description");
    const metadataBase = expectedUpdatedAt ? new Date(expectedUpdatedAt) : null;
    let descriptionBaseDate: Date | null = null;

    if (metadataChanged && (!metadataBase || Number.isNaN(metadataBase.getTime()))) {
      return {
        error: CARD_CONFLICT_ERROR_MESSAGE,
        errorCode: CARD_CONFLICT_ERROR_CODE,
      };
    }

    if (descriptionChanged) {
      descriptionBaseDate = descriptionBaseUpdatedAt
        ? new Date(descriptionBaseUpdatedAt)
        : null;

      if (!descriptionBaseDate) {
        return {
          error: DESCRIPTION_CONFLICT_ERROR_MESSAGE,
          errorCode: DESCRIPTION_CONFLICT_ERROR_CODE,
        };
      }
    }

    const extra: Prisma.CardUpdateInput = {
      ...(nextDeadlineOn !== undefined ? { deadlineOn: nextDeadlineOn } : {}),
      ...(scheduleStorage
        ? {
          scheduledOn: scheduleStorage.scheduledOn,
          scheduledStartAt: scheduleStorage.scheduledStartAt,
          scheduledEndAt: scheduleStorage.scheduledEndAt,
        }
        : {}),
    };
    const updateData = buildCardUpdateData({
      input: changeInput,
      reminderConfigChanged,
      descriptionChanged,
      deadlineCleared,
      extra,
    });

    // CAS nằm trong chính câu ghi (cùng điều kiện quyền/task còn hoạt động).
    // Lịch nhắc đổi cùng transaction với hạn/trạng thái, để không có task đã đổi mà nhắc cũ còn sống.
    const updateResult = await database.$transaction(async (tx) => {
      const result = await tx.card.updateMany({
        where: {
          ...cardWhere,
          ...(metadataChanged && metadataBase ? { updatedAt: metadataBase } : {}),
          ...(descriptionChanged ? { descriptionUpdatedAt: descriptionBaseDate! } : {}),
        },
        data: updateData,
      });

      if (result.count > 0 && (reminderConfigChanged || isCompleted !== undefined)) {
        await effects.syncCardReminder(tx, { cardId: id, now: new Date() });
      }

      return result;
    });

    if (updateResult.count === 0) {
      const latest = await database.card.findFirst({ where: cardWhere });

      if (!latest) {
        return { error: "Không tìm thấy thẻ." };
      }

      const metadataStale = metadataChanged && metadataBase &&
        latest.updatedAt.getTime() !== metadataBase.getTime();

      return metadataStale || !descriptionChanged
        ? { error: CARD_CONFLICT_ERROR_MESSAGE, errorCode: CARD_CONFLICT_ERROR_CODE }
        : { error: DESCRIPTION_CONFLICT_ERROR_MESSAGE, errorCode: DESCRIPTION_CONFLICT_ERROR_CODE };
    }

    const updatedCard = await database.card.findFirst({ where: cardWhere });

    if (!updatedCard) {
      return {
        error: "Không tìm thấy thẻ.",
      };
    }

    card = updatedCard;

    if (
      shouldDeleteReminderNotifications({
        reminderConfigChanged,
        deadlineCleared,
        isCompleted,
      })
    ) {
      await effects.deleteCardReminderNotifications(card.id);
    }

    const auditLogMessage = buildUpdateCardAuditMessage({
      input: {
        ...values,
        startDate,
        dueDate: nextDueDate,
        isCompleted,
        dueDateTimezoneOffset,
      },
      card,
      currentCard,
      startDateChanged,
      dueDateChanged,
      deadlineOnChanged,
      scheduleChanged,
    });

    await effects.createAuditLog({
      entityTitle: auditLogMessage,
      entityId: card.id,
      entityType: ENTITY_TYPE.CARD,
      action: UPDATE_CARD_AUDIT_ACTION,
      eventType: getUpdateCardAuditEventType({
        startDateChanged,
        dueDateChanged,
        reminderConfigChanged,
        isCompleted,
        scheduleChanged,
      }),
      boardId,
      cardId: card.id,
    });

    await effects.triggerCardUpdated({
      boardId,
      cardId: card.id,
      actorUserId: userId,
      changedFields,
      card,
      updatedAt: card.updatedAt,
    });

    if (isCompleted !== undefined && isCompleted !== currentCard.isCompleted) {
      const dependencyCards = await database.cardDependency.findMany({
        where: {
          OR: [
            {
              blockerCardId: card.id,
            },
            {
              blockedCardId: card.id,
            },
          ],
        },
        select: {
          blockerCardId: true,
          blockedCardId: true,
        },
      });
      const relatedCardIds = dependencyCards.map((dependency) =>
        dependency.blockerCardId === card.id
          ? dependency.blockedCardId
          : dependency.blockerCardId,
      );

      await effects.triggerRelatedDependencyCardsUpdated({
        boardId,
        sourceCardId: card.id,
        relatedCardIds,
        actorUserId: userId,
      });
    }
  } catch {
    return {
      error: "Cập nhật thẻ thất bại.",
    };
  }

  return { data: card };
};
