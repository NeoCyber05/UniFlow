"use client";

import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { AiProposal } from "@/lib/ai/assistant/policy";
import { tr } from "@/lib/i18n";
import { proposalRequestId, formatEditValues } from "@/web/lib/assistant-context";
import { Button } from "@/components/ui/button";
import { MY_TASKS_ROOT_KEY } from "@/lib/my-tasks/types";

const read = async (response: Response) => {
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || tr("aiAssistant.editActionError"));
  return result;
};

export const AiEditUndoButton = ({ editId, cardId, onUndone }: { editId: string; cardId: string; onUndone?: () => void }) => {
  const query = useQueryClient(); const busyRef = useRef(false);
  const [busy, setBusy] = useState(false); const [undone, setUndone] = useState(false); const [error, setError] = useState("");
  const undo = async () => {
    if (busyRef.current) return; busyRef.current = true; setBusy(true); setError("");
    try {
      await read(await fetch(`/api/ai/edits/${encodeURIComponent(editId)}/undo`, { method: "POST" }));
      setUndone(true); onUndone?.();
      await Promise.all([query.invalidateQueries({ queryKey: ["card", cardId] }), query.invalidateQueries({ queryKey: ["ai-task-edits", cardId] }), query.invalidateQueries({ queryKey: MY_TASKS_ROOT_KEY }), query.invalidateQueries({ queryKey: ["board-calendar"] }), query.invalidateQueries({ queryKey: ["card-checklists", cardId] })]);
    } catch (cause) { setError(cause instanceof Error ? cause.message : tr("aiAssistant.undoError")); }
    finally { busyRef.current = false; setBusy(false); }
  };
  return <span className="inline-flex flex-wrap items-center gap-2"><Button type="button" size="sm" variant="outline" disabled={busy || undone} onClick={() => void undo()}>{undone ? tr("aiAssistant.undone") : busy ? tr("aiAssistant.undoing") : tr("aiAssistant.undo")}</Button>{error && <span role="alert" className="text-xs text-destructive">{error}</span>}</span>;
};

export const TaskEditProposal = ({ proposal, toolCallId }: { proposal: AiProposal; toolCallId: string }) => {
  const query = useQueryClient(); const busyRef = useRef(false);
  const [busy, setBusy] = useState(false); const [result, setResult] = useState<{ edit: { id: string } | null } | null>(null); const [error, setError] = useState("");
  const apply = async () => {
    if (!proposal.edit || busyRef.current || result) return;
    const confirmed = proposal.confirmation === "explicit";
    if (confirmed && !window.confirm(tr("aiAssistant.confirmOverwrite"))) return;
    busyRef.current = true; setBusy(true); setError("");
    try {
      const edit = { operation: proposal.edit.operation, payload: proposal.edit.payload, cardId: proposal.edit.cardId, expectedUpdatedAt: proposal.edit.expectedUpdatedAt };
      const requestId = await proposalRequestId(`${toolCallId}:${JSON.stringify(edit)}`);
      const saved = await read(await fetch("/api/ai/edits", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...edit, requestId, confirmed }) }));
      setResult(saved);
      await Promise.all([query.invalidateQueries({ queryKey: ["card", edit.cardId] }), query.invalidateQueries({ queryKey: ["ai-task-edits", edit.cardId] }), query.invalidateQueries({ queryKey: MY_TASKS_ROOT_KEY }), query.invalidateQueries({ queryKey: ["board-calendar"] })]);
    } catch (cause) { setError(cause instanceof Error ? cause.message : tr("aiAssistant.applyError")); }
    finally { busyRef.current = false; setBusy(false); }
  };
  return <div className="space-y-2 rounded-lg border bg-card p-3 text-card-foreground">
    <p className="font-medium">{proposal.target?.title ?? tr("aiAssistant.proposalFallbackTitle")}</p>
    {proposal.edit ? <>
      <details open><summary className="text-xs font-medium">{tr("aiAssistant.beforeAfter")}</summary><dl className="mt-1 space-y-1 break-words text-xs"><dt>{tr("aiAssistant.before")}</dt><dd className="whitespace-pre-wrap">{formatEditValues(proposal.edit.before)}</dd><dt>{tr("aiAssistant.after")}</dt><dd className="whitespace-pre-wrap">{formatEditValues(proposal.edit.payload)}</dd></dl></details>
      {result ? <div role="status" className="space-y-2"><p>{result.edit ? tr("aiAssistant.appliedChanges") : tr("aiAssistant.noNewChanges")}</p>{result.edit && <AiEditUndoButton editId={result.edit.id} cardId={proposal.edit.cardId} />}</div> : <Button type="button" size="sm" disabled={busy} onClick={() => void apply()}>{busy ? tr("aiAssistant.applying") : tr("aiAssistant.apply")}</Button>}
    </> : <p className="text-xs text-muted-foreground">{tr("aiAssistant.proposalNoEditHint")}</p>}
    {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
  </div>;
};
