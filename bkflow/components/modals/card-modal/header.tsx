"use client";

import { toast } from "sonner";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, Clock } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { CardWithList } from "@/types";
import { useAction } from "@/hooks/use-action";
import { updateCard } from "@/actions/cards/update-card";
import { Skeleton } from "@/components/ui/skeleton";
import { useBoardCalendarInvalidation } from "@/hooks/use-board-calendar-invalidation";
import { BlockedCompletionDialog } from "./metadata/blocked-completion-dialog";
import { cn } from "@/lib/utils";

import { getCardRevision, patchBoardCardPreview, patchCardQueryData } from "./card-cache-utils";

interface HeaderProps {
  data: CardWithList;
  canEdit?: boolean;
  layout?: "dialog" | "panel";
  actions?: ReactNode;
}

export const Header = ({
  data,
  canEdit = true,
  layout = "dialog",
  actions,
}: HeaderProps) => {
  const queryClient = useQueryClient();
  const boardId = data.list.boardId;
  const invalidateBoardCalendar = useBoardCalendarInvalidation(boardId);

  const unresolvedBlockers = data.blockedByDependencies.filter(
    (dependency) => !dependency.blockerCard.isCompleted
  );

  const [blockedCompletionOpen, setBlockedCompletionOpen] = useState(false);

  const completionRequestRef = useRef<{
    previous: boolean;
  } | null>(null);
  const queuedCompletionRef = useRef<boolean | null>(null);
  const titleRequestRef = useRef<{
    previous: string;
    optimistic: string;
  } | null>(null);

  const { execute: executeUpdateCard, isLoading: isLoadingUpdate } = useAction(updateCard, {
    onSuccess: (updatedCard) => {
      patchCardQueryData(queryClient, updatedCard.id, {
        isCompleted: updatedCard.isCompleted,
        repeatUnit: updatedCard.repeatUnit,
        repeatEvery: updatedCard.repeatEvery,
        updatedAt: updatedCard.updatedAt,
      });
      patchBoardCardPreview(boardId, updatedCard.id, {
        isCompleted: updatedCard.isCompleted,
        repeatUnit: updatedCard.repeatUnit,
        repeatEvery: updatedCard.repeatEvery,
        updatedAt: updatedCard.updatedAt,
      });
      invalidateBoardCalendar();

      if (updatedCard.isCompleted !== data.isCompleted) {
        const relatedDependencyCardIds = [
          ...data.blockedByDependencies.map((dependency) => dependency.blockerCardId),
          ...data.blockingDependencies.map((dependency) => dependency.blockedCardId),
        ];

        Array.from(new Set(relatedDependencyCardIds)).forEach((cardId) => {
          queryClient.invalidateQueries({
            queryKey: ["card", cardId],
          });
        });
      }

      const queuedCompletion = queuedCompletionRef.current;
      completionRequestRef.current = null;
      queuedCompletionRef.current = null;

      if (
        queuedCompletion !== null &&
        queuedCompletion !== updatedCard.isCompleted
      ) {
        updateCompletion(queuedCompletion);
      }
    },
    onError: (error) => {
      const request = completionRequestRef.current;
      if (request) {
        patchCardQueryData(queryClient, data.id, {
          isCompleted: request.previous,
        });
        patchBoardCardPreview(boardId, data.id, {
          isCompleted: request.previous,
        });
        completionRequestRef.current = null;
      }
      queuedCompletionRef.current = null;
      toast.error(error);
    },
  });

  const onToggleComplete = () => {
    if (!canEdit) {
      return;
    }

    const nextChecked = !data.isCompleted;

    if (nextChecked && unresolvedBlockers.length > 0) {
      setBlockedCompletionOpen(true);
      return;
    }

    updateCompletion(nextChecked);
  };

  const updateCompletion = (checked: boolean) => {
    const activeRequest = completionRequestRef.current;

    patchCardQueryData(queryClient, data.id, {
      isCompleted: checked,
    });
    patchBoardCardPreview(boardId, data.id, {
      isCompleted: checked,
    });

    if (activeRequest) {
      queuedCompletionRef.current = checked;
      return;
    }

    completionRequestRef.current = {
      previous: data.isCompleted,
    };

    executeUpdateCard({
      id: data.id,
      boardId,
      expectedUpdatedAt: getCardRevision(queryClient, data.id, data.updatedAt),
      isCompleted: checked,
    });
  };

  const onConfirmBlockedCompletion = () => {
    updateCompletion(true);
    setBlockedCompletionOpen(false);
  };

  const { execute, isLoading: isLoadingTitle } = useAction(updateCard, {
    onSuccess: (updatedCard) => {
      const request = titleRequestRef.current;
      if (!request || updatedCard.title !== request.optimistic) {
        return;
      }

      patchCardQueryData(queryClient, updatedCard.id, {
        title: updatedCard.title,
        updatedAt: updatedCard.updatedAt,
      });
      patchBoardCardPreview(boardId, updatedCard.id, {
        title: updatedCard.title,
        updatedAt: updatedCard.updatedAt,
      });


      invalidateBoardCalendar();
      setTitle(updatedCard.title);
      titleRequestRef.current = null;
    },
    onError: (error) => {
      const request = titleRequestRef.current;
      if (request) {
        patchCardQueryData(queryClient, data.id, {
          title: request.previous,
        });
        patchBoardCardPreview(boardId, data.id, {
          title: request.previous,
        });
        setTitle(request.previous);
        titleRequestRef.current = null;
      }
      toast.error(error);
    }
  });

  const titleRef = useRef<HTMLTextAreaElement>(null);

  const [title, setTitle] = useState(data.title);

  useEffect(() => {
    if (!titleRequestRef.current) {
      setTitle(data.title);
    }
  }, [data.title]);

  const resizeTitle = () => {
    const element = titleRef.current;

    if (!element) {
      return;
    }

    element.style.height = "0px";
    element.style.height = `${element.scrollHeight}px`;
  };

  useEffect(() => {
    resizeTitle();
  }, [title]);

  const onBlur = () => {
    if (!canEdit || isLoadingTitle || titleRequestRef.current) {
      return;
    }

    titleRef.current?.form?.requestSubmit();
  };

  const onSubmit = (formData: FormData) => {
    const title = formData.get("title") as string;
    const trimmedTitle = title.trim();

    if (!canEdit) {
      return;
    }

    if (!trimmedTitle) {
      setTitle(data.title);
      requestAnimationFrame(resizeTitle);
      return;
    }

    if (trimmedTitle === data.title) {
      setTitle(data.title);
      requestAnimationFrame(resizeTitle);
      return;
    }

    titleRequestRef.current = {
      previous: data.title,
      optimistic: trimmedTitle,
    };

    patchCardQueryData(queryClient, data.id, {
      title: trimmedTitle,
    });
    patchBoardCardPreview(boardId, data.id, {
      title: trimmedTitle,
    });
    setTitle(trimmedTitle);

    execute({
      title: trimmedTitle,
      boardId,
      id: data.id,
      expectedUpdatedAt: getCardRevision(queryClient, data.id, data.updatedAt),
    });
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      titleRef.current?.form?.requestSubmit();
    }
  };

  const isPanel = layout === "panel";
  const completion = data.kind === "EVENT" ? (
    <span className="inline-flex items-center gap-2 text-xs text-muted-foreground"><Clock className="size-4" />Sự kiện</span>
  ) : (
    <button type="button" onClick={onToggleComplete} disabled={!canEdit} aria-pressed={data.isCompleted}
      aria-label={data.isCompleted ? "Đánh dấu chưa hoàn thành" : "Đánh dấu hoàn thành"}
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-ring motion-reduce:transition-none disabled:opacity-60",
        isPanel ? "min-h-9 px-3 text-xs font-semibold" : "mt-1 size-10 rounded-full",
        data.isCompleted || isPanel ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90" : "border-border bg-background text-muted-foreground hover:border-primary hover:text-primary",
      )}>
      <Check className={isPanel ? "size-4" : "size-5"} aria-hidden="true" />
      {isPanel && (data.isCompleted ? "Đã hoàn thành" : "Đánh dấu hoàn thành")}
    </button>
  );
  return (
    <div className={isPanel ? "space-y-4" : "flex w-full items-start gap-4"}>
      {canEdit && <BlockedCompletionDialog open={blockedCompletionOpen} onOpenChange={setBlockedCompletionOpen} blockers={unresolvedBlockers} isLoading={isLoadingUpdate} onConfirm={onConfirmBlockedCompletion} />}
      {!isPanel && completion}
      <div className="min-w-0 flex-1">
        {isPanel && <p className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"><span className="size-1.5 rounded-full bg-primary" />{data.isCompleted ? "Đã hoàn thành" : data.list.title}</p>}
        <form onSubmit={event => { event.preventDefault(); onSubmit(new FormData(event.currentTarget)); }}>
          <textarea ref={titleRef} onBlur={onBlur} onInput={resizeTitle} onChange={event => setTitle(event.target.value)} onKeyDown={onKeyDown}
            id="title" name="title" value={title} readOnly={!canEdit} rows={1} aria-label="Tên công việc" aria-busy={isLoadingTitle}
            className="relative -left-2 min-h-10 w-[calc(100%+0.5rem)] resize-none overflow-hidden break-words rounded-lg border border-transparent bg-transparent px-2 py-1 text-2xl font-semibold leading-tight tracking-tight text-foreground outline-none transition-colors focus-visible:border-border focus-visible:bg-background focus-visible:ring-1 focus-visible:ring-ring read-only:cursor-default"
          />
        </form>
        {!isPanel && <p className="mt-1 text-xs text-muted-foreground">trong danh sách <span className="font-medium text-foreground">{data.list.title}</span></p>}
      </div>
      {isPanel && <div className="flex flex-wrap items-center justify-between gap-2">{completion}{actions}</div>}
    </div>
  );
};

Header.Skeleton = function HeaderSkeleton() {
  return (
    <div className="flex items-start gap-x-4 mb-3">
      <Skeleton className="h-10 w-10 rounded-full bg-neutral-100" />
      <div className="space-y-2 flex-1">
        <Skeleton className="w-2/3 h-7 rounded-lg bg-neutral-100" />
        <Skeleton className="w-28 h-4 rounded bg-neutral-100" />
      </div>
    </div>
  );
};
