"use client";

import type { BoardAssistantUIMessage } from "@/lib/ai/assistant/agent";
import type { ThreadDecisions, ThreadDecisionStatus, ThreadSummary } from "@/lib/ai/assistant/threads-shared";
import type { loadAssistantHome } from "@/server/views/assistant-home";

export type AssistantBoard = { id: string; title: string };
export type ThreadsPayload = { threads: ThreadSummary[]; boards: AssistantBoard[]; defaultBoardId: string | null; enabled: boolean };
export type ThreadDetail = ThreadSummary & { decisions: ThreadDecisions };
export type ThreadPayload = { thread: ThreadDetail; messages: BoardAssistantUIMessage[] };
export type AssistantHomeView = Awaited<ReturnType<typeof loadAssistantHome>>;

export const THREADS_KEY = ["assistant-threads"] as const;
export const threadKey = (id: string) => ["assistant-thread", id] as const;

const request = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(url, {
    ...init,
    headers: init?.body ? { "Content-Type": "application/json", ...init.headers } : init?.headers,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error((body as { error?: string }).error || `HTTP ${response.status}`), { status: response.status });
  return body as T;
};

export const fetchThreads = () => request<ThreadsPayload>("/api/ai/threads");
export const fetchThread = (id: string) => request<ThreadPayload>(`/api/ai/threads/${encodeURIComponent(id)}`);
export const createThread = (boardId?: string | null) =>
  request<{ thread: ThreadSummary }>("/api/ai/threads", { method: "POST", body: JSON.stringify(boardId ? { boardId } : {}) });
export const patchThread = (id: string, patch: { title?: string; pinned?: boolean; boardId?: string }) =>
  request<{ thread: ThreadDetail }>(`/api/ai/threads/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(patch) });
export const deleteThread = (id: string) => request<{ ok: true }>(`/api/ai/threads/${encodeURIComponent(id)}`, { method: "DELETE" });
export const postDecision = (id: string, toolCallId: string, status: ThreadDecisionStatus, output?: unknown) =>
  request<{ decisions: ThreadDecisions }>(`/api/ai/threads/${encodeURIComponent(id)}/decisions`, {
    method: "POST",
    body: JSON.stringify({ toolCallId, status, ...(output !== undefined && { output }) }),
  });
