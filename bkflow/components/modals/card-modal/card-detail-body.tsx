"use client";
import { AiTaskHistory } from "@/components/ai-assistant/task-edit-controls";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AuditLog } from "@prisma/client";

import { CardCommentWithReplies, CardWithList } from "@/types";
import { fetcher } from "@/lib/fetcher";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DialogTitle, DialogDescription } from "@/components/ui/dialog";

import { Header } from "./header";
import { MetadataSection as Metadata } from "./metadata/metadata-section";
import { Description } from "./description";
import { Activity } from "./activity";
import { CommentsSection as Comments } from "./comments/comments-section";
import { ChecklistsSection as Checklists } from "./checklists/checklists-section";
import { AttachmentsSection as Attachments } from "./attachments/attachments-section";
import { useAssistantTask } from "@/hooks/use-assistant-task";
import { DependenciesSection as CardDependencies } from "./dependencies/dependencies-section";
import type { BeforeCloseRef } from "./close-guard";

const CardMainContent = ({
  cardData,
  canEdit,
  beforeCloseRef,
}: {
  cardData: CardWithList;
  canEdit: boolean;
  beforeCloseRef: BeforeCloseRef;
}) => {
  return (
    <>
      <Description data={cardData} canEdit={canEdit} beforeCloseRef={beforeCloseRef} />
      <CardDependencies data={cardData} canEdit={canEdit} />
      {canEdit && (
        <Button type="button" variant="outline" onClick={() => useAssistantTask.getState().openChecklist(cardData.id)}>AI: Gợi ý checklist</Button>
      )}
      {(cardData.attachments ?? []).length > 0 && (
        <Attachments
          cardId={cardData.id}
          boardId={cardData.list.boardId}
          items={cardData.attachments ?? []}
          canEdit={canEdit}
        />
      )}
      <Checklists
        cardId={cardData.id}
        boardId={cardData.list.boardId}
        cardDueDate={cardData.dueDate}
        checklists={cardData.checklists || []}
        canEdit={canEdit}
      />
    </>
  );
};

const LAYOUT_CLASSES = {
  dialog: {
    root: "grid min-h-0 flex-1 grid-cols-1 md:grid-cols-12 gap-x-8 p-7 items-start overflow-y-auto styled-scrollbar",
    main: "col-span-1 md:col-span-7 border-r border-transparent md:border-neutral-200/80 pr-0 md:pr-8 space-y-7",
    side: "col-span-1 md:col-span-5 pl-0 md:pl-2 space-y-6",
  },
  panel: {
    root: "min-h-0 flex-1 overflow-y-auto p-5 space-y-7 styled-scrollbar",
    main: "space-y-7",
    side: "space-y-6 border-t border-neutral-100 pt-6",
  },
} as const;

type CardDetailBodyProps = {
  cardId: string;
  layout: keyof typeof LAYOUT_CLASSES;
  /** Close without any unsaved-changes check (used only on dead-end error screens). */
  onClose: () => void;
  /** Filled with the unsaved-changes guard; containers must call it before closing or switching. */
  beforeCloseRef: BeforeCloseRef;
};

/** Nội dung chi tiết thẻ, dùng chung cho modal (dialog) và panel bên phải. */
export const CardDetailBody = ({ cardId, layout, onClose, beforeCloseRef }: CardDetailBodyProps) => {
  const classes = LAYOUT_CLASSES[layout];

  const queryClient = useQueryClient();
  const { data: cachedCard, error, isError, refetch, isFetching } = useQuery<CardWithList>({
    queryKey: ["card", cardId],
    queryFn: () => fetcher(`/api/cards/${cardId}`),
    retry: (count, err) => {
      const status = (err as Error & { status?: number }).status;
      return status !== 403 && status !== 404 && count < 2;
    },
  });
  const status = isError ? (error as Error & { status?: number }).status : undefined;
  const isGone = status === 403 || status === 404;
  // After 403/404 the cached copy is no longer trustworthy, so it is not shown.
  const cardData = isGone ? undefined : cachedCard;
  useEffect(() => {
    const store = useAssistantTask.getState();
    if (!cardData) { store.clear(cardId); return; }
    store.show({ id: cardData.id, title: cardData.title, boardId: cardData.list.boardId, updatedAt: new Date(cardData.updatedAt).toISOString() });
    return () => store.clear(cardId);
  }, [cardId, cardData]);

  useEffect(() => {
    if (isGone) {
      queryClient.removeQueries({ queryKey: ["card", cardId], exact: true });
    }
  }, [isGone, queryClient, cardId]);

  const { data: auditLogsData } = useQuery<AuditLog[]>({
    queryKey: ["card-logs", cardId],
    queryFn: () => fetcher(`/api/cards/${cardId}/logs`),
  });

  const { data: commentsData } = useQuery<CardCommentWithReplies[]>({
    queryKey: ["card-comments", cardId],
    queryFn: () => fetcher(`/api/cards/${cardId}/comments`),
  });
  const canEdit = true;

  return (
    <>
      {layout === "dialog" && (
        <>
          <DialogTitle className="sr-only">
            {cardData?.title || "Chi tiết thẻ"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Chi tiết thẻ và nhật ký hoạt động
          </DialogDescription>
        </>
      )}
      {isError && (isGone || !cachedCard) ? (
        <div role="alert" className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
          <p className="text-sm font-medium text-neutral-700">
            {status === 403
              ? "Bạn không còn quyền truy cập việc này."
              : status === 404
                ? "Việc không tồn tại hoặc đã bị xóa."
                : "Không tải được dữ liệu. Kiểm tra kết nối rồi thử lại."}
          </p>
          <div className="flex gap-2">
            {!isGone && (
              <Button type="button" size="sm" disabled={isFetching} onClick={() => void refetch()}>
                Thử lại
              </Button>
            )}
            <Button type="button" size="sm" variant="outline" onClick={onClose}>
              Đóng
            </Button>
          </div>
        </div>
      ) : (
      <div className={cn(classes.root)}>
        <div className={classes.main}>
          {!cardData
            ? <Header.Skeleton />
            : <Header key={`header-${cardData.id}`} data={cardData} canEdit={canEdit} />
          }
          {!cardData
            ? <Metadata.Skeleton />
            : <Metadata key={`metadata-${cardData.id}`} data={cardData} canEdit={canEdit} />
          }
          {!cardData
            ? <Description.Skeleton />
            : <CardMainContent key={`main-content-${cardData.id}`} cardData={cardData} canEdit={canEdit} beforeCloseRef={beforeCloseRef} />
          }
        </div>
        <div className={classes.side}>
          {cardData && canEdit && <AiTaskHistory cardId={cardData.id} />}
          {!auditLogsData
            ? <Activity.Skeleton />
            : <Activity
                items={auditLogsData}
                cardTitle={cardData?.title}
                memberNames={[]}
              />
          }
          <Comments
            cardId={cardId}
            boardId={cardData?.list.boardId}
            items={commentsData ?? []}
          />
        </div>
      </div>
      )}
    </>
  );
};
