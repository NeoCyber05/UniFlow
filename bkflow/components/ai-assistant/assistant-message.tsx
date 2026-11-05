"use client";

import {
  AlertTriangle,
  Archive,
  ArrowRight,
  CalendarClock,
  CalendarPlus,
  CheckCircle2,
  ExternalLink,
  GitBranch,
  ListChecks,
  ListPlus,
  type LucideIcon,
  PencilLine,
  Repeat,
  Sparkles,
  User,
} from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type { BoardAssistantUIMessage } from "@/lib/ai/assistant/agent";
import { isChoiceOutput } from "@/lib/ai/assistant/choice-tool";
import type { AiOperation, AiProposal } from "@/lib/ai/assistant/policy";
import type { AssistantMutationOutput } from "@/lib/ai/assistant/tools";
import { intlDateFormat, tr } from "@/lib/i18n";
import type { CardMessageKey } from "@/lib/i18n/messages/vi-card";
import { formatEditValues } from "@/web/lib/assistant-context";

import { AiLogo } from "./ai-logo";
import { AssistantChart, isChartOutput } from "./assistant-chart";
import { AssistantMarkdown } from "./assistant-markdown";
import { ChoiceQuestion } from "./choice-question";
import { MessageActions } from "./message-actions";
import { useProposalActions } from "./proposal-decisions";
import { CardLink, ResultCard } from "./result-card";
import { AiEditUndoButton } from "./task-edit-controls";
import { TraceGroup, type TracePart } from "./trace-group";

export { TOOL_LABEL_KEYS } from "./tool-labels";

type MessagePart = BoardAssistantUIMessage["parts"][number];
type ToolPart = Extract<MessagePart, { toolCallId: string }>;

/** Công cụ ghi dữ liệu: kết quả hiện thành thẻ đề xuất / thẻ kết quả bên dưới câu trả lời. */
export const MUTATION_TOOL_NAMES = new Set([
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

export const isProposal = (output: unknown): output is AiProposal => (output as { action?: string } | null)?.action === "proposal";

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

const PROPOSAL_ICONS: Record<string, LucideIcon> = {
  createDeadlineCard: CalendarPlus,
  createRecurringSchedule: Repeat,
  batchCreateCards: ListPlus,
  createCardChecklist: ListChecks,
  updateChecklistItem: ListChecks,
  moveCard: ArrowRight,
  archiveCard: Archive,
  createCardDependency: GitBranch,
  deleteCardDependency: GitBranch,
  updateCardDeadline: CalendarClock,
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

/** Tên, icon và nội dung xem trước của một đề xuất; dùng cho thẻ trong chat và hàng ở cột "Chờ duyệt". */
export const describeProposal = (proposal: AiProposal) => {
  const input = proposal.input;
  const heading = proposal.edit
    ? tr(OPERATION_LABEL_KEYS[proposal.operation])
    : tr(PROPOSAL_HEADING_KEYS[proposal.tool] ?? OPERATION_LABEL_KEYS[proposal.operation]);
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
  const icon = proposal.edit ? PencilLine : PROPOSAL_ICONS[proposal.tool] ?? Sparkles;
  return { heading, name, rows, items, icon };
};

/** Phần xem trước của đề xuất: các trường thay đổi, danh sách việc, hoặc trước → sau khi sửa thẻ. */
export const ProposalPreview = ({ proposal }: { proposal: AiProposal }) => {
  const { rows, items } = describeProposal(proposal);
  if (proposal.edit) {
    return (
      <dl className="grid gap-2 sm:grid-cols-2">
        <div className="min-w-0 rounded-lg bg-muted/60 p-2"><dt className="mb-1 font-medium text-muted-foreground">{tr("aiAssistant.before")}</dt><dd className="whitespace-pre-wrap break-words">{formatEditValues(proposal.edit.before)}</dd></div>
        <div className="min-w-0 rounded-lg bg-muted/60 p-2"><dt className="mb-1 font-medium text-muted-foreground">{tr("aiAssistant.after")}</dt><dd className="whitespace-pre-wrap break-words">{formatEditValues(proposal.edit.payload)}</dd></div>
      </dl>
    );
  }
  return (
    <>
      {rows.length > 0 ? (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
          {rows.map(([label, text]) => (
            <div key={label} className="contents"><dt className="text-muted-foreground">{label}</dt><dd className="whitespace-pre-wrap break-words">{text}</dd></div>
          ))}
        </dl>
      ) : null}
      {items.length > 0 ? <ul className="list-disc space-y-0.5 pl-4">{items.map((item, index) => <li key={index}>{item}</li>)}</ul> : null}
    </>
  );
};

/** Đề xuất trong luồng chat. Bấm "Đồng ý" mới ghi dữ liệu; trên trang Trợ lý, trạng thái đồng bộ với cột "Chờ duyệt". */
const ProposalCard = ({ proposal, toolCallId, boardId, onOpenCard }: { proposal: AiProposal; toolCallId: string; boardId?: string; onOpenCard: (cardId: string) => void }) => {
  const { decision, apply, dismiss, busy, error, canApply } = useProposalActions({ proposal, toolCallId, boardId });
  const [open, setOpen] = useState(Boolean(proposal.edit));
  const { heading, name, icon } = describeProposal(proposal);

  if (decision?.status === "applied") {
    const output = decision.output as AssistantMutationOutput | undefined;
    return output && output.ok && output.action !== "proposal"
      ? <ActionCard output={output} onOpenCard={onOpenCard} />
      : <ResultCard icon={CheckCircle2} tone="success" title={tr("assistant.proposal.applied")} subtitle={name ? `${heading} · ${name}` : heading} />;
  }
  if (decision?.status === "dismissed") {
    return <p className="text-xs text-muted-foreground">{tr("aiAssistant.dismissedProposal", { heading })}{name ? ` · ${name}` : ""}</p>;
  }

  return (
    <ResultCard
      icon={icon}
      tone={proposal.confirmation === "explicit" ? "warning" : "default"}
      title={name ? `${heading} · ${name}` : heading}
      subtitle={tr("assistant.proposal.pendingHint")}
      actions={<>
        <Button type="button" size="sm" disabled={busy || !canApply} onClick={() => void apply()}>
          {busy ? tr("aiAssistant.applying") : tr("aiAssistant.agree")}
        </Button>
        <Button type="button" size="sm" variant="outline" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
          {open ? tr("aiAssistant.hide") : tr("aiAssistant.preview")}
        </Button>
        <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={dismiss}>{tr("aiAssistant.skip")}</Button>
      </>}
    >
      {open ? <ProposalPreview proposal={proposal} /> : null}
      {proposal.confirmation === "explicit" ? <p className="text-amber-700 dark:text-amber-400">{tr("aiAssistant.hardToUndoWarn")}</p> : null}
      {error ? <p role="alert" className="text-destructive">{error}</p> : null}
    </ResultCard>
  );
};

const OpenCard = ({ id, title, onOpenCard }: { id: string; title?: string; onOpenCard: (cardId: string) => void }) => (
  <CardLink onClick={() => onOpenCard(id)}>
    {title ? tr("aiAssistant.openCardNamed", { title }) : tr("aiAssistant.openCard")}<ExternalLink className="size-3" />
  </CardLink>
);

/** Kết quả sau khi ghi dữ liệu, cùng một khuôn thẻ cho mọi loại. */
export const ActionCard = ({ output, onOpenCard }: { output: AssistantMutationOutput; onOpenCard: (cardId: string) => void }) => {
  if (!output.ok) {
    return <ResultCard icon={AlertTriangle} tone="danger" title={output.error} />;
  }
  switch (output.action) {
    case "proposal":
      return null;
    case "task_edited":
      return (
        <ResultCard icon={PencilLine} tone="success" title={output.edit ? tr("aiAssistant.taskEdited") : tr("aiAssistant.noNewChanges")} subtitle={output.card.title || undefined}
          actions={output.edit ? <AiEditUndoButton editId={output.edit.id} cardId={output.card.id} /> : undefined} />
      );
    case "batch_created":
      return (
        <ResultCard icon={ListPlus} tone="success" title={output.summary}>
          <ul className="max-h-60 divide-y overflow-y-auto">
            {output.cards.map((card) => (
              <li key={card.id} className="flex items-center justify-between gap-2 py-1.5">
                <span className="min-w-0">
                  <span className="block truncate font-medium text-foreground">{card.title}</span>
                  <span className="block text-[11px] text-muted-foreground">{card.dueDate ?? tr("aiAssistant.noDue")} · {card.list}</span>
                </span>
                <CardLink onClick={() => onOpenCard(card.id)}>{tr("aiAssistant.openShort")}<ExternalLink className="size-3" /></CardLink>
              </li>
            ))}
          </ul>
        </ResultCard>
      );
    case "checklist_created":
      return (
        <ResultCard icon={ListChecks} tone="success" title={tr("aiAssistant.checklistAdded", { title: output.checklistTitle })} subtitle={tr("aiAssistant.cardLabel", { title: output.card.title })}
          actions={<OpenCard id={output.card.id} onOpenCard={onOpenCard} />}>
          <ul className="list-disc space-y-0.5 pl-4 text-muted-foreground">{output.items.map((item, index) => <li key={index}>{item}</li>)}</ul>
        </ResultCard>
      );
    case "checklist_item_updated":
      return (
        <ResultCard icon={ListChecks} tone="success" title={output.item.title}
          subtitle={`${output.item.isCompleted ? tr("aiAssistant.itemCompleted") : tr("aiAssistant.itemIncomplete")} · ${output.item.dueDate ? tr("aiAssistant.duePrefix", { due: output.item.dueDate }) : tr("aiAssistant.noDue")}`}
          actions={<OpenCard id={output.card.id} title={output.card.title} onOpenCard={onOpenCard} />} />
      );
    case "moved":
      return (
        <ResultCard icon={ArrowRight} tone="success" title={output.card.title}
          subtitle={<span className="inline-flex flex-wrap items-center gap-1.5">{output.fromList}<ArrowRight className="size-3" /><span className="font-medium text-foreground">{output.toList}</span></span>}
          actions={<OpenCard id={output.card.id} onOpenCard={onOpenCard} />} />
      );
    case "archived":
      return <ResultCard icon={Archive} tone="success" title={tr("aiAssistant.archivedTitle")} subtitle={tr("aiAssistant.archivedBody", { title: output.cardTitle })} />;
    case "dependency_created":
      return (
        <ResultCard icon={GitBranch} tone="success" title={tr("aiAssistant.depCreatedTitle")}
          actions={<><OpenCard id={output.blockerCard.id} title={output.blockerCard.title} onOpenCard={onOpenCard} /><OpenCard id={output.blockedCard.id} title={output.blockedCard.title} onOpenCard={onOpenCard} /></>}>
          <p className="flex flex-wrap items-center gap-1.5">
            <span className="font-medium">{output.blockerCard.title}</span>
            <ArrowRight className="size-3 text-muted-foreground" />
            <span className="font-medium">{output.blockedCard.title}</span>
          </p>
          <p className="text-muted-foreground">{tr("aiAssistant.depMustFinishBefore")}</p>
        </ResultCard>
      );
    case "dependency_deleted":
      return <ResultCard icon={GitBranch} tone="success" title={tr("aiAssistant.depDeletedTitle")} subtitle={tr("aiAssistant.depDeletedBody", { blocker: output.blockerCard.title, blocked: output.blockedCard.title })} />;
    default: {
      const { card } = output;
      return (
        <ResultCard icon={CheckCircle2} tone="success" title={card.title}
          subtitle={output.action === "created" ? tr("aiAssistant.createdDeadline") : tr("aiAssistant.updatedCard")}
          actions={<OpenCard id={card.id} onOpenCard={onOpenCard} />}>
          <p className="flex items-center gap-1.5 text-muted-foreground">
            <CalendarClock className="size-3.5 shrink-0" />
            {card.dueDate ? tr("aiAssistant.duePrefix", { due: card.dueDate }) : tr("aiAssistant.noDeadline")}
          </p>
          <p className="text-muted-foreground">
            {tr("aiAssistant.listPrefix")} <span className="text-foreground">{card.list}</span>
            {card.assignees.length > 0 ? <>{" · "}<User className="inline size-3" /> {card.assignees.join(", ")}</> : null}
          </p>
          {output.changes && output.changes.length > 0 ? (
            <ul className="list-disc space-y-0.5 pl-4 text-muted-foreground">{output.changes.map((change) => <li key={change}>{change}</li>)}</ul>
          ) : null}
        </ResultCard>
      );
    }
  }
};

/** Phần kết quả của một tool part (biểu đồ, câu hỏi lựa chọn, đề xuất hoặc kết quả ghi); bước tra cứu chỉ nằm trong dòng các bước. */
const ToolResult = ({ part, boardId, onOpenCard, onReply, answered }: {
  part: ToolPart;
  boardId?: string;
  onOpenCard: (cardId: string) => void;
  onReply?: (text: string) => void;
  answered: boolean;
}) => {
  if (part.state !== "output-available") return null;
  const toolName = part.type.replace(/^tool-/, "");
  if (isChartOutput(part.output)) return <AssistantChart chart={part.output.chart} onOpenCard={onOpenCard} />;
  if (isChoiceOutput(part.output)) return <ChoiceQuestion output={part.output} answered={answered} onReply={onReply} />;
  if (!MUTATION_TOOL_NAMES.has(toolName)) return null;
  const output = part.output as AssistantMutationOutput;
  if (isProposal(output)) return <ProposalCard proposal={output} toolCallId={part.toolCallId} boardId={boardId} onOpenCard={onOpenCard} />;
  // Hỏi lại (needsClarification) đã nằm trong câu trả lời bằng chữ.
  if (!output.ok && "needsClarification" in output) return null;
  return <ActionCard output={output} onOpenCard={onOpenCard} />;
};

const messageText = (message: BoardAssistantUIMessage) =>
  message.parts.flatMap((part) => (part.type === "text" && part.text.trim() ? [part.text] : [])).join("\n\n");

/**
 * Một tin trong chat. Tin người dùng: bong bóng xám bên phải. Tin trợ lý (không đóng khung):
 * dòng các bước → câu trả lời → biểu đồ / đề xuất / kết quả → thanh thao tác.
 */
export const AssistantMessage = ({
  message,
  boardId,
  onOpenCard,
  onReply,
  onRetry,
  isLatest = false,
  isStreaming = false,
}: {
  message: BoardAssistantUIMessage;
  boardId?: string;
  onOpenCard: (cardId: string) => void;
  /** Gửi một câu trả lời (từ câu hỏi lựa chọn). */
  onReply?: (text: string) => void;
  /** Hỏi lại câu trước (chỉ cho tin trả lời mới nhất). */
  onRetry?: () => void;
  isLatest?: boolean;
  isStreaming?: boolean;
}) => {
  if (message.role !== "assistant") {
    const text = messageText(message);
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] space-y-2 rounded-2xl bg-muted px-3.5 py-2 text-sm text-foreground">
          {message.parts.map((part, index) =>
            part.type === "file" && part.mediaType.startsWith("image/")
              ? <img key={index} src={part.url} alt={tr("aiAssistant.attachedImageAlt")} className="max-h-40 rounded-lg border object-contain" />
              : null)}
          {text ? <p className="whitespace-pre-wrap break-words">{text}</p> : null}
        </div>
      </div>
    );
  }

  const toolParts = message.parts.filter((part): part is ToolPart => "toolCallId" in part);
  const text = messageText(message);
  const traceParts: TracePart[] = toolParts.map((part) => ({
    id: part.toolCallId,
    tool: part.type.replace(/^tool-/, ""),
    state: part.state,
    proposal: part.state === "output-available" && isProposal(part.output),
  }));
  const working = isStreaming && isLatest;

  return (
    <div className="flex gap-2.5">
      <AiLogo className="mt-0.5 size-6 select-none" />
      <div className="min-w-0 flex-1 space-y-3">
        {traceParts.length > 0 ? <TraceGroup parts={traceParts} working={working} /> : null}
        {text ? <AssistantMarkdown text={text} /> : null}
        {toolParts.map((part) => (
          <ToolResult key={part.toolCallId} part={part} boardId={boardId} onOpenCard={onOpenCard} onReply={onReply} answered={!isLatest} />
        ))}
        {!working && (text || toolParts.length > 0) ? <MessageActions messageId={message.id} text={text} onRetry={onRetry} /> : null}
      </div>
    </div>
  );
};
