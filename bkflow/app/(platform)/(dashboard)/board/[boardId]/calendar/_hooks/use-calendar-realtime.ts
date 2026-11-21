"use client";

import { useCallback, useRef, type RefObject } from "react";
import type { AppRouterInstance } from "@/web/shims/next-navigation";
import { toast } from "sonner";

import { realtimeChannels } from "@/lib/realtime/channels";
import { tr } from "@/lib/i18n";
import { isRealtimeClientConfigured } from "@/lib/realtime/client";

import type {
  BoardCalendarAccessPayload,
  BoardCalendarRealtimePayload,
} from "../_types";

type CalendarCardModal = {
  onClose: () => void;
};

type UseCalendarRealtimeOptions = {
  boardId: string;
  currentUserId: string;
  router: AppRouterInstance;
  cardModal: CalendarCardModal;
  invalidateBoardCalendar: () => void;
  lastLocalUpdate: RefObject<{ boardId: string; cardId: string; updatedAt: string } | null>;
};

export const useCalendarRealtime = ({
  boardId,
  currentUserId,
  router,
  cardModal,
  invalidateBoardCalendar,
  lastLocalUpdate,
}: UseCalendarRealtimeOptions) => {
  const processedRealtimeEventIdsRef = useRef<Set<string>>(new Set());
  const realtimeChannelName = realtimeChannels.board(boardId);
  const realtimeEnabled = isRealtimeClientConfigured();

  const processRealtimeEvent = useCallback((
    payload: BoardCalendarRealtimePayload,
    options: { skipOwnEcho?: boolean } = {},
  ) => {
    if (payload.boardId !== boardId) {
      return false;
    }

    if (processedRealtimeEventIdsRef.current.has(payload.eventId)) {
      return false;
    }

    processedRealtimeEventIdsRef.current.add(payload.eventId);

    return options.skipOwnEcho === false || payload.actorUserId !== currentUserId;
  }, [boardId, currentUserId]);

  const handleCalendarRealtime = useCallback((payload: BoardCalendarRealtimePayload) => {
    if (!processRealtimeEvent(payload, { skipOwnEcho: false })) {
      return;
    }

    // Một cache có revision mới có thể đã tải trước cache còn lại, kể cả khi thao tác đến từ tab khác.
    const local = lastLocalUpdate.current;
    if (
      local &&
      payload.actorUserId === currentUserId &&
      payload.boardId === local.boardId &&
      payload.cardId === local.cardId &&
      payload.updatedAt === local.updatedAt
    ) {
      return;
    }

    invalidateBoardCalendar();
  }, [currentUserId, invalidateBoardCalendar, lastLocalUpdate, processRealtimeEvent]);

  const handleCalendarRealtimeWithRefresh = useCallback((payload: BoardCalendarRealtimePayload) => {
    if (!processRealtimeEvent(payload, { skipOwnEcho: false })) {
      return;
    }

    router.refresh();
  }, [processRealtimeEvent, router]);

  const handleBoardDeletedRealtime = useCallback((payload: BoardCalendarAccessPayload) => {
    if (!processRealtimeEvent(payload, { skipOwnEcho: false })) {
      return;
    }

    toast.error(tr("calendar.toast.boardDeleted"));
    cardModal.onClose();
    router.push("/my/today");
  }, [cardModal, processRealtimeEvent, router]);

  const handleAccessRevokedRealtime = useCallback((payload: BoardCalendarAccessPayload) => {
    if (!processRealtimeEvent(payload, { skipOwnEcho: false })) {
      return;
    }

    if (payload.targetUserId === currentUserId) {
      toast.error(tr("calendar.toast.accessRevoked"));
      cardModal.onClose();
      router.push("/my/today");
      return;
    }

    if (payload.actorUserId === currentUserId) {
      return;
    }

    router.refresh();
  }, [cardModal, currentUserId, processRealtimeEvent, router]);

  return {
    realtimeChannelName,
    realtimeEnabled,
    handleCalendarRealtime,
    handleCalendarRealtimeWithRefresh,
    handleBoardDeletedRealtime,
    handleAccessRevokedRealtime,
  };
};
