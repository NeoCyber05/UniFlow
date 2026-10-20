"use client";

import {
  AlertTriangle,
  Archive,
  ArrowRight,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ExternalLink,
  GitBranch,
  ListChecks,
  Loader2,
  Sparkles,
  User,
} from "lucide-react";

import type { BoardAssistantUIMessage } from "@/lib/ai/assistant/agent";
import type { AiOperation } from "@/lib/ai/assistant/policy";
import type { AssistantMutationOutput } from "@/lib/ai/assistant/tools";
import { cn } from "@/lib/utils";

import { AssistantMarkdown } from "./assistant-markdown";
import { TaskEditProposal, AiEditUndoButton } from "./task-edit-controls";

type MessagePart = BoardAssistantUIMessage["parts"][number];

/**
 * Ánh xạ định danh kỹ thuật của công cụ sang nhãn hiển thị trạng thái tiếng Việt
 * thân thiện với người dùng trong quá trình Agent thực thi tool calls.
 */
const TOOL_LABELS: Record<string, string> = {
  searchWorkspace: "Đang tìm trong workspace",
  getPage: "Đang đọc trang ghi chú",
  getMyAgenda: "Đang tổng hợp lịch việc cá nhân",
  updateChecklistItem: "Đang cập nhật mục checklist",
  getDeadlines: "Đang tra cứu deadline",
  getBoardProgress: "Đang thống kê tiến độ bảng",
  findCards: "Đang tìm thẻ",
  getCardDetails: "Đang đọc chi tiết thẻ",
  createDeadlineCard: "Đang tạo deadline",
  createRecurringSchedule: "Đang tạo chuỗi lịch định kỳ",
  batchCreateCards: "Đang tạo danh sách công việc",
  createCardChecklist: "Đang thêm checklist vào thẻ",
  moveCard: "Đang di chuyển thẻ",
  updateCardDeadline: "Đang cập nhật hạn chót",
  updateCardDetails: "Đang cập nhật thông tin thẻ",
  archiveCard: "Đang lưu trữ thẻ",
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

const OPERATION_LABELS: Record<AiOperation, string> = {
  answer: "Trả lời",
  edit_page: "Sửa trang",
  edit_task_content: "Sửa nội dung thẻ",
  add_checklist: "Thêm checklist",
  set_schedule: "Đặt lịch",
  set_deadline: "Đặt hạn",
  batch_update: "Cập nhật nhiều việc",
  replace_content: "Xóa hoặc thay nội dung",
};

const isProposal = (output: unknown) => (output as { action?: string } | null)?.action === "proposal";

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
  if (output.ok && output.action === "task_edited") return <div className="space-y-2 rounded-lg border bg-card p-3 text-card-foreground"><p>{output.edit ? "Đã sửa công việc." : "Không có thay đổi mới."}</p>{output.edit && <AiEditUndoButton editId={output.edit.id} cardId={output.card.id} />}</div>;
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
          Đề xuất: {OPERATION_LABELS[output.operation]} · chưa áp dụng
        </p>
        {output.confirmation === "explicit" ? (
          <p className="text-muted-foreground">Thay đổi này cần bạn xác nhận trước khi áp dụng.</p>
        ) : null}
        {output.target ? (
          <button type="button" onClick={() => onOpenCard(output.target!.id)} className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
            Mở thẻ: {output.target.title}<ExternalLink className="size-3" />
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
                  <span>{c.dueDate ? c.dueDate : "Chưa có hạn"}</span>
                  <span className="opacity-70">· {c.list}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => onOpenCard(c.id)}
                className="inline-flex shrink-0 items-center gap-0.5 text-[11px] font-medium text-primary hover:underline"
              >
                Mở <ExternalLink className="size-2.5" />
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
          <span>Đã thêm checklist: {output.checklistTitle}</span>
        </div>
        <div className="space-y-1.5 px-3 py-2.5 text-xs">
          <p className="font-semibold text-foreground">Thẻ: {output.card.title}</p>
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
            Mở thẻ <ExternalLink className="size-3" />
          </button>
        </div>
      </div>
    );
  }

  if (output.action === "checklist_item_updated") {
    return (
      <div className="space-y-1.5 rounded-lg border border-indigo-500/30 bg-indigo-500/5 p-3 text-xs">
        <p className="flex items-center gap-2 font-medium"><ListChecks className="size-4 shrink-0" />Đã cập nhật mục checklist</p>
        <p className="font-semibold">{output.item.title}</p>
        <p className="text-muted-foreground">{output.item.isCompleted ? "Đã hoàn thành" : "Chưa hoàn thành"}{output.item.dueDate ? ` · Hạn: ${output.item.dueDate}` : " · Chưa có hạn"}</p>
        <button type="button" onClick={() => onOpenCard(output.card.id)} className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
          Mở thẻ: {output.card.title}<ExternalLink className="size-3" />
        </button>
      </div>
    );
  }

  if (output.action === "moved") {
    return (
      <div className="overflow-hidden rounded-lg border border-amber-500/30 bg-amber-500/5">
        <div className="flex items-center gap-2 border-b border-amber-500/20 px-3 py-2 text-xs font-medium text-amber-700 dark:text-amber-400">
          <CheckCircle2 className="size-4 shrink-0" />
          <span>Đã chuyển cột thành công</span>
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
            Mở thẻ <ExternalLink className="size-3" />
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
          <span>Đã lưu trữ thẻ</span>
        </div>
        <div className="px-3 py-2.5 text-xs text-muted-foreground">
          Thẻ <span className="font-semibold text-foreground">&quot;{output.cardTitle}&quot;</span> đã được đưa vào kho lưu trữ.
        </div>
      </div>
    );
  }

  if (output.action === "dependency_created") {
    return (
      <div className="overflow-hidden rounded-lg border border-violet-500/30 bg-violet-500/5">
        <div className="flex items-center gap-2 border-b border-violet-500/20 px-3 py-2 text-xs font-medium text-violet-700 dark:text-violet-400">
          <GitBranch className="size-4 shrink-0" />
          <span>Đã thiết lập liên kết phụ thuộc</span>
        </div>
        <div className="space-y-2 px-3 py-2.5 text-xs">
          <div className="flex items-center justify-between gap-1.5 rounded-md bg-amber-500/10 p-2 text-amber-800 dark:text-amber-300">
            <span className="font-semibold truncate">1. {output.blockerCard.title}</span>
            <button
              type="button"
              onClick={() => onOpenCard(output.blockerCard.id)}
              className="inline-flex shrink-0 items-center gap-0.5 text-[11px] font-medium text-primary hover:underline"
            >
              Mở <ExternalLink className="size-2.5" />
            </button>
          </div>
          <div className="flex items-center justify-center text-[11px] text-muted-foreground font-medium">
            <span>phải xong trước khi làm ➔</span>
          </div>
          <div className="flex items-center justify-between gap-1.5 rounded-md bg-emerald-500/10 p-2 text-emerald-800 dark:text-emerald-300">
            <span className="font-semibold truncate">2. {output.blockedCard.title}</span>
            <button
              type="button"
              onClick={() => onOpenCard(output.blockedCard.id)}
              className="inline-flex shrink-0 items-center gap-0.5 text-[11px] font-medium text-primary hover:underline"
            >
              Mở <ExternalLink className="size-2.5" />
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
          <span>Đã gỡ bỏ liên kết phụ thuộc</span>
        </div>
        <div className="px-3 py-2.5 text-xs text-muted-foreground">
          Đã xóa liên kết phụ thuộc giữa thẻ <span className="font-semibold text-foreground">&quot;{output.blockerCard.title}&quot;</span> và <span className="font-semibold text-foreground">&quot;{output.blockedCard.title}&quot;</span>.
        </div>
      </div>
    );
  }

  const { card } = output;

  return (
    <div className="overflow-hidden rounded-lg border border-emerald-500/30 bg-emerald-500/5">
      <div className="flex items-center gap-2 border-b border-emerald-500/20 px-3 py-2 text-xs font-medium text-emerald-700 dark:text-emerald-400">
        <CheckCircle2 className="size-4 shrink-0" />
        {output.action === "created" ? "Đã tạo deadline mới" : "Đã cập nhật thẻ"}
      </div>
      <div className="space-y-1.5 px-3 py-2.5 text-xs">
        <p className="text-sm font-semibold text-foreground">{card.title}</p>
        <p className="flex items-center gap-1.5 text-muted-foreground">
          <CalendarClock className="size-3.5 shrink-0" />
          {card.dueDate ? `Hạn: ${card.dueDate}` : "Chưa có hạn chót"}
        </p>
        <p className="text-muted-foreground">
          Cột: <span className="text-foreground">{card.list}</span>
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
          Mở thẻ <ExternalLink className="size-3" />
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

  return (
    <div className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[11px] text-muted-foreground">
      {failed ? (
        <AlertTriangle className="size-3 text-destructive" />
      ) : done ? (
        <CheckCircle2 className="size-3 text-emerald-600" />
      ) : (
        <Loader2 className="size-3 animate-spin" />
      )}
      {proposal ? "Đã soạn đề xuất" : (TOOL_LABELS[toolName] ?? toolName).replace(/^Đang /, done ? "Đã " : "Đang ")}
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
  onOpenCard,
}: {
  part: MessagePart;
  onOpenCard: (cardId: string) => void;
}) => {
  if (part.type === "text") {
    if (!part.text.trim()) {
      return null;
    }
    return <AssistantMarkdown text={part.text} />;
  }

  if (part.type === "file" && part.mediaType.startsWith("image/")) {
    return <img src={part.url} alt="Ảnh đính kèm" className="max-h-40 rounded-lg border object-contain" />;
  }

  // AI SDK Core dynamic tool parts expose toolCallId + state
  if ("toolCallId" in part) {
    const toolName = part.type.replace(/^tool-/, "");
    const isMutation = MUTATION_TOOL_NAMES.has(toolName);

    return (
      <div className="space-y-2">
        <ToolStatus toolName={toolName} state={part.state} proposal={part.state === "output-available" && isProposal(part.output)} />
        {isMutation && part.state === "output-available" ? (
          isProposal(part.output) ? <TaskEditProposal proposal={part.output as import("@/lib/ai/assistant/policy").AiProposal} toolCallId={part.toolCallId} /> : <ActionCard
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
  onOpenCard,
}: {
  message: BoardAssistantUIMessage;
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
        <div className="mt-0.5 flex size-7 shrink-0 select-none items-center justify-center rounded-full bg-gradient-to-br from-violet-600 to-sky-500 text-white shadow-sm">
          <Sparkles className="size-3.5" />
        </div>
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
            onOpenCard={onOpenCard}
          />
        ))}
      </div>
    </div>
  );
};
