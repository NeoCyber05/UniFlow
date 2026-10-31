"use client";

import { memo, useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useParams } from "@/web/shims/next-navigation";
import { toast } from "sonner";
import { Draggable } from "@hello-pangea/dnd";
import { AlignLeft, Check, Star, Sun } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { setCardCompleted } from "@/actions/cards/set-card-completed";
import { toggleCardImportant } from "@/actions/cards/toggle-card-important";
import { toggleCardMyDay } from "@/actions/cards/toggle-card-my-day";
import { MY_TASKS_ROOT_KEY } from "@/lib/my-tasks/types";

import { useCardModal } from "@/hooks/use-card-modal";
import { useBoardCourse } from "@/hooks/use-board-courses";
import { getCourseColor, getCourseShortLabel } from "@/lib/courses/course-colors";
import { Hint } from "@/components/hint";
import { CardWithAssignees } from "@/types";
import { useAction } from "@/hooks/use-action";
import { archiveCard } from "@/actions/cards/archive-card";
import { updateCard } from "@/actions/cards/update-card";
import { tr } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { ListWithCards } from "@/types";
import { CopyCardDialog } from "@/components/modals/copy-card-dialog";

import { getCardRevision } from "@/components/modals/card-modal/card-cache-utils";
import { useBoardState } from "./board-state-context";
import { CardBadges, CardLabels } from "./card-badges";
import { CardContextMenu } from "./card-context-menu";

interface CardItemProps {
  data: CardWithAssignees;
  index: number;
  canEdit: boolean;
}

export const CardItem = memo(function CardItem({
  data,
  index,
  canEdit,
}: CardItemProps) {
  const cardModal = useCardModal();
  const params = useParams();
  const boardId = params.boardId as string;
  const boardState = useBoardState();
  const queryClient = useQueryClient();
  const course = useBoardCourse(boardId, data.courseId);
  const courseColor = course ? getCourseColor(course.color) : null;
  
  const [showMenu, setShowMenu] = useState(false);
  const [copyDialogOpen, setCopyDialogOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0, origin: "left top" });
  const [triggerRect, setTriggerRect] = useState<DOMRect | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const archiveRollbackRef = useRef<ListWithCards[] | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const titleRollbackRef = useRef<string | null>(null);

  useEffect(() => {
    if (!showMenu) return;

    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      
      // If the click is inside the context menu, let the click happen normally.
      if (target.closest("[data-context-menu]")) {
        return;
      }

      // If clicked outside, close the menu, stop propagation and prevent default action
      e.preventDefault();
      e.stopPropagation();
      setShowMenu(false);
    };

    // Use capture to intercept clicks before they reach target elements (like other cards)
    document.addEventListener("click", handleOutsideClick, { capture: true });
    document.addEventListener("contextmenu", handleOutsideClick, { capture: true });

    return () => {
      document.removeEventListener("click", handleOutsideClick, { capture: true });
      document.removeEventListener("contextmenu", handleOutsideClick, { capture: true });
    };
  }, [showMenu]);

  const { execute: executeUpdateCard, isLoading: isLoadingUpdate } = useAction(updateCard, {
    onSuccess: (updatedCard) => {
      boardState.patchCard(updatedCard.id, { title: updatedCard.title, updatedAt: updatedCard.updatedAt });
      titleRollbackRef.current = null;
      disableEditing();
    },
    onError: (error) => {
      if (titleRollbackRef.current !== null) {
        boardState.patchCard(data.id, { title: titleRollbackRef.current });
        queryClient.setQueryData(["card", data.id], (current: CardWithAssignees | undefined) =>
          current ? { ...current, title: titleRollbackRef.current } : current,
        );
        titleRollbackRef.current = null;
      }
      toast.error(error);
      if (textareaRef.current) {
        textareaRef.current.value = data.title;
      }
      disableEditing();
    },
  });

  const enableEditing = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canEdit) {
      return;
    }

    setShowMenu(false);
    setIsEditing(true);
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const titleLength = textareaRef.current.value.length;
        textareaRef.current.setSelectionRange(titleLength, titleLength);
      }
    }, 0);
  };

  const disableEditing = () => {
    setIsEditing(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Escape") {
      disableEditing();
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      formRef.current?.requestSubmit();
    }
  };

  const onBlur = () => {
    formRef.current?.requestSubmit();
  };

  const onSubmit = (formData: FormData) => {
    const title = formData.get("title") as string;
    const trimmedTitle = title.trim();
    const boardId = params.boardId as string;

    if (!trimmedTitle) {
      if (textareaRef.current) {
        textareaRef.current.value = data.title;
      }
      disableEditing();
      return;
    }

    if (trimmedTitle === data.title) {
      disableEditing();
      return;
    }

    titleRollbackRef.current = data.title;
    boardState.patchCard(data.id, { title: trimmedTitle });
    queryClient.setQueryData(["card", data.id], (current: CardWithAssignees | undefined) =>
      current ? { ...current, title: trimmedTitle } : current,
    );
    disableEditing();

    executeUpdateCard({
      id: data.id,
      title: trimmedTitle,
      boardId,
      expectedUpdatedAt: getCardRevision(queryClient, data.id, data.updatedAt),
    });
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    if (!canEdit) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    const rect = cardRef.current?.getBoundingClientRect();

    if (rect) {
      const menuWidth = 208;
      const gap = 8;
      const hasSpaceRight = window.innerWidth - rect.right >= menuWidth + gap;

      setMenuPosition({
        top: Math.max(8, rect.top),
        left: hasSpaceRight
          ? rect.right + gap
          : Math.max(8, rect.left - menuWidth - gap),
        origin: hasSpaceRight ? "left top" : "right top",
      });
      setTriggerRect(rect);
    }

    setShowMenu(true);
  };

  const { execute: executeArchiveCard, isLoading: isLoadingArchive } = useAction(archiveCard, {
    onSuccess: () => {
      setShowMenu(false);
      archiveRollbackRef.current = null;
    },
    onError: (error) => {
      if (archiveRollbackRef.current) {
        boardState.resetToSnapshot(archiveRollbackRef.current);
      }

      toast.error(error);
      archiveRollbackRef.current = null;
    },
  });

  const onOpen = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    setShowMenu(false);
    cardModal.onOpen(data.id);
  };

  const onCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(false);
    const rect = cardRef.current?.getBoundingClientRect();
    if (rect) {
      setTriggerRect(rect);
    }
    setCopyDialogOpen(true);
  };

  const onArchive = (e: React.MouseEvent) => {
    e.stopPropagation();
    archiveRollbackRef.current = boardState.getSnapshot();
    boardState.removeCard(data.id);
    executeArchiveCard({ id: data.id, boardId });
  };

  // ⭐ là trạng thái riêng → VIEWER cũng gắn được
  const onToggleImportant = async (event: React.MouseEvent) => {
    event.stopPropagation();

    const next = !data.isImportant;

    boardState.patchCard(data.id, { isImportant: next });

    const result = await toggleCardImportant({ cardId: data.id, value: next });

    if (result.error) {
      boardState.patchCard(data.id, { isImportant: !next });
      toast.error(result.error);
      return;
    }

    void queryClient.invalidateQueries({ queryKey: MY_TASKS_ROOT_KEY });
  };

  const onToggleCompleted = async (event: React.MouseEvent) => {
    event.stopPropagation();

    const next = !data.isCompleted;

    boardState.patchCard(data.id, { isCompleted: next });

    const result = await setCardCompleted({ cardId: data.id, value: next });

    if (result.error) {
      boardState.patchCard(data.id, { isCompleted: !next });
      toast.error(result.error);
      return;
    }

    void queryClient.invalidateQueries({ queryKey: MY_TASKS_ROOT_KEY });
  };

  const isPinned = Boolean(data.myDayAt);
  const onToggleMyDay = async (event: React.MouseEvent) => {
    event.stopPropagation();

    const prev = data.myDayAt ?? null;

    boardState.patchCard(data.id, { myDayAt: isPinned ? null : new Date().toISOString() });

    const result = await toggleCardMyDay({ cardId: data.id, value: !isPinned });

    if (result.error) {
      boardState.patchCard(data.id, { myDayAt: prev });
      toast.error(result.error);
      return;
    }

    void queryClient.invalidateQueries({ queryKey: MY_TASKS_ROOT_KEY });
  };

  const myDayLabel = isPinned ? tr("kanban.cardItem.unpinToday") : tr("kanban.cardItem.pinToday");

  return (
    <>
      <Draggable draggableId={data.id} index={index} isDragDisabled={!canEdit}>
      {(provided, snapshot) => {
        const combinedRef = (node: HTMLDivElement | null) => {
          provided.innerRef(node);
          cardRef.current = node;
        };

        const cardContent = (
          <div
            {...provided.draggableProps}
            {...(canEdit ? provided.dragHandleProps : {})}
            ref={combinedRef}
            role="button"
            onClick={() => onOpen()}
            onContextMenu={canEdit ? handleContextMenu : undefined}
            data-active-card={showMenu || copyDialogOpen ? "true" : undefined}
            className={cn(
              "group relative flex flex-col justify-between border border-neutral-200/80 pb-2.5 pt-3 px-3 text-sm bg-white rounded-lg shadow-sm transition-[border-color,box-shadow,background-color] duration-100 !cursor-pointer select-none overflow-hidden",
              !snapshot.isDragging && "hover:border-violet-200 hover:shadow",
              // rotate/scale are their own CSS properties in Tailwind v4, so they compose with dnd's inline transform.
              snapshot.isDragging && "rotate-2 scale-[1.02] shadow-xl opacity-95 border-violet-300 z-[9999] pointer-events-none",
              (showMenu || copyDialogOpen) && "relative z-[100] ring-2 ring-violet-500 shadow-xl bg-white",
              courseColor && cn("border-l-[3px]", courseColor.stripe),
            )}
          >
            {course && courseColor && (
              <span
                title={course.name}
                className={cn(
                  "mb-1.5 inline-flex w-fit max-w-full items-center gap-1 truncate rounded px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset",
                  courseColor.chip,
                )}
              >
                {getCourseShortLabel(course)}
              </span>
            )}
            <CardLabels card={data} />
            <div className="w-full space-y-2">
              {isEditing ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    onSubmit(new FormData(e.currentTarget));
                  }}
                  ref={formRef}
                  className="w-full"
                  onClick={(e) => e.stopPropagation()}
                >
                  <textarea
                    ref={textareaRef}
                    name="title"
                    defaultValue={data.title}
                    onKeyDown={onKeyDown}
                    onBlur={onBlur}
                    disabled={isLoadingUpdate}
                    className="w-full text-[15px] font-semibold leading-snug text-neutral-800 break-words resize-none outline-none border border-violet-500 rounded-md px-2 py-1 focus:ring-1 focus:ring-violet-200 bg-white"
                    rows={1}
                  />
                </form>
              ) : (
                <div className="flex items-start gap-2">
                  <button
                    type="button"
                    onClick={onToggleCompleted}
                    aria-pressed={data.isCompleted}
                    aria-label={data.isCompleted ? tr("kanban.cardItem.markIncomplete") : tr("kanban.cardItem.markComplete")}
                    className={cn(
                      "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                      data.isCompleted
                        ? "border-emerald-500 bg-emerald-500 text-white"
                        : "border-neutral-300 hover:border-violet-500 hover:bg-violet-50",
                    )}
                  >
                    {data.isCompleted && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
                  </button>
                  <span className={cn(
                    "block min-w-0 flex-1 text-[15px] font-semibold leading-snug text-neutral-800 break-words pr-10",
                    data.description?.trim() && "pr-14",
                    data.isCompleted && "text-neutral-400 line-through",
                  )}>
                    {data.title}
                  </span>
                </div>
              )}
              <CardBadges card={data} />
            </div>
            <div className="absolute right-2.5 top-2.5 flex items-center gap-1">
              {data.description?.trim() && (
                <Hint description={tr("kanban.cardItem.hasDescriptionHint")} side="bottom">
                  <AlignLeft className="h-3.5 w-3.5 text-neutral-300 transition-colors group-hover:text-neutral-400" />
                </Hint>
              )}
              <button
                type="button"
                onClick={onToggleMyDay}
                aria-pressed={isPinned}
                aria-label={myDayLabel}
                title={myDayLabel}
                className={cn(
                  "rounded p-0.5 transition",
                  isPinned
                    ? "text-amber-500"
                    : "text-neutral-300 opacity-0 hover:text-amber-500 group-hover:opacity-100",
                )}
              >
                <Sun className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={onToggleImportant}
                aria-pressed={Boolean(data.isImportant)}
                aria-label={data.isImportant ? tr("kanban.cardItem.unmarkImportant") : tr("kanban.cardItem.markImportant")}
                className={cn(
                  "rounded p-0.5 transition",
                  data.isImportant
                    ? "text-amber-400"
                    : "text-neutral-300 opacity-0 hover:text-amber-400 group-hover:opacity-100",
                )}
              >
                <Star className={cn("h-3.5 w-3.5", data.isImportant && "fill-amber-400")} />
              </button>
            </div>

            <CardContextMenu
              isOpen={showMenu}
              canEdit={canEdit}
              position={menuPosition}
              isLoadingArchive={isLoadingArchive}
              onClose={() => setShowMenu(false)}
              onOpen={onOpen}
              onRename={enableEditing}
              onCopy={onCopy}
              onArchive={onArchive}
            />
          </div>
        );

        if (snapshot.isDragging) {
          return createPortal(cardContent, document.body);
        }

        return cardContent;
      }}
      </Draggable>
      {canEdit && (
        <CopyCardDialog
          open={copyDialogOpen}
          onOpenChange={setCopyDialogOpen}
          triggerRect={triggerRect}
          data={{
            ...data,
            list: {
              boardId,
            },
          }}
        />
      )}
    </>
  );
});
