"use client";
import { AiTaskHistory } from "@/components/ai-assistant/task-edit-controls";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { CardWithList } from "@/types";
import { Button } from "@/components/ui/button";

import { Header } from "./header";
import { MetadataSection as Metadata } from "./metadata/metadata-section";
import { Description } from "./description";
import { ChecklistsSection as Checklists } from "./checklists/checklists-section";
import { AttachmentsSection as Attachments } from "./attachments/attachments-section";
import { useAssistantTask } from "@/hooks/use-assistant-task";
import { DependenciesSection as CardDependencies } from "./dependencies/dependencies-section";
import type { BeforeCloseRef } from "./close-guard";
import { getCardQueryOptions } from "./card-cache-utils";

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
    root: "min-h-0 flex-1 space-y-5 overflow-y-auto px-6 pb-7 pt-1 md:px-8 styled-scrollbar",
    columns: "grid grid-cols-1 items-start gap-8 md:grid-cols-[minmax(0,1fr)_260px]",
    main: "min-w-0 space-y-7",
    side: "space-y-6 border-t border-neutral-100 pt-6 empty:hidden md:border-l md:border-t-0 md:pl-6 md:pt-0",
  },
  panel: {
    root: "min-h-0 flex-1 space-y-5 overflow-y-auto p-5 styled-scrollbar",
    columns: "space-y-7",
    main: "space-y-7",
    side: "space-y-6 border-t border-neutral-100 pt-6 empty:hidden",
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
  const { data: cachedCard, error, isError, refetch, isFetching } = useQuery(getCardQueryOptions(cardId));
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

  const canEdit = true;
  const metadata = !cardData
    ? <Metadata.Skeleton />
    : <Metadata key={`metadata-${cardData.id}`} data={cardData} canEdit={canEdit} />;

  return (
    <>
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
      <div className={classes.root}>
        {!cardData
          ? <Header.Skeleton />
          : <Header key={`header-${cardData.id}`} data={cardData} canEdit={canEdit} />
        }
        <div className={classes.columns}>
          <div className={classes.main}>
            {layout === "panel" && metadata}
            {!cardData
              ? <Description.Skeleton />
              : <CardMainContent key={`main-content-${cardData.id}`} cardData={cardData} canEdit={canEdit} beforeCloseRef={beforeCloseRef} />
            }
          </div>
          <div className={classes.side}>
            {layout === "dialog" && metadata}
            {cardData && canEdit && <AiTaskHistory cardId={cardData.id} />}
          </div>
        </div>
      </div>
      )}
    </>
  );
};
