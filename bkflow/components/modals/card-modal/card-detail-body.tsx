"use client";

import { useEffect, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { CardWithList } from "@/types";
import { Button } from "@/components/ui/button";
import { tr, useLocale } from "@/lib/i18n";

import { Header } from "./header";
import { MetadataSection as Metadata } from "./metadata/metadata-section";
import { Description } from "./description";
import { ChecklistsSection as Checklists } from "./checklists/checklists-section";
import { AttachmentsSection as Attachments } from "./attachments/attachments-section";
import { useAssistantTask } from "@/hooks/use-assistant-task";
import type { BeforeCloseRef } from "./close-guard";
import { getCardQueryOptions } from "./card-cache-utils";
import { PanelMetadata, CardRepeatControl } from "./metadata/panel-metadata";
import { ChecklistPopover } from "./checklists/checklist-popover";
import { AttachmentAddPopover } from "./attachments/attachment-add-popover";
import { ChevronDown, ListChecks, Paperclip, Plus } from "lucide-react";

const CardMainContent = ({
  cardData,
  canEdit,
  beforeCloseRef,
  panel = false,
}: {
  cardData: CardWithList;
  canEdit: boolean;
  beforeCloseRef: BeforeCloseRef;
  panel?: boolean;
}) => {
  const checklistActions = canEdit ? (
    <div className="flex items-center gap-1">
      <ChecklistPopover cardId={cardData.id} boardId={cardData.list.boardId}>
        <Button type="button" variant="ghost" size="sm" aria-label={tr("cardModal.addChecklistAria")} className="size-8 p-0"><Plus className="size-4" /></Button>
      </ChecklistPopover>
      <Button type="button" variant="outline" size="sm" className="gap-1.5 text-xs"
        onClick={() => useAssistantTask.getState().openChecklist(cardData.id)}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="size-4 text-primary" aria-hidden="true">
          <path d="M8.3 7.3c1.7-3 5.2-4 7.7-2.5s3.4 4.7 1.6 7.8-5.2 4-7.8 2.5S6.5 10.3 8.3 7.3Zm7.4 9.4c-1.7 3-5.2 4-7.7 2.5s-3.4-4.7-1.6-7.8 5.2-4 7.8-2.5 3.3 4.8 1.5 7.8Z" />
          <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
        </svg>
        {tr("cardModal.aiSuggestShort")}
      </Button>
    </div>
  ) : null;
  return (
    <>
      <Description data={cardData} canEdit={canEdit} beforeCloseRef={beforeCloseRef} compact={panel} />
      {!panel && canEdit && <Button type="button" variant="outline" onClick={() => useAssistantTask.getState().openChecklist(cardData.id)}>{tr("cardModal.aiSuggestChecklist")}</Button>}
      {panel && cardData.checklists.length === 0 && <div className="flex items-center justify-between gap-2 border-t border-border pt-5"><h2 className="flex items-center gap-2 text-sm font-semibold"><ListChecks className="size-4 text-muted-foreground" />{tr("cardModal.checklistHeading")}</h2>{checklistActions}</div>}
      {!panel && (cardData.attachments ?? []).length > 0 && (
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
        compact={panel}
        actions={panel ? checklistActions : undefined}
      />
      {panel && <>
        {cardData.checklists.length === 0 && <p className="text-xs leading-relaxed text-muted-foreground">{tr("cardModal.checklistEmptyHint")}</p>}
        <details className="group border-t border-border">
          <summary className="flex cursor-pointer list-none items-center gap-2 py-4 text-xs font-medium">
            <Paperclip className="size-4 text-muted-foreground" />{tr("cardModal.attachmentsSummary")}
            <span className="text-muted-foreground">{cardData.attachments.length || ""}</span>
            <ChevronDown className="ml-auto size-3.5 transition-transform group-open:rotate-180 motion-reduce:transition-none" />
          </summary>
          <div className="space-y-3 pb-4">
            <Attachments cardId={cardData.id} boardId={cardData.list.boardId} items={cardData.attachments} canEdit={canEdit} />
            {canEdit && <AttachmentAddPopover cardId={cardData.id} boardId={cardData.list.boardId}>
              <Button type="button" variant="outline" size="sm"><Plus className="size-3.5" />{tr("cardModal.addAttachment")}</Button>
            </AttachmentAddPopover>}
          </div>
        </details>
        <CardRepeatControl data={cardData} canEdit={canEdit} />
      </>}
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
    root: "task-detail-panel-body min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-6 styled-scrollbar",
    columns: "space-y-7",
    main: "min-w-0 space-y-5",
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
  headerActions?: ReactNode;
};

/** Nội dung chi tiết thẻ, dùng chung cho modal (dialog) và panel bên phải. */
export const CardDetailBody = ({ cardId, layout, onClose, beforeCloseRef, headerActions }: CardDetailBodyProps) => {
  useLocale((state) => state.locale);
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
    : layout === "panel" ? <PanelMetadata key={`metadata-${cardData.id}`} data={cardData} canEdit={canEdit} /> : <Metadata key={`metadata-${cardData.id}`} data={cardData} canEdit={canEdit} />;

  return (
    <>
      {isError && (isGone || !cachedCard) ? (
        <div role="alert" className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
          <p className="text-sm font-medium text-neutral-700">
            {status === 403
              ? tr("cardModal.errorNoAccess")
              : status === 404
                ? tr("cardModal.errorNotFound")
                : tr("cardModal.errorLoadFailed")}
          </p>
          <div className="flex gap-2">
            {!isGone && (
              <Button type="button" size="sm" disabled={isFetching} onClick={() => void refetch()}>
                {tr("cardModal.retry")}
              </Button>
            )}
            <Button type="button" size="sm" variant="outline" onClick={onClose}>
              {tr("cardModal.close")}
            </Button>
          </div>
        </div>
      ) : (
      <div className={classes.root}>
        {!cardData
          ? <Header.Skeleton />
          : <Header key={`header-${cardData.id}`} data={cardData} canEdit={canEdit} layout={layout} actions={headerActions} />
        }
        <div className={classes.columns}>
          <div className={classes.main}>
            {layout === "panel" && metadata}
            {!cardData
              ? <Description.Skeleton />
              : <CardMainContent key={`main-content-${cardData.id}`} cardData={cardData} canEdit={canEdit} beforeCloseRef={beforeCloseRef} panel={layout === "panel"} />
            }
          </div>
          <div className={classes.side}>
            {layout === "dialog" && metadata}
          </div>
        </div>
      </div>
      )}
    </>
  );
};
