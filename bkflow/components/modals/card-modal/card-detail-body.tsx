"use client";

import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { AuditLog } from "@prisma/client";

import { CardCommentWithReplies, CardWithList } from "@/types";
import { fetcher } from "@/lib/fetcher";
import { cn } from "@/lib/utils";
import { DialogTitle, DialogDescription } from "@/components/ui/dialog";

import { Header } from "./header";
import { MetadataSection as Metadata } from "./metadata/metadata-section";
import { Description } from "./description";
import { Activity } from "./activity";
import { CommentsSection as Comments } from "./comments/comments-section";
import { ChecklistsSection as Checklists } from "./checklists/checklists-section";
import { AttachmentsSection as Attachments } from "./attachments/attachments-section";
import { AiCardQualityAssistant } from "./ai/ai-card-quality-assistant";
import { DependenciesSection as CardDependencies } from "./dependencies/dependencies-section";

const toTimestampString = (value: Date | string | null | undefined) => {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);

  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const CardMainContent = ({
  cardData,
  canEdit,
}: {
  cardData: CardWithList;
  canEdit: boolean;
}) => {
  const [descriptionBaseUpdatedAt, setDescriptionBaseUpdatedAt] = useState(
    () => toTimestampString(cardData.descriptionUpdatedAt),
  );
  const getDescriptionBaseUpdatedAt = useCallback(
    () => descriptionBaseUpdatedAt,
    [descriptionBaseUpdatedAt],
  );

  return (
    <>
      <Description
        data={cardData}
        canEdit={canEdit}
        getDescriptionBaseUpdatedAt={getDescriptionBaseUpdatedAt}
        onDescriptionBaseUpdatedAtChange={setDescriptionBaseUpdatedAt}
      />
      <CardDependencies data={cardData} canEdit={canEdit} />
      {canEdit && (
        <AiCardQualityAssistant
          cardId={cardData.id}
          boardId={cardData.list.boardId}
          checklists={cardData.checklists || []}
        />
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
  onClose: () => void;
};

/** Nội dung chi tiết thẻ, dùng chung cho modal (dialog) và panel bên phải. */
export const CardDetailBody = ({ cardId, layout, onClose }: CardDetailBodyProps) => {
  const classes = LAYOUT_CLASSES[layout];

  const { data: cardData, error, isError } = useQuery<CardWithList>({
    queryKey: ["card", cardId],
    queryFn: () => fetcher(`/api/cards/${cardId}`),
  });

  useEffect(() => {
    if (isError && error) {
      const err = error as Error & { status?: number };
      if (err.status === 403) {
        toast.error("Bạn không còn quyền truy cập bảng này.");
      } else if (err.status === 404) {
        toast.error("Thẻ không tồn tại hoặc đã bị xóa.");
      } else {
        toast.error("Có lỗi xảy ra khi tải dữ liệu thẻ.");
      }
      onClose();
    }
  }, [isError, error, onClose]);

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
            : <CardMainContent key={`main-content-${cardData.id}`} cardData={cardData} canEdit={canEdit} />
          }
        </div>
        <div className={classes.side}>
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
    </>
  );
};
