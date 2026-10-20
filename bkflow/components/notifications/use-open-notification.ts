"use client";

import { useCallback } from "react";
import { tr } from "@/lib/i18n";
import { useRouter } from "@/web/shims/next-navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { NotificationItem } from "@/components/notifications/types";
import { useCardModal } from "@/hooks/use-card-modal";

const showCardOpenError = (status?: number) => {
  if (status === 404) {
    toast.error(tr("notif.openCardNotFound"));
    return;
  }

  if (status === 403) {
    toast.error(tr("notif.openCardNoAccess"));
    return;
  }

  toast.error(tr("notif.openCardError"));
};

const showBoardOpenError = (status?: number) => {
  if (status === 404) {
    toast.error(tr("notif.openBoardNotFound"));
    return;
  }

  if (status === 403) {
    toast.error(tr("notif.openBoardNoAccess"));
    return;
  }

  toast.error(tr("notif.openBoardError"));
};

export const useOpenNotification = () => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const openCardModal = useCardModal((state) => state.onOpen);

  return useCallback(
    async (notification: NotificationItem) => {
      if (notification.pageId) {
        router.push(`/pages/${encodeURIComponent(notification.pageId)}`);
        return;
      }

      if (notification.cardId) {
        try {
          const response = await fetch(`/api/cards/${notification.cardId}`);

          if (!response.ok) {
            showCardOpenError(response.status);
            return;
          }

          const data = await response.json();
          const boardId = data?.list?.boardId || notification.boardId;

          queryClient.setQueryData(["card", notification.cardId], data);

          if (boardId) {
            router.push(`/board/${boardId}?cardId=${notification.cardId}`);
            return;
          }

          openCardModal(notification.cardId);
        } catch {
          showCardOpenError();
        }

        return;
      }

      if (notification.boardId) {
        try {
          const response = await fetch(`/api/boards/${notification.boardId}`);

          if (!response.ok) {
            showBoardOpenError(response.status);
            return;
          }

          router.push(`/board/${notification.boardId}`);
        } catch {
          showBoardOpenError();
        }
      }
    },
    [openCardModal, queryClient, router],
  );
};
