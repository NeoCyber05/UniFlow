import "server-only";

import type { Prisma } from "@prisma/client";
import type { UIMessage } from "ai";

import { db } from "@/lib/db";

import { ASSISTANT_LIMITS } from "./config";
import { deriveThreadTitle, parseThreadDecisions, type ThreadDecision, type ThreadSummary } from "./threads-shared";

/** Số tin hiển thị khi mở một cuộc trò chuyện (model chỉ đọc `historyMessages` tin gần nhất). */
export const THREAD_DISPLAY_MESSAGES = 120;
export const THREAD_LIST_LIMIT = 100;

const summarySelect = { id: true, title: true, boardId: true, pinnedAt: true, updatedAt: true, createdAt: true } as const;

const toSummary = (row: { id: string; title: string; boardId: string; pinnedAt: Date | null; updatedAt: Date; createdAt: Date }): ThreadSummary => ({
  id: row.id,
  title: row.title,
  boardId: row.boardId,
  pinnedAt: row.pinnedAt?.toISOString() ?? null,
  updatedAt: row.updatedAt.toISOString(),
  createdAt: row.createdAt.toISOString(),
});

const extractText = (message: UIMessage) =>
  message.parts.flatMap((part) => (part.type === "text" ? [part.text] : [])).join("\n").trim();

export const listThreads = async (userId: string) =>
  (await db.assistantThread.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    take: THREAD_LIST_LIMIT,
    select: summarySelect,
  })).map(toSummary);

/** Bảng cá nhân của người dùng: phạm vi chọn được cho một cuộc trò chuyện. */
export const listAssistantBoards = (userId: string) =>
  db.board.findMany({
    where: { userId },
    orderBy: [{ createdAt: "asc" }],
    select: { id: true, title: true, workspaceId: true },
  });

export const createThread = async (userId: string, boardId: string) =>
  toSummary(await db.assistantThread.create({ data: { userId, boardId }, select: summarySelect }));

/** Chỉ trả về thread của chính người dùng; thread người khác coi như không tồn tại. */
export const getThread = async (userId: string, threadId: string) => {
  const row = await db.assistantThread.findFirst({
    where: { id: threadId, userId },
    select: { ...summarySelect, decisions: true },
  });
  return row ? { ...toSummary(row), decisions: parseThreadDecisions(row.decisions) } : null;
};

export const updateThread = async (
  userId: string,
  threadId: string,
  patch: { title?: string; pinned?: boolean; boardId?: string },
) => {
  const current = await db.assistantThread.findFirst({ where: { id: threadId, userId }, select: { updatedAt: true } });
  if (!current) return false;
  await db.assistantThread.update({
    where: { id: threadId },
    data: {
      ...(patch.title !== undefined && { title: patch.title.trim().slice(0, 120) }),
      ...(patch.pinned !== undefined && { pinnedAt: patch.pinned ? new Date() : null }),
      ...(patch.boardId !== undefined && { boardId: patch.boardId }),
      // Đổi tên / ghim không làm cuộc trò chuyện nhảy lên nhóm "Hôm nay".
      updatedAt: current.updatedAt,
    },
  });
  return true;
};

export const deleteThread = async (userId: string, threadId: string) =>
  (await db.assistantThread.deleteMany({ where: { id: threadId, userId } })).count > 0;

/** Ghi quyết định Đồng ý / Bỏ của một đề xuất; ghi lại cùng toolCallId thì giữ quyết định đầu tiên. */
export const recordThreadDecision = async (userId: string, threadId: string, toolCallId: string, decision: ThreadDecision) =>
  db.$transaction(async (tx) => {
    const row = await tx.assistantThread.findFirst({ where: { id: threadId, userId }, select: { decisions: true } });
    if (!row) return null;
    const decisions = parseThreadDecisions(row.decisions);
    if (!decisions[toolCallId]) decisions[toolCallId] = decision;
    // Không đổi updatedAt: duyệt đề xuất không đẩy cuộc trò chuyện lên đầu danh sách.
    await tx.$executeRaw`UPDATE "AssistantThread" SET "decisions" = ${JSON.stringify(decisions)}::jsonb WHERE "id" = ${threadId}`;
    return decisions;
  });

export const loadThreadMessages = async (threadId: string, take: number = ASSISTANT_LIMITS.historyMessages): Promise<UIMessage[]> => {
  const rows = await db.assistantMessage.findMany({
    where: { threadId },
    orderBy: { createdAt: "desc" },
    take,
  });
  return rows.reverse().map((row) => ({
    id: row.id,
    role: row.role === "assistant" ? "assistant" : "user",
    parts: Array.isArray(row.parts) ? (row.parts as unknown as UIMessage["parts"]) : [{ type: "text", text: row.content }],
  }));
};

/** Lưu tin mới; đặt tiêu đề từ câu hỏi đầu nếu thread chưa có tên và đẩy thread lên đầu danh sách. */
export const saveThreadMessages = async (threadId: string, messages: UIMessage[]) => {
  const baseTime = Date.now();
  const kept = messages.filter((message) => message.role === "user" || message.role === "assistant");
  const firstQuestion = kept.find((message) => message.role === "user");
  const title = firstQuestion ? deriveThreadTitle(extractText(firstQuestion)) : "";
  await db.$transaction([
    ...kept.map((message, index) => {
      const data = { role: message.role, content: extractText(message), parts: message.parts as unknown as Prisma.InputJsonValue };
      return db.assistantMessage.upsert({
        where: { id: message.id },
        create: { id: message.id, threadId, createdAt: new Date(baseTime + index), ...data },
        update: data,
      });
    }),
    db.assistantThread.update({ where: { id: threadId }, data: { updatedAt: new Date() } }),
    ...(title ? [db.assistantThread.updateMany({ where: { id: threadId, title: "" }, data: { title } })] : []),
  ]);
};
