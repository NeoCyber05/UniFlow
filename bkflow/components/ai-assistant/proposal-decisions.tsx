"use client";

import { createContext, type ReactNode, useCallback, useContext, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import type { AiProposal } from "@/lib/ai/assistant/policy";
import type { ThreadDecision, ThreadDecisions, ThreadDecisionStatus } from "@/lib/ai/assistant/threads-shared";
import { tr } from "@/lib/i18n";
import { MY_TASKS_ROOT_KEY } from "@/lib/my-tasks/types";
import { proposalRequestId } from "@/web/lib/assistant-context";
import { useRouter } from "@/web/shims/next-navigation";

type DecisionApi = {
  decisions: ThreadDecisions;
  record: (toolCallId: string, status: ThreadDecisionStatus, output?: unknown) => void;
};

const ProposalDecisionsContext = createContext<DecisionApi | null>(null);

/** Trang Trợ lý cá nhân cung cấp quyết định đã lưu; cửa sổ nổi không có provider và giữ trạng thái trong component. */
export const ProposalDecisionsProvider = ({ value, children }: { value: DecisionApi; children: ReactNode }) => (
  <ProposalDecisionsContext.Provider value={value}>{children}</ProposalDecisionsContext.Provider>
);

export const useProposalDecisions = () => useContext(ProposalDecisionsContext);

// Một đề xuất có thể hiện ở cả luồng chat lẫn cột "Chờ duyệt": chặn bấm Đồng ý hai lần cùng lúc.
const inFlight = new Set<string>();

const readJson = async (response: Response) => response.json().catch(() => ({})) as Promise<Record<string, unknown>>;

/** Áp dụng hoặc bỏ một đề xuất AI; dùng chung cho thẻ trong chat và hàng trong cột "Chờ duyệt". */
export const useProposalActions = ({ proposal, toolCallId, boardId }: { proposal: AiProposal; toolCallId: string; boardId?: string }) => {
  const api = useProposalDecisions();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [local, setLocal] = useState<ThreadDecision | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const decision = api?.decisions[toolCallId] ?? local;

  const settle = useCallback((status: ThreadDecisionStatus, output?: unknown) => {
    const next: ThreadDecision = { status, at: new Date().toISOString(), ...(output !== undefined && { output }) };
    setLocal(next);
    api?.record(toolCallId, status, output);
  }, [api, toolCallId]);

  const refresh = useCallback(async (cardId?: string) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["board-calendar"] }),
      queryClient.invalidateQueries({ queryKey: MY_TASKS_ROOT_KEY }),
      ...(cardId ? [
        queryClient.invalidateQueries({ queryKey: ["card", cardId] }),
        queryClient.invalidateQueries({ queryKey: ["ai-task-edits", cardId] }),
      ] : []),
    ]);
    router.refresh();
  }, [queryClient, router]);

  const apply = useCallback(async () => {
    if (decision || inFlight.has(toolCallId)) return;
    const edit = proposal.edit;
    if (edit && proposal.confirmation === "explicit" && !window.confirm(tr("aiAssistant.confirmOverwrite"))) return;
    if (!edit && !boardId) return;
    inFlight.add(toolCallId);
    setBusy(true);
    setError("");
    try {
      if (edit) {
        const body = { operation: edit.operation, payload: edit.payload, cardId: edit.cardId, expectedUpdatedAt: edit.expectedUpdatedAt };
        const requestId = await proposalRequestId(`${toolCallId}:${JSON.stringify(body)}`);
        const response = await fetch("/api/ai/edits", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...body, requestId, confirmed: proposal.confirmation === "explicit" }),
        });
        const saved = await readJson(response);
        if (!response.ok) throw new Error(typeof saved.error === "string" ? saved.error : tr("aiAssistant.applyError"));
        settle("applied", { ok: true, action: "task_edited", edit: saved.edit ?? null, card: { id: edit.cardId, title: proposal.target?.title ?? "" } });
        await refresh(edit.cardId);
      } else {
        const response = await fetch("/api/ai/proposals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ boardId, tool: proposal.tool, input: proposal.input, toolCallId, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
        });
        const output = await readJson(response);
        if (!response.ok || output.ok === false) {
          throw new Error(typeof output.error === "string" ? output.error : tr("aiAssistant.proposalApplyError"));
        }
        settle("applied", output);
        await refresh((output.card as { id?: string } | undefined)?.id);
      }
    } catch (cause) {
      setError(cause instanceof TypeError ? tr("aiAssistant.offlineRetryError") : cause instanceof Error ? cause.message : tr("aiAssistant.proposalApplyError"));
    } finally {
      inFlight.delete(toolCallId);
      setBusy(false);
    }
  }, [boardId, decision, proposal, refresh, settle, toolCallId]);

  const dismiss = useCallback(() => {
    if (decision || busy) return;
    settle("dismissed");
  }, [busy, decision, settle]);

  return { decision, apply, dismiss, busy, error, canApply: Boolean(proposal.edit) || Boolean(boardId) };
};
