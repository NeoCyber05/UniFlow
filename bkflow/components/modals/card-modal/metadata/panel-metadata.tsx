"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarDays, ChevronDown, Clock, ListTodo, Repeat } from "lucide-react";
import { Popover as AnimatedPopover } from "@animate-ui/react/primitives/radix-ui/popover";
import { ReducedMotionConfig } from "@animate-ui/react/utils/motion";
import { toast } from "sonner";

import { updateCard } from "@/actions/cards/update-card";
import { TaskRepeatEditor, formatRepeatLabel } from "@/components/task-repeat-editor";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAction } from "@/hooks/use-action";
import { useBoardCalendarInvalidation } from "@/hooks/use-board-calendar-invalidation";
import { buildTaskDatesPatch, taskDatesToForm } from "@/lib/cards/task-dates-form";
import { readCardRepeat } from "@/lib/cards/task-repeat";
import { tr } from "@/lib/i18n";
import type { CardMessageKey } from "@/lib/i18n/messages/vi-card";
import { addVNDays, getVNDay, getVNDayKey, getVNWeekday } from "@/lib/my-tasks/vn-day";
import type { CardWithList } from "@/types";
import { getCardRevision, patchBoardCardPreview, patchCardQueryData } from "../card-cache-utils";
import { CardCourseSelect } from "./card-course-select";
import { CardDatePopover } from "./card-date-popover";
import { CardLabelSummary } from "./card-label-summary";
import { formatDayMonth, formatFullDay, getDateLines, translateTaskDateMessage } from "./metadata-utils";
import { useCardMetadataActions } from "./use-card-metadata-actions";

const valueClass = "flex min-h-8 min-w-0 items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-xs font-medium transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-60";
const rowClass = "grid min-h-10 grid-cols-[116px_minmax(0,1fr)] items-center gap-3";
const labelClass = "flex shrink-0 items-center gap-2 whitespace-nowrap text-xs text-muted-foreground";

export function PanelMetadata({ data, canEdit }: { data: CardWithList; canEdit: boolean }) {
  const queryClient = useQueryClient();
  const [dateOpen, setDateOpen] = useState(false);
  const [deadlineOpen, setDeadlineOpen] = useState(false);
  const invalidateBoardCalendar = useBoardCalendarInvalidation(data.list.boardId);
  const actions = useCardMetadataActions({ data, boardId: data.list.boardId, queryClient, invalidateBoardCalendar, setIsDateOpen: setDateOpen });
  const form = taskDatesToForm(data);
  const today = getVNDay(new Date());
  const weekday = getVNWeekday(today);
  const choices: ReadonlyArray<readonly [CardMessageKey, number]> = [
    ["cardMeta.today", 0],
    ["cardMeta.tomorrow", 1],
    ["cardMeta.thisWeekend", (7 - weekday) % 7],
    ["cardMeta.nextMonday", (8 - weekday) % 7 || 7],
  ];
  const dayKey = (offset: number) => getVNDayKey(addVNDays(today, offset));
  const matchedChoice = choices.find(([, offset]) => dayKey(offset) === form.deadlineDate);
  const deadlineLabel = matchedChoice
    ? tr(matchedChoice[0])
    : form.deadlineDate
      ? formatFullDay(form.deadlineDate)
      : tr("cardMeta.pickDate");
  const setDeadline = (date: string) => {
    const result = buildTaskDatesPatch({ ...form, deadlineDate: date, ...(!date ? { deadlineTime: "", reminder: "none" } : {}) });
    if ("error" in result) { toast.error(translateTaskDateMessage(result.error)); return; }
    actions.saveTaskDates(result.patch);
    setDeadlineOpen(false);
  };
  return (
    <section aria-label={tr("cardMeta.taskInfoAria")} className="border-y border-border py-2">
      <div className={rowClass}><span className={labelClass}><ListTodo className="size-4" />{tr("cardMeta.listLabel")}</span><span className="truncate px-2 text-xs font-medium">{data.list.title}</span></div>
      <div className={rowClass}>
        <span className={labelClass}><CalendarDays className="size-4" />{tr("cardMeta.deadlineLabel")}</span>
        <Popover open={deadlineOpen} onOpenChange={setDeadlineOpen}>
          <PopoverTrigger asChild><button type="button" disabled={!canEdit || actions.isLoadingUpdate} className={valueClass} aria-label={tr("cardMeta.pickDeadlineAria")}><span className="truncate">{deadlineLabel}{form.deadlineTime && ` · ${form.deadlineTime}`}</span><ChevronDown className="size-3.5 shrink-0 text-muted-foreground" /></button></PopoverTrigger>
          <PopoverContent align="end" className="w-60 border border-border p-1.5">
            {choices.map(([labelKey, offset]) => <button key={labelKey} type="button" onClick={() => setDeadline(dayKey(offset))} className={valueClass}>{tr(labelKey)}<span className="text-[10px] text-muted-foreground">{formatDayMonth(dayKey(offset))}</span></button>)}
            <button type="button" onClick={() => { setDeadlineOpen(false); setDateOpen(true); }} className={`${valueClass} border-t border-border`}>{tr("cardMeta.customDate")}</button>
            {form.deadlineDate && <button type="button" onClick={() => setDeadline("")} className={`${valueClass} text-muted-foreground`}>{tr("cardMeta.clearDeadline")}</button>}
          </PopoverContent>
        </Popover>
      </div>
      <CardCourseSelect cardId={data.id} boardId={data.list.boardId} courseId={data.courseId} canEdit={canEdit} compact />
      <div className={rowClass}>
        <span className={labelClass}><Clock className="size-4" />{tr("cardMeta.scheduleAndReminder")}</span>
        <CardDatePopover open={dateOpen} onOpenChange={setDateOpen} data={data} isLoadingUpdate={actions.isLoadingUpdate} onSave={actions.saveTaskDates} onClearSchedule={actions.clearSchedule} onClearLegacyStart={actions.clearLegacyStart} trigger={<button type="button" disabled={!canEdit} className={valueClass}><span className="min-w-0 truncate">{getDateLines(data, { includeDeadline: false }).join(" · ") || tr("cardMeta.configure")}</span><ChevronDown className="size-3.5 shrink-0 text-muted-foreground" /></button>} />
      </div>
      {data.labels.length > 0 && <div className="py-2"><CardLabelSummary cardId={data.id} boardId={data.list.boardId} labels={data.labels} boardLabels={data.boardLabels} canEdit={canEdit} /></div>}
    </section>
  );
}

export function CardRepeatControl({ data, canEdit }: { data: CardWithList; canEdit: boolean }) {
  const queryClient = useQueryClient();
  const invalidate = useBoardCalendarInvalidation(data.list.boardId);
  const { execute, isLoading } = useAction(updateCard, {
    onSuccess: card => {
      const patch = { repeatUnit: card.repeatUnit, repeatEvery: card.repeatEvery, updatedAt: card.updatedAt };
      patchCardQueryData(queryClient, card.id, patch);
      patchBoardCardPreview(data.list.boardId, card.id, patch);
      invalidate();
    },
    onError: (error, code) => {
      toast.error(error);
      if (code === "CARD_CONFLICT") void queryClient.invalidateQueries({ queryKey: ["card", data.id] });
    },
  });
  if (data.kind === "EVENT") return null;
  const repeat = readCardRepeat(data);
  return (
    <ReducedMotionConfig>
      <div className="flex min-h-14 items-center justify-between gap-3 border-t border-border py-2">
        <span className={labelClass}><Repeat className="size-4" />{tr("cardMeta.repeatLabel")}</span>
        <AnimatedPopover.Root>
          <AnimatedPopover.Trigger disabled={!canEdit || isLoading} className={`${valueClass} w-auto border border-border px-3`} aria-label={tr("cardMeta.pickRepeatAria")}>{repeat ? formatRepeatLabel(repeat) : tr("cardMeta.noRepeat")}<ChevronDown className="size-3.5 text-muted-foreground" /></AnimatedPopover.Trigger>
          <AnimatedPopover.Portal>
            <AnimatedPopover.Content align="end" sideOffset={6} className="z-[9999] w-[280px] max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-popover p-2 text-popover-foreground shadow-xl outline-none">
              <TaskRepeatEditor value={repeat} disabled={isLoading} onChange={repeat => execute({ id: data.id, boardId: data.list.boardId, expectedUpdatedAt: getCardRevision(queryClient, data.id, data.updatedAt), repeat })} />
            </AnimatedPopover.Content>
          </AnimatedPopover.Portal>
        </AnimatedPopover.Root>
      </div>
    </ReducedMotionConfig>
  );
}
