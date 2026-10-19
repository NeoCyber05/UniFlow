"use client";

import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { AiProposal } from "@/lib/ai/assistant/policy";
import { proposalRequestId, formatEditValues } from "@/web/lib/assistant-context";
import { Button } from "@/components/ui/button";
import { MY_TASKS_ROOT_KEY } from "@/lib/my-tasks/types";
import { useAuth } from "@/web/lib/auth";

const read = async (response: Response) => {
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "Chưa thực hiện được. Giữ nguyên nháp và thử lại.");
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
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Chưa hoàn tác được."); }
    finally { busyRef.current = false; setBusy(false); }
  };
  return <span className="inline-flex flex-wrap items-center gap-2"><Button type="button" size="sm" variant="outline" disabled={busy || undone} onClick={() => void undo()}>{undone ? "Đã hoàn tác" : busy ? "Đang hoàn tác…" : "Hoàn tác"}</Button>{error && <span role="alert" className="text-xs text-destructive">{error}</span>}</span>;
};

export const TaskEditProposal = ({ proposal, toolCallId }: { proposal: AiProposal; toolCallId: string }) => {
  const query = useQueryClient(); const busyRef = useRef(false);
  const [busy, setBusy] = useState(false); const [result, setResult] = useState<{ edit: { id: string } | null } | null>(null); const [error, setError] = useState("");
  const apply = async () => {
    if (!proposal.edit || busyRef.current || result) return;
    const confirmed = proposal.confirmation === "explicit";
    if (confirmed && !window.confirm("Thay đổi này sẽ xoá hoặc viết lại phần lớn nội dung công việc. Xác nhận áp dụng?")) return;
    busyRef.current = true; setBusy(true); setError("");
    try {
      const edit = { operation: proposal.edit.operation, payload: proposal.edit.payload, cardId: proposal.edit.cardId, expectedUpdatedAt: proposal.edit.expectedUpdatedAt };
      const requestId = await proposalRequestId(`${toolCallId}:${JSON.stringify(edit)}`);
      const saved = await read(await fetch("/api/ai/edits", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...edit, requestId, confirmed }) }));
      setResult(saved);
      await Promise.all([query.invalidateQueries({ queryKey: ["card", edit.cardId] }), query.invalidateQueries({ queryKey: ["ai-task-edits", edit.cardId] }), query.invalidateQueries({ queryKey: MY_TASKS_ROOT_KEY }), query.invalidateQueries({ queryKey: ["board-calendar"] })]);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Chưa áp dụng được."); }
    finally { busyRef.current = false; setBusy(false); }
  };
  return <div className="space-y-2 rounded-lg border bg-card p-3 text-card-foreground">
    <p className="font-medium">{proposal.target?.title ?? "Đề xuất thay đổi"}</p>
    {proposal.edit ? <>
      <details open><summary className="text-xs font-medium">Trước / Sau</summary><dl className="mt-1 space-y-1 break-words text-xs"><dt>Trước</dt><dd className="whitespace-pre-wrap">{formatEditValues(proposal.edit.before)}</dd><dt>Sau</dt><dd className="whitespace-pre-wrap">{formatEditValues(proposal.edit.payload)}</dd></dl></details>
      {result ? <div role="status" className="space-y-2"><p>{result.edit ? "Đã áp dụng thay đổi." : "Không có thay đổi mới."}</p>{result.edit && <AiEditUndoButton editId={result.edit.id} cardId={proposal.edit.cardId} />}</div> : <Button type="button" size="sm" disabled={busy} onClick={() => void apply()}>{busy ? "Đang áp dụng…" : "Áp dụng"}</Button>}
    </> : <p className="text-xs text-muted-foreground">Đề xuất chưa ghi dữ liệu. Dùng nút Thêm để tạo task mới hoặc mở công việc để thao tác này.</p>}
    {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
  </div>;
};

export const AiTaskHistory = ({ cardId }: { cardId: string }) => {
  const { userId } = useAuth();
  const { data, error, isFetching } = useQuery<{ edits: { id: string; operation: string; createdAt: string; undoneAt: string | null }[] }>({ queryKey: ["ai-task-edits", cardId, userId], enabled: Boolean(userId), queryFn: async () => read(await fetch(`/api/ai/edits?cardId=${encodeURIComponent(cardId)}`)), retry: false });
  const labels: Record<string, string> = { edit_task_content: "Sửa nội dung", add_checklist: "Thêm checklist", set_schedule: "Đổi lịch làm", set_deadline: "Đổi hạn nộp" };
  return <details className="rounded-lg border p-3"><summary className="cursor-pointer text-sm font-medium">Thay đổi bởi AI</summary>{isFetching ? <p role="status">Đang tải lịch sử…</p> : error ? <p role="alert" className="mt-2 text-sm">Chưa tải được lịch sử AI. Thử mở lại công việc.</p> : <ul className="mt-2 space-y-2">{data?.edits.map(edit => <li key={edit.id} className="flex flex-wrap items-center justify-between gap-2 text-xs"><span>{labels[edit.operation] ?? "Chỉnh sửa"} · {new Date(edit.createdAt).toLocaleString("vi-VN")}</span>{edit.undoneAt ? <span>Đã hoàn tác</span> : <AiEditUndoButton editId={edit.id} cardId={cardId} />}</li>)}{data?.edits.length === 0 && <li>Chưa có thay đổi AI.</li>}</ul>}</details>;
};
