"use client";

import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { tr } from "@/lib/i18n";
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
