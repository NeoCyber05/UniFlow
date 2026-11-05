"use client";

import { CheckCircle2, ExternalLink, Inbox } from "lucide-react";

import { describeProposal, ProposalPreview } from "@/components/ai-assistant/assistant-message";
import { useProposalActions } from "@/components/ai-assistant/proposal-decisions";
import { CardLink, IconTile } from "@/components/ai-assistant/result-card";
import { AiEditUndoButton } from "@/components/ai-assistant/task-edit-controls";
import { Button } from "@/components/ui/button";
import type { AiProposal } from "@/lib/ai/assistant/policy";
import { appliedChanges, type ProposalEntry } from "@/lib/ai/assistant/threads-shared";
import type { AssistantMutationOutput } from "@/lib/ai/assistant/tools";
import { intlDateFormat, tr } from "@/lib/i18n";
import { useState } from "react";

import type { AssistantBoard } from "./api";
import { ScopeSelect } from "./scope-select";

const scrollToMessage = (messageId: string) =>
  document.getElementById(`assistant-msg-${messageId}`)?.scrollIntoView({ block: "center", behavior: "smooth" });

/** Một đề xuất chưa trả lời: Đồng ý / Bỏ ngay tại đây; thẻ trong luồng chat cập nhật theo. */
const PendingRow = ({ entry, boardId }: { entry: ProposalEntry; boardId: string }) => {
  const proposal = entry.output as unknown as AiProposal;
  const { apply, dismiss, busy, error, canApply } = useProposalActions({ proposal, toolCallId: entry.toolCallId, boardId });
  const [open, setOpen] = useState(false);
  const { heading, name, icon } = describeProposal(proposal);
  return (
    <li className="space-y-2 p-3">
      <div className="flex items-start gap-2.5">
        <IconTile icon={icon} tone={proposal.confirmation === "explicit" ? "warning" : "default"} />
        <div className="min-w-0 flex-1">
          <p className="break-words text-sm font-medium leading-snug">{name ? `${heading} · ${name}` : heading}</p>
          <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs">
            <button type="button" className="text-violet-700 hover:underline dark:text-violet-300" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
              {open ? tr("aiAssistant.hide") : tr("aiAssistant.preview")}
            </button>
            <button type="button" className="text-muted-foreground hover:text-foreground hover:underline" onClick={() => scrollToMessage(entry.messageId)}>
              {tr("assistant.panel.showInChat")}
            </button>
          </div>
        </div>
      </div>
      {open ? <div className="space-y-2 rounded-lg bg-muted/50 p-2 text-xs"><ProposalPreview proposal={proposal} /></div> : null}
      {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
      <div className="flex gap-2 pl-[38px]">
        <Button type="button" size="sm" disabled={busy || !canApply} onClick={() => void apply()}>{busy ? tr("aiAssistant.applying") : tr("aiAssistant.agree")}</Button>
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={dismiss}>{tr("assistant.panel.dismiss")}</Button>
      </div>
    </li>
  );
};

const appliedSummary = (entry: ProposalEntry) => {
  const output = entry.decision?.output as AssistantMutationOutput | undefined;
  const { heading, name } = describeProposal(entry.output as unknown as AiProposal);
  const fallback = name ? `${heading} · ${name}` : heading;
  if (!output || !output.ok) return { text: fallback, cardId: null as string | null, editId: null as string | null };
  switch (output.action) {
    case "task_edited": return { text: `${tr("aiAssistant.taskEdited")} · ${output.card.title || name || ""}`.replace(/ · $/, ""), cardId: output.card.id, editId: output.edit?.id ?? null };
    case "batch_created": return { text: output.summary, cardId: output.cards[0]?.id ?? null, editId: null };
    case "moved": return { text: `${output.card.title}: ${output.fromList} → ${output.toList}`, cardId: output.card.id, editId: null };
    case "checklist_created": return { text: `${tr("aiAssistant.checklistAdded", { title: output.checklistTitle })} · ${output.card.title}`, cardId: output.card.id, editId: null };
    case "checklist_item_updated": return { text: `${output.item.title} · ${output.card.title}`, cardId: output.card.id, editId: null };
    case "archived": return { text: `${tr("aiAssistant.archivedTitle")} · ${output.cardTitle}`, cardId: null, editId: null };
    case "dependency_created":
    case "dependency_deleted": return { text: `${output.blockerCard.title} → ${output.blockedCard.title}`, cardId: output.blockedCard.id, editId: null };
    case "created":
    case "updated": return { text: `${output.action === "created" ? tr("aiAssistant.createdDeadline") : tr("aiAssistant.updatedCard")} · ${output.card.title}`, cardId: output.card.id, editId: null };
    default: return { text: fallback, cardId: null, editId: null };
  }
};

/**
 * Cột phải của trang Trợ lý: phạm vi (bảng đích), đề xuất chờ duyệt có đếm số,
 * và nhật ký thay đổi đã áp dụng trong cuộc trò chuyện (Hoàn tác khi hỗ trợ, còn lại Mở thẻ).
 */
export const ContextPanel = ({ boards, boardId, onBoardChange, proposals, onOpenCard }: {
  boards: AssistantBoard[];
  boardId: string;
  onBoardChange: (boardId: string) => void;
  proposals: ProposalEntry[];
  onOpenCard: (cardId: string) => void;
}) => {
  const pending = proposals.filter((entry) => !entry.decision);
  const applied = appliedChanges(proposals);
  const time = intlDateFormat({ hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto">
      <section aria-labelledby="assistant-scope" className="space-y-2 border-b p-4">
        <h2 id="assistant-scope" className="text-sm font-semibold">{tr("assistant.panel.scope")}</h2>
        <ScopeSelect boards={boards} value={boardId} onChange={onBoardChange} />
        <p className="text-xs text-muted-foreground">{tr("assistant.scope.help")}</p>
      </section>

      <section aria-labelledby="assistant-pending" className="space-y-2 border-b p-4">
        <h2 id="assistant-pending" className="flex items-center gap-2 text-sm font-semibold">
          {tr("assistant.panel.pending")}
          {pending.length > 0 ? <span className="rounded-full bg-violet-600 px-1.5 py-0.5 text-[10px] font-bold tabular-nums leading-none text-white">{pending.length}</span> : null}
        </h2>
        {pending.length > 0 ? (
          <ul className="divide-y rounded-xl border bg-card">
            {pending.map((entry) => <PendingRow key={entry.toolCallId} entry={entry} boardId={boardId} />)}
          </ul>
        ) : (
          <p className="flex items-center gap-2 text-xs text-muted-foreground"><Inbox aria-hidden="true" className="size-3.5" />{tr("assistant.panel.pendingEmpty")}</p>
        )}
      </section>

      <section aria-labelledby="assistant-applied" className="space-y-2 p-4">
        <h2 id="assistant-applied" className="text-sm font-semibold">{tr("assistant.panel.applied")}</h2>
        {applied.length > 0 ? (
          <ol className="relative space-y-3 border-l pl-4">
            {applied.map((entry) => {
              const { text, cardId, editId } = appliedSummary(entry);
              return (
                <li key={entry.toolCallId} className="relative space-y-1">
                  <span aria-hidden="true" className="absolute -left-[21px] top-1 size-2.5 rounded-full border-2 border-background bg-emerald-600" />
                  <p className="text-xs"><span className="mr-1.5 font-mono tabular-nums text-muted-foreground">{time.format(new Date(entry.decision!.at))}</span>{text}</p>
                  <div className="flex flex-wrap items-center gap-2">
                    {editId && cardId ? <AiEditUndoButton editId={editId} cardId={cardId} /> : null}
                    {cardId ? <CardLink onClick={() => onOpenCard(cardId)}>{tr("aiAssistant.openShort")}<ExternalLink className="size-3" /></CardLink> : null}
                  </div>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="flex items-center gap-2 text-xs text-muted-foreground"><CheckCircle2 aria-hidden="true" className="size-3.5" />{tr("assistant.panel.appliedEmpty")}</p>
        )}
      </section>
    </div>
  );
};
