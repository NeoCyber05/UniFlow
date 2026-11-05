// Phần thuần của trang Trợ lý cá nhân, dùng chung cho server và client.

export const THREAD_TITLE_MAX = 60;

export type ThreadDecisionStatus = "applied" | "dismissed";
export type ThreadDecision = { status: ThreadDecisionStatus; at: string; output?: unknown };
export type ThreadDecisions = Record<string, ThreadDecision>;

export type ThreadSummary = {
  id: string;
  title: string;
  boardId: string;
  pinnedAt: string | null;
  updatedAt: string;
  createdAt: string;
};

/** Tiêu đề tự đặt từ câu hỏi đầu: gọn khoảng trắng, cắt theo từ, tối đa 60 ký tự. */
export const deriveThreadTitle = (text: string, max = THREAD_TITLE_MAX): string => {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,.;:–-]+$/, "")}…`;
};

export const parseThreadDecisions = (value: unknown): ThreadDecisions => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result: ThreadDecisions = {};
  for (const [id, item] of Object.entries(value as Record<string, unknown>)) {
    const decision = item as Partial<ThreadDecision> | null;
    if (decision && (decision.status === "applied" || decision.status === "dismissed") && typeof decision.at === "string") {
      result[id] = { status: decision.status, at: decision.at, ...(decision.output !== undefined && { output: decision.output }) };
    }
  }
  return result;
};

export type ThreadGroupKey = "pinned" | "today" | "week" | "older";
export const THREAD_GROUP_ORDER: readonly ThreadGroupKey[] = ["pinned", "today", "week", "older"];

/** Chia danh sách theo Đã ghim / Hôm nay / 7 ngày qua / Cũ hơn (theo giờ máy người dùng). */
export const groupThreads = <T extends Pick<ThreadSummary, "pinnedAt" | "updatedAt">>(threads: T[], now: Date) => {
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const weekAgo = new Date(startOfToday);
  weekAgo.setDate(weekAgo.getDate() - 6);
  const groups: Record<ThreadGroupKey, T[]> = { pinned: [], today: [], week: [], older: [] };
  const sorted = [...threads].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  for (const thread of sorted) {
    const updated = new Date(thread.updatedAt);
    const key: ThreadGroupKey = thread.pinnedAt ? "pinned" : updated >= startOfToday ? "today" : updated >= weekAgo ? "week" : "older";
    groups[key].push(thread);
  }
  groups.pinned.sort((a, b) => (b.pinnedAt ?? "").localeCompare(a.pinnedAt ?? ""));
  return groups;
};

type ToolLikePart = { type: string; toolCallId?: string; state?: string; output?: unknown };
type MessageLike = { id: string; role: string; parts: readonly ToolLikePart[] };

export type ProposalEntry = {
  toolCallId: string;
  tool: string;
  messageId: string;
  output: Record<string, unknown>;
  decision: ThreadDecision | null;
};

/** Mọi đề xuất (tool output action "proposal") trong cuộc trò chuyện, kèm quyết định đã lưu nếu có. */
export const collectProposals = (messages: readonly MessageLike[], decisions: ThreadDecisions): ProposalEntry[] =>
  messages.flatMap((message) =>
    message.role !== "assistant" ? [] : message.parts.flatMap((part) => {
      const output = part.output as Record<string, unknown> | null | undefined;
      if (!part.toolCallId || part.state !== "output-available" || output?.action !== "proposal") return [];
      return [{
        toolCallId: part.toolCallId,
        tool: part.type.replace(/^tool-/, ""),
        messageId: message.id,
        output,
        decision: decisions[part.toolCallId] ?? null,
      }];
    }),
  );

/** Kết quả ghi dữ liệu đã áp dụng (đề xuất đã duyệt), mới nhất trước. */
export const appliedChanges = (proposals: readonly ProposalEntry[]) =>
  proposals
    .filter((entry) => entry.decision?.status === "applied")
    .sort((a, b) => (b.decision!.at).localeCompare(a.decision!.at));
