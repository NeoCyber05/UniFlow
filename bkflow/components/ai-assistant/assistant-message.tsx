"use client";

import {
  AlertTriangle,
  Archive,
  ArrowRight,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  GitBranch,
  ListChecks,
  Loader2,
  Sparkles,
  User,
} from "lucide-react";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import type { BoardAssistantUIMessage } from "@/lib/ai/assistant/agent";
import type { AiOperation, AiProposal } from "@/lib/ai/assistant/policy";
import type { AssistantMutationOutput } from "@/lib/ai/assistant/tools";
import { intlDateFormat, tr } from "@/lib/i18n";
import type { CardMessageKey } from "@/lib/i18n/messages/vi-card";
import { MY_TASKS_ROOT_KEY } from "@/lib/my-tasks/types";
import { cn } from "@/lib/utils";
import { useRouter } from "@/web/shims/next-navigation";

import { AiLogo } from "./ai-logo";
import { AssistantMarkdown } from "./assistant-markdown";
import { TaskEditProposal, AiEditUndoButton } from "./task-edit-controls";

type MessagePart = BoardAssistantUIMessage["parts"][number];

/**
 * Ánh xạ định danh kỹ thuật của công cụ sang key hiển thị trạng thái
 * thân thiện với người dùng trong quá trình Agent thực thi tool calls.
 */
const TOOL_LABEL_KEYS: Record<string, { running: CardMessageKey; done: CardMessageKey }> = {
  searchWorkspace: { running: "aiAssistant.toolRunning.searchWorkspace", done: "aiAssistant.toolDone.searchWorkspace" },
  getPage: { running: "aiAssistant.toolRunning.getPage", done: "aiAssistant.toolDone.getPage" },
  getMyAgenda: { running: "aiAssistant.toolRunning.getMyAgenda", done: "aiAssistant.toolDone.getMyAgenda" },
  updateChecklistItem: { running: "aiAssistant.toolRunning.updateChecklistItem", done: "aiAssistant.toolDone.updateChecklistItem" },
  getDeadlines: { running: "aiAssistant.toolRunning.getDeadlines", done: "aiAssistant.toolDone.getDeadlines" },
  getBoardProgress: { running: "aiAssistant.toolRunning.getBoardProgress", done: "aiAssistant.toolDone.getBoardProgress" },
  findCards: { running: "aiAssistant.toolRunning.findCards", done: "aiAssistant.toolDone.findCards" },
  getCardDetails: { running: "aiAssistant.toolRunning.getCardDetails", done: "aiAssistant.toolDone.getCardDetails" },
  createDeadlineCard: { running: "aiAssistant.toolRunning.createDeadlineCard", done: "aiAssistant.toolDone.createDeadlineCard" },
  createRecurringSchedule: { running: "aiAssistant.toolRunning.createRecurringSchedule", done: "aiAssistant.toolDone.createRecurringSchedule" },
  batchCreateCards: { running: "aiAssistant.toolRunning.batchCreateCards", done: "aiAssistant.toolDone.batchCreateCards" },
  createCardChecklist: { running: "aiAssistant.toolRunning.createCardChecklist", done: "aiAssistant.toolDone.createCardChecklist" },
  moveCard: { running: "aiAssistant.toolRunning.moveCard", done: "aiAssistant.toolDone.moveCard" },
  updateCardDeadline: { running: "aiAssistant.toolRunning.updateCardDeadline", done: "aiAssistant.toolDone.updateCardDeadline" },
  updateCardDetails: { running: "aiAssistant.toolRunning.updateCardDetails", done: "aiAssistant.toolDone.updateCardDetails" },
  archiveCard: { running: "aiAssistant.toolRunning.archiveCard", done: "aiAssistant.toolDone.archiveCard" },
};

/**
 * Tập hợp tên các công cụ làm biến đổi dữ liệu (mutations)
 * cần hiển thị thẻ hành động (Action Card) xem trước trên giao diện chat.
 */
const MUTATION_TOOL_NAMES = new Set([
  "updateChecklistItem",
  "createDeadlineCard",
  "createRecurringSchedule",
  "batchCreateCards",
  "createCardChecklist",
  "moveCard",
  "updateCardDeadline",
  "updateCardDetails",
  "archiveCard",
  "createCardDependency",
  "deleteCardDependency",
]);

const OPERATION_LABEL_KEYS: Record<AiOperation, CardMessageKey> = {
  answer: "aiAssistant.op.answer",
  edit_page: "aiAssistant.op.edit_page",
  edit_task_content: "aiAssistant.op.edit_task_content",
  add_checklist: "aiAssistant.op.add_checklist",
  set_schedule: "aiAssistant.op.set_schedule",
  set_deadline: "aiAssistant.op.set_deadline",
  batch_update: "aiAssistant.op.batch_update",
  replace_content: "aiAssistant.op.replace_content",
};

const isProposal = (output: unknown) => (output as { action?: string } | null)?.action === "proposal";

const PROPOSAL_HEADING_KEYS: Record<string, CardMessageKey> = {
  createDeadlineCard: "aiAssistant.prop.createDeadlineCard",
  createRecurringSchedule: "aiAssistant.prop.createRecurringSchedule",
  batchCreateCards: "aiAssistant.prop.batchCreateCards",
  createCardChecklist: "aiAssistant.prop.createCardChecklist",
  moveCard: "aiAssistant.prop.moveCard",
  archiveCard: "aiAssistant.prop.archiveCard",
  createCardDependency: "aiAssistant.prop.createCardDependency",
  deleteCardDependency: "aiAssistant.prop.deleteCardDependency",
};

const FIELD_LABEL_KEYS: Record<string, CardMessageKey> = {
  title: "aiAssistant.field.title",
  dueDate: "aiAssistant.field.dueDate",
  startDate: "aiAssistant.field.startDate",
  deadlineOn: "aiAssistant.field.deadlineOn",
  scheduledOn: "aiAssistant.field.scheduledOn",
  listTitle: "aiAssistant.field.listTitle",
  destinationListTitle: "aiAssistant.field.destinationListTitle",
  time: "aiAssistant.field.time",
  frequency: "aiAssistant.field.frequency",
  daysCount: "aiAssistant.field.daysCount",
  blockerCard: "aiAssistant.field.blockerCard",
  blockedCard: "aiAssistant.field.blockedCard",
  isCompleted: "aiAssistant.field.isCompleted",
  description: "aiAssistant.field.description",
};
const FREQUENCY_KEYS: Record<string, CardMessageKey> = {
  daily: "aiAssistant.freq.daily",
  weekdays: "aiAssistant.freq.weekdays",
  custom_days: "aiAssistant.freq.custom_days",
};
const DATE_FIELDS = new Set(["dueDate", "startDate"]);
const formatDate = (value: string) => intlDateFormat({ dateStyle: "short", timeStyle: "short" }).format(new Date(value));

/** Xem trước một đề xuất chưa có đường sửa thẻ (tạo việc, chuyển cột…); bấm "Đồng ý" mới ghi dữ liệu. */
const ToolProposal = ({ proposal, toolCallId, boardId, onOpenCard }: { proposal: AiProposal; toolCallId: string; boardId?: string; onOpenCard: (cardId: string) => void }) => {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [result, setResult] = useState<AssistantMutationOutput | null>(null);
  const input = proposal.input;
  const heading = tr(PROPOSAL_HEADING_KEYS[proposal.tool] ?? OPERATION_LABEL_KEYS[proposal.operation]);
  const name = typeof input.title === "string" ? input.title : proposal.target?.title;
  const rows = Object.entries(FIELD_LABEL_KEYS).flatMap(([key, labelKey]) => {
    const value = input[key];
    if (value === undefined || value === null || value === "") return [];
    const freqKey = FREQUENCY_KEYS[String(value)];
    const text = key === "frequency" ? (freqKey ? tr(freqKey) : String(value))
      : DATE_FIELDS.has(key) ? formatDate(String(value))
      : typeof value === "boolean" ? (value ? tr("aiAssistant.boolYes") : tr("aiAssistant.boolNo")) : String(value);
    return [[tr(labelKey), text] as const];
  });
  if (proposal.target) rows.unshift([tr("aiAssistant.field.card"), proposal.target.title]);
  const items = [
    ...((input.checklistItems ?? input.items ?? []) as string[]),
    ...((input.cards ?? []) as { title: string; dueDate?: string }[]).map((card) => card.dueDate ? `${card.title} · ${formatDate(card.dueDate)}` : card.title),
  ];

  const apply = async () => {
    if (busy || result || !boardId) return;
    setBusy(true);
    try {
      const response = await fetch("/api/ai/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ boardId, tool: proposal.tool, input, toolCallId, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
      });
      const output = await response.json().catch(() => ({}));
      setResult(response.ok ? output : { ok: false, error: output.error || tr("aiAssistant.proposalApplyError") });
      if (response.ok && output.ok) {
        void queryClient.invalidateQueries({ queryKey: ["board-calendar", boardId] });
        void queryClient.invalidateQueries({ queryKey: MY_TASKS_ROOT_KEY });
        router.refresh();
      }
    } catch {
      setResult({ ok: false, error: tr("aiAssistant.offlineRetryError") });
    } finally {
      setBusy(false);
    }
  };

  if (result && result.ok !== false) return <ActionCard output={result} onOpenCard={onOpenCard} />;
  if (dismissed) return <p className="text-xs text-muted-foreground">{tr("aiAssistant.dismissedProposal", { heading })}{name ? ` · ${name}` : ""}</p>;

  return (
    <div className="overflow-hidden rounded-lg border border-violet-500/30 bg-violet-500/5 text-xs">
      <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-violet-500/10">
        <Sparkles className="size-3.5 shrink-0 text-violet-600" />
        <span className="min-w-0 flex-1 truncate font-medium">{heading}{name ? `: ${name}` : ""}</span>
        <span className="shrink-0 text-violet-700 dark:text-violet-300">{open ? tr("aiAssistant.hide") : tr("aiAssistant.preview")}</span>
        <ChevronDown className={cn("size-3.5 shrink-0 transition-transform", open && "rotate-180")} />
      </button>
      {open ? (
        <div className="space-y-2 border-t border-violet-500/20 px-3 py-2.5">
          {rows.length > 0 ? (
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
              {rows.map(([label, text]) => (
                <div key={label} className="contents"><dt className="text-muted-foreground">{label}</dt><dd className="whitespace-pre-wrap break-words">{text}</dd></div>
              ))}
            </dl>
          ) : null}
          {items.length > 0 ? <ul className="list-disc space-y-0.5 pl-4">{items.map((item, index) => <li key={index}>{item}</li>)}</ul> : null}
          {proposal.confirmation === "explicit" ? <p className="text-amber-700 dark:text-amber-400">{tr("aiAssistant.hardToUndoWarn")}</p> : null}
          {result && !result.ok ? <p role="alert" className="text-destructive">{"error" in result ? result.error : tr("aiAssistant.proposalApplyError")}</p> : null}
          <div className="flex gap-2 pt-1">
            <Button type="button" size="sm" disabled={busy || !boardId} onClick={() => void apply()}>{busy ? tr("aiAssistant.applying") : tr("aiAssistant.agree")}</Button>
            <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => setDismissed(true)}>{tr("aiAssistant.skip")}</Button>
          </div>
        </div>
      ) : null}
    </div>
  );
};

/**
 * Component hiển thị Thẻ hành động (Action Card) trực quan sau khi Agent thực thi công cụ mutation.
 *
 * @param props.output - Dữ liệu kết quả trả về từ công cụ mutation của Agent.
 * @param props.onOpenCard - Callback mở modal chi tiết thẻ khi người dùng bấm nút "Mở thẻ".
 */
const ActionCard = ({
  output,
  onOpenCard,
}: {
  output: AssistantMutationOutput;
  onOpenCard: (cardId: string) => void;
}) => {
  if (output.ok && output.action === "task_edited") return <div className="space-y-2 rounded-lg border bg-card p-3 text-card-foreground"><p>{output.edit ? tr("aiAssistant.taskEdited") : tr("aiAssistant.noNewChanges")}</p>{output.edit && <AiEditUndoButton editId={output.edit.id} cardId={output.card.id} />}</div>;
  if (!output.ok) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
        <span>{output.error}</span>
      </div>
    );
  }

  if (output.action === "proposal") {
    return (
      <div className="space-y-1.5 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs">
        <p className="flex items-center gap-1.5 font-medium text-amber-700 dark:text-amber-400">
          <Sparkles className="size-3.5 shrink-0" />
          {tr("aiAssistant.proposalPending", { operation: tr(OPERATION_LABEL_KEYS[output.operation]) })}
        </p>
        {output.confirmation === "explicit" ? (
          <p className="text-muted-foreground">{tr("aiAssistant.confirmBeforeApply")}</p>
        ) : null}
        {output.target ? (
          <button type="button" onClick={() => onOpenCard(output.target!.id)} className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
            {tr("aiAssistant.openCardNamed", { title: output.target.title })}<ExternalLink className="size-3" />
          </button>
        ) : null}
      </div>
    );
  }

  if (output.action === "batch_created") {
    return (
      <div className="overflow-hidden rounded-lg border border-sky-500/30 bg-sky-500/5">
        <div className="flex items-center gap-2 border-b border-sky-500/20 px-3 py-2 text-xs font-medium text-sky-700 dark:text-sky-400">
          <CalendarDays className="size-4 shrink-0" />
          <span>{output.summary}</span>
        </div>
        <div className="max-h-60 divide-y divide-border/40 overflow-y-auto px-3 py-1 text-xs">
          {output.cards.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-2 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-foreground">{c.title}</p>
                <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <CalendarClock className="size-3 shrink-0" />
                  <span>{c.dueDate ? c.dueDate : tr("aiAssistant.noDue")}</span>
                  <span className="opacity-70">· {c.list}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => onOpenCard(c.id)}
                className="inline-flex shrink-0 items-center gap-0.5 text-[11px] font-medium text-primary hover:underline"
              >
                {tr("aiAssistant.openShort")} <ExternalLink className="size-2.5" />
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (output.action === "checklist_created") {
    return (
      <div className="overflow-hidden rounded-lg border border-indigo-500/30 bg-indigo-500/5">
        <div className="flex items-center gap-2 border-b border-indigo-500/20 px-3 py-2 text-xs font-medium text-indigo-700 dark:text-indigo-400">
          <ListChecks className="size-4 shrink-0" />
          <span>{tr("aiAssistant.checklistAdded", { title: output.checklistTitle })}</span>
        </div>
        <div className="space-y-1.5 px-3 py-2.5 text-xs">
          <p className="font-semibold text-foreground">{tr("aiAssistant.cardLabel", { title: output.card.title })}</p>
          <ul className="list-disc space-y-1 pl-4 text-muted-foreground">
            {output.items.map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => onOpenCard(output.card.id)}
            className="mt-1 inline-flex items-center gap-1 font-medium text-primary hover:underline"
          >
            {tr("aiAssistant.openCard")} <ExternalLink className="size-3" />
          </button>
        </div>
      </div>
    );
  }

  if (output.action === "checklist_item_updated") {
    return (
      <div className="space-y-1.5 rounded-lg border border-indigo-500/30 bg-indigo-500/5 p-3 text-xs">
        <p className="flex items-center gap-2 font-medium"><ListChecks className="size-4 shrink-0" />{tr("aiAssistant.checklistItemUpdated")}</p>
        <p className="font-semibold">{output.item.title}</p>
        <p className="text-muted-foreground">{output.item.isCompleted ? tr("aiAssistant.itemCompleted") : tr("aiAssistant.itemIncomplete")} · {output.item.dueDate ? tr("aiAssistant.duePrefix", { due: output.item.dueDate }) : tr("aiAssistant.noDue")}</p>
        <button type="button" onClick={() => onOpenCard(output.card.id)} className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
          {tr("aiAssistant.openCardNamed", { title: output.card.title })}<ExternalLink className="size-3" />
        </button>
      </div>
    );
  }

  if (output.action === "moved") {
    return (
      <div className="overflow-hidden rounded-lg border border-amber-500/30 bg-amber-500/5">
        <div className="flex items-center gap-2 border-b border-amber-500/20 px-3 py-2 text-xs font-medium text-amber-700 dark:text-amber-400">
          <CheckCircle2 className="size-4 shrink-0" />
          <span>{tr("aiAssistant.movedSuccess")}</span>
        </div>
        <div className="space-y-1.5 px-3 py-2.5 text-xs">
          <p className="text-sm font-semibold text-foreground">{output.card.title}</p>
          <p className="flex items-center gap-1.5 text-muted-foreground">
            <span>{output.fromList}</span>
            <ArrowRight className="size-3 text-muted-foreground" />
            <span className="font-semibold text-foreground">{output.toList}</span>
          </p>
          <button
            type="button"
            onClick={() => onOpenCard(output.card.id)}
            className="mt-1 inline-flex items-center gap-1 font-medium text-primary hover:underline"
          >
            {tr("aiAssistant.openCard")} <ExternalLink className="size-3" />
          </button>
        </div>
      </div>
    );
  }

  if (output.action === "archived") {
    return (
      <div className="overflow-hidden rounded-lg border border-slate-500/30 bg-slate-500/5">
        <div className="flex items-center gap-2 border-b border-slate-500/20 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300">
          <Archive className="size-4 shrink-0" />
          <span>{tr("aiAssistant.archivedTitle")}</span>
        </div>
        <div className="px-3 py-2.5 text-xs text-muted-foreground">
          {tr("aiAssistant.archivedBody", { title: output.cardTitle })}
        </div>
      </div>
    );
  }

  if (output.action === "dependency_created") {
    return (
      <div className="overflow-hidden rounded-lg border border-violet-500/30 bg-violet-500/5">
        <div className="flex items-center gap-2 border-b border-violet-500/20 px-3 py-2 text-xs font-medium text-violet-700 dark:text-violet-400">
          <GitBranch className="size-4 shrink-0" />
          <span>{tr("aiAssistant.depCreatedTitle")}</span>
        </div>
        <div className="space-y-2 px-3 py-2.5 text-xs">
          <div className="flex items-center justify-between gap-1.5 rounded-md bg-amber-500/10 p-2 text-amber-800 dark:text-amber-300">
            <span className="font-semibold truncate">1. {output.blockerCard.title}</span>
            <button
              type="button"
              onClick={() => onOpenCard(output.blockerCard.id)}
              className="inline-flex shrink-0 items-center gap-0.5 text-[11px] font-medium text-primary hover:underline"
            >
              {tr("aiAssistant.openShort")} <ExternalLink className="size-2.5" />
            </button>
          </div>
          <div className="flex items-center justify-center text-[11px] text-muted-foreground font-medium">
            <span>{tr("aiAssistant.depMustFinishBefore")}</span>
          </div>
          <div className="flex items-center justify-between gap-1.5 rounded-md bg-emerald-500/10 p-2 text-emerald-800 dark:text-emerald-300">
            <span className="font-semibold truncate">2. {output.blockedCard.title}</span>
            <button
              type="button"
              onClick={() => onOpenCard(output.blockedCard.id)}
              className="inline-flex shrink-0 items-center gap-0.5 text-[11px] font-medium text-primary hover:underline"
            >
              {tr("aiAssistant.openShort")} <ExternalLink className="size-2.5" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (output.action === "dependency_deleted") {
    return (
      <div className="overflow-hidden rounded-lg border border-slate-500/30 bg-slate-500/5">
        <div className="flex items-center gap-2 border-b border-slate-500/20 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-300">
          <GitBranch className="size-4 shrink-0" />
          <span>{tr("aiAssistant.depDeletedTitle")}</span>
        </div>
        <div className="px-3 py-2.5 text-xs text-muted-foreground">
          {tr("aiAssistant.depDeletedBody", { blocker: output.blockerCard.title, blocked: output.blockedCard.title })}
        </div>
      </div>
    );
  }

  const { card } = output;

  return (
    <div className="overflow-hidden rounded-lg border border-emerald-500/30 bg-emerald-500/5">
      <div className="flex items-center gap-2 border-b border-emerald-500/20 px-3 py-2 text-xs font-medium text-emerald-700 dark:text-emerald-400">
        <CheckCircle2 className="size-4 shrink-0" />
        {output.action === "created" ? tr("aiAssistant.createdDeadline") : tr("aiAssistant.updatedCard")}
      </div>
      <div className="space-y-1.5 px-3 py-2.5 text-xs">
        <p className="text-sm font-semibold text-foreground">{card.title}</p>
        <p className="flex items-center gap-1.5 text-muted-foreground">
          <CalendarClock className="size-3.5 shrink-0" />
          {card.dueDate ? tr("aiAssistant.duePrefix", { due: card.dueDate }) : tr("aiAssistant.noDeadline")}
        </p>
        <p className="text-muted-foreground">
          {tr("aiAssistant.listPrefix")} <span className="text-foreground">{card.list}</span>
          {card.assignees.length > 0 ? (
            <>
              {" · "}
              <User className="inline size-3" /> {card.assignees.join(", ")}
            </>
          ) : null}
        </p>
        {output.changes && output.changes.length > 0 ? (
          <ul className="list-disc space-y-0.5 pl-4 text-muted-foreground">
            {output.changes.map((change) => (
              <li key={change}>{change}</li>
            ))}
          </ul>
        ) : null}
        <button
          type="button"
          onClick={() => onOpenCard(card.id)}
          className="mt-1 inline-flex items-center gap-1 font-medium text-primary hover:underline"
        >
          {tr("aiAssistant.openCard")} <ExternalLink className="size-3" />
        </button>
      </div>
    </div>
  );
};

/**
 * Component hiển thị nhãn trạng thái tiến trình thực thi của một công cụ (Tool Call).
 *
 * @param props.toolName - Tên công cụ đang thực thi.
 * @param props.state - Trạng thái của công cụ ("call", "output-available", "output-error"...).
 */
const ToolStatus = ({ toolName, state, proposal }: { toolName: string; state: string; proposal?: boolean }) => {
  const done = state === "output-available";
  const failed = state === "output-error";
  const toolKeys = TOOL_LABEL_KEYS[toolName];

  return (
    <div className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11px] text-muted-foreground">
      {failed ? (
        <AlertTriangle className="size-3 text-destructive" />
      ) : done ? (
        <CheckCircle2 className="size-3 text-emerald-600" />
      ) : (
        <Loader2 className="size-3 animate-spin" />
      )}
      {proposal ? tr("aiAssistant.draftedProposal") : toolKeys ? tr(done ? toolKeys.done : toolKeys.running) : toolName}
    </div>
  );
};

/**
 * Component phân giải và hiển thị một phần con (Message Part) trong tin nhắn UI của Agent.
 * Tự động phân biệt giữa văn bản Markdown và phần tử thực thi công cụ (Tool Part).
 *
 * @param props.part - Phần con của tin nhắn (text hoặc tool call).
 * @param props.onOpenCard - Callback mở chi tiết thẻ khi tương tác với Action Card.
 */
const RenderPart = ({
  part,
  boardId,
  onOpenCard,
}: {
  part: MessagePart;
  boardId?: string;
  onOpenCard: (cardId: string) => void;
}) => {
  if (part.type === "text") {
    if (!part.text.trim()) {
      return null;
    }
    return <AssistantMarkdown text={part.text} />;
  }

  if (part.type === "file" && part.mediaType.startsWith("image/")) {
    return <img src={part.url} alt={tr("aiAssistant.attachedImageAlt")} className="max-h-40 rounded-lg border object-contain" />;
  }

  // AI SDK Core dynamic tool parts expose toolCallId + state
  if ("toolCallId" in part) {
    const toolName = part.type.replace(/^tool-/, "");
    const isMutation = MUTATION_TOOL_NAMES.has(toolName);

    return (
      <div className="space-y-2">
        <ToolStatus toolName={toolName} state={part.state} proposal={part.state === "output-available" && isProposal(part.output)} />
        {isMutation && part.state === "output-available" ? (
          isProposal(part.output) ? (part.output as AiProposal).edit
            ? <TaskEditProposal proposal={part.output as AiProposal} toolCallId={part.toolCallId} />
            : <ToolProposal proposal={part.output as AiProposal} toolCallId={part.toolCallId} boardId={boardId} onOpenCard={onOpenCard} /> : <ActionCard
            output={part.output as AssistantMutationOutput}
            onOpenCard={onOpenCard}
          />
        ) : null}
      </div>
    );
  }

  return null;
};

/**
 * Component hiển thị một tin nhắn hoàn chỉnh trong giao diện Trợ lý AI UniFlow Assistant.
 * Phân biệt tin nhắn từ người dùng (User Bubble) và từ trợ lý (Assistant Bubble kèm Avatar Sparkles).
 *
 * @param props.message - Đối tượng tin nhắn UI tuân thủ giao thức `BoardAssistantUIMessage`.
 * @param props.onOpenCard - Callback khi người dùng nhấp mở thẻ từ Action Card.
 */
export const AssistantMessage = ({
  message,
  boardId,
  onOpenCard,
}: {
  message: BoardAssistantUIMessage;
  boardId?: string;
  onOpenCard: (cardId: string) => void;
}) => {
  const isAssistant = message.role === "assistant";

  return (
    <div
      className={cn(
        "flex w-full gap-2.5",
        isAssistant ? "justify-start" : "justify-end",
      )}
    >
      {isAssistant ? (
        <AiLogo className="mt-0.5 size-7 select-none shadow-sm" />
      ) : null}

      <div
        className={cn(
          "max-w-[85%] space-y-2 rounded-2xl px-3.5 py-2.5 text-sm",
          isAssistant
            ? "border bg-card text-card-foreground shadow-sm"
            : "bg-primary text-primary-foreground",
        )}
      >
        {message.parts.map((part, index) => (
          <RenderPart
            key={`${message.id}-part-${index}`}
            part={part}
            boardId={boardId}
            onOpenCard={onOpenCard}
          />
        ))}
      </div>
    </div>
  );
};
