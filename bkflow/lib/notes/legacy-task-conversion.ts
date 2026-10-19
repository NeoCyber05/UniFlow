import "server-only";

import type { Prisma } from "@prisma/client";

import { toTaskDeadlineStorage } from "@/lib/cards/task-schedule-storage";
import { db } from "@/lib/db";
import { syncCardReminder } from "@/lib/notifications/reminder-deliveries";
import { reminderLabels } from "@/lib/notifications/reminder-notifications";
import { isStructuredNoteContent, NoteBlockSchema, parseNoteBlocks, serializeNoteBlocks, type NoteBlock } from "./blocks";
import { extractNoteDeadlines } from "./deadlines";
import { syncNoteDeadlines } from "./server";

type Client = Prisma.TransactionClient;
type DeadlineBlock = Extract<NoteBlock, { type: "deadline" }>;
type MirrorRow = { blockId: string; title: string; dueAt: Date; reminder: string; done: boolean };

export type LegacyIssue = {
  code: "trashed" | "unsupported-content" | "duplicate-block-id" | "invalid-date" | "invalid-reminder" | "mirror-mismatch";
  blockId?: string;
};
export type ConvertibleDeadline = { blockId: string; block: DeadlineBlock; title: string; dueAt: Date; reminder: string; done: boolean };
export type TargetCheck = { ok: true } | { ok: false; reason: "missing" | "not-found" | "shared" };

export class LegacyConversionError extends Error {
  constructor(message: string, readonly status: number, readonly issues: LegacyIssue[] = []) {
    super(message);
  }
}

const hasDuplicateBlockIds = (content: string) => {
  try {
    const parsed = JSON.parse(content) as { blocks?: { id?: unknown }[] };
    const ids = Array.isArray(parsed?.blocks) ? parsed.blocks.map(block => block?.id) : [];
    return new Set(ids).size !== ids.length;
  } catch {
    return false;
  }
};

/** Read-only dry run over one page. Any issue blocks conversion: nothing is silently picked or dropped. */
export const inventoryLegacyDeadlines = ({ content, deletedAt, mirror, mappedBlockIds }: {
  content: string; deletedAt: Date | null; mirror: MirrorRow[]; mappedBlockIds: Set<string>;
}) => {
  const issues: LegacyIssue[] = [];
  const convertible: ConvertibleDeadline[] = [];
  const undated: string[] = [];
  const alreadyConverted: string[] = [];
  if (deletedAt) issues.push({ code: "trashed" });
  if (!isStructuredNoteContent(content)) {
    issues.push({ code: hasDuplicateBlockIds(content) ? "duplicate-block-id" : "unsupported-content" });
    return { issues, convertible, undated, alreadyConverted };
  }
  for (const block of parseNoteBlocks(content)) {
    if (block.type !== "deadline") continue;
    if (mappedBlockIds.has(block.id)) { alreadyConverted.push(block.id); continue; }
    if (!block.dueAt.trim()) { undated.push(block.id); continue; }
    const dueAt = new Date(block.dueAt);
    const reminder = block.reminder || "none";
    if (Number.isNaN(dueAt.getTime())) { issues.push({ code: "invalid-date", blockId: block.id }); continue; }
    if (reminder !== "none" && !(reminder in reminderLabels)) { issues.push({ code: "invalid-reminder", blockId: block.id }); continue; }
    convertible.push({ blockId: block.id, block, title: block.text.trim() || "Hạn chưa đặt tên", dueAt, reminder, done: block.checked });
  }
  // Mirror must equal what the content would produce; a stale mirror means reminders differ from the page.
  const key = (row: MirrorRow) => JSON.stringify([row.title, row.dueAt.getTime(), row.reminder, row.done]);
  const expected = new Map(extractNoteDeadlines(content).filter(row => !mappedBlockIds.has(row.blockId)).map(row => [row.blockId, key(row)]));
  const actual = new Map(mirror.map(row => [row.blockId, key(row)]));
  for (const blockId of new Set([...expected.keys(), ...actual.keys()])) {
    if (expected.get(blockId) !== actual.get(blockId)) issues.push({ code: "mirror-mismatch", blockId });
  }
  return { issues, convertible, undated, alreadyConverted };
};

const ISSUE_MESSAGES: Record<LegacyIssue["code"], string> = {
  "trashed": "Trang đang ở thùng rác.",
  "unsupported-content": "Trang có định dạng chưa hỗ trợ.",
  "duplicate-block-id": "Trang có hai khối trùng mã.",
  "invalid-date": "Có hạn với ngày không hợp lệ.",
  "invalid-reminder": "Có hạn với mốc nhắc không hợp lệ.",
  "mirror-mismatch": "Dữ liệu nhắc hạn chưa khớp nội dung Trang. Chỉnh sửa và lưu Trang một lần rồi thử lại.",
};
export const describeLegacyIssues = (issues: LegacyIssue[]) => [...new Set(issues.map(issue => ISSUE_MESSAGES[issue.code]))].join(" ");

// Personal target = board owned by the user. A board owned by someone else is a shared target and rejected.
const checkTarget = async (client: Client, userId: string, boardId?: string | null, listId?: string | null): Promise<TargetCheck> => {
  if (!boardId || !listId) return { ok: false, reason: "missing" };
  const board = await client.board.findFirst({ where: { id: boardId }, select: { userId: true } });
  if (!board) return { ok: false, reason: "not-found" };
  if (board.userId !== userId) return { ok: false, reason: "shared" };
  const list = await client.list.findFirst({ where: { id: listId, boardId, archivedAt: null }, select: { id: true } });
  return list ? { ok: true } : { ok: false, reason: "not-found" };
};

const replaceConverted = (blocks: NoteBlock[], cardByBlock: Map<string, string>) =>
  blocks.map(block => block.type === "deadline" && cardByBlock.has(block.id) ? { id: block.id, type: "task" as const, taskId: cardByBlock.get(block.id)! } : block);

/**
 * Every NotePage.content write (save, AI edit, AI undo, duplicate) passes through this inside its transaction:
 * a legacy block that already has an active map becomes its task ref, so stale content cannot re-mirror it.
 */
export const canonicalizeConvertedContent = async (client: Client, { pageId, content }: { pageId: string; content: string }) => {
  if (!content.includes("\"deadline\"") || !isStructuredNoteContent(content)) return content;
  const maps = await client.noteDeadlineTaskMap.findMany({ where: { pageId, restoredAt: null }, select: { blockId: true, cardId: true } });
  if (!maps.length) return content;
  const cardByBlock = new Map(maps.map(map => [map.blockId, map.cardId]));
  const blocks = parseNoteBlocks(content);
  if (!blocks.some(block => block.type === "deadline" && cardByBlock.has(block.id))) return content;
  return serializeNoteBlocks(replaceConverted(blocks, cardByBlock));
};

const nextRevision = (now: Date, previous: Date) => new Date(Math.max(now.getTime(), previous.getTime() + 1));

export const previewLegacyConversion = async ({ userId, pageId, targetBoardId, targetListId }: {
  userId: string; pageId: string; targetBoardId?: string | null; targetListId?: string | null;
}) => {
  const page = await db.notePage.findFirst({ where: { id: pageId, userId } });
  if (!page) return null;
  const [mirror, maps, target] = await Promise.all([
    db.noteDeadline.findMany({ where: { pageId } }),
    db.noteDeadlineTaskMap.findMany({ where: { pageId, restoredAt: null } }),
    checkTarget(db, userId, targetBoardId, targetListId),
  ]);
  const inventory = inventoryLegacyDeadlines({ content: page.content, deletedAt: page.deletedAt, mirror, mappedBlockIds: new Set(maps.map(map => map.blockId)) });
  return {
    revision: page.updatedAt.toISOString(),
    validCount: inventory.convertible.length,
    undatedCount: inventory.undated.length,
    alreadyConvertedCount: inventory.alreadyConverted.length,
    issues: inventory.issues,
    issueMessage: describeLegacyIssues(inventory.issues),
    target,
    mapping: inventory.convertible.map(item => ({ blockId: item.blockId, title: item.title, dueAt: item.dueAt.toISOString(), reminder: item.reminder, done: item.done })),
    canConvert: !inventory.issues.length && target.ok && inventory.convertible.length > 0,
    // Restore is offered only while the page still has the revision written by the conversion.
    restorable: maps.length > 0 && maps.every(map => map.afterPageRevision.getTime() === page.updatedAt.getTime()),
    convertedCount: maps.length,
  };
};

type ConvertInput = { userId: string; pageId: string; targetBoardId: string; targetListId: string; expectedUpdatedAt: string; requestId: string };
export type ConvertResult = { revision: string; converted: { blockId: string; cardId: string }[]; undatedCount: number | null; replayed: boolean };

const findReplay = async ({ userId, pageId, requestId }: Pick<ConvertInput, "userId" | "pageId" | "requestId">): Promise<ConvertResult | null> => {
  const rows = await db.noteDeadlineTaskMap.findMany({ where: { userId, pageId, requestId } });
  if (!rows.length) return null;
  return { revision: rows[0].afterPageRevision.toISOString(), converted: rows.map(row => ({ blockId: row.blockId, cardId: row.cardId })), undatedCount: null, replayed: true };
};

/** Converts every valid legacy deadline block of one page atomically. Undated blocks stay legacy. */
export const convertLegacyDeadlines = async (input: ConvertInput): Promise<ConvertResult> => {
  const { userId, pageId, targetBoardId, targetListId, expectedUpdatedAt, requestId } = input;
  const replay = await findReplay(input);
  if (replay) return replay;
  try {
    return await db.$transaction(async tx => {
      const now = new Date();
      const page = await tx.notePage.findFirst({ where: { id: pageId, userId } });
      if (!page) throw new LegacyConversionError("Không tìm thấy trang.", 404);
      if (page.updatedAt.getTime() !== new Date(expectedUpdatedAt).getTime()) throw new LegacyConversionError("Trang đã thay đổi. Tải lại rồi xem trước lần nữa.", 409);
      const target = await checkTarget(tx, userId, targetBoardId, targetListId);
      if (!target.ok) throw new LegacyConversionError(target.reason === "shared" ? "Chỉ chuyển được vào bảng cá nhân của bạn." : "Không tìm thấy bảng hoặc danh sách đích.", target.reason === "shared" ? 403 : 404);
      const [mirror, maps] = await Promise.all([
        tx.noteDeadline.findMany({ where: { pageId } }),
        tx.noteDeadlineTaskMap.findMany({ where: { pageId } }),
      ]);
      const active = maps.filter(map => !map.restoredAt);
      const inventory = inventoryLegacyDeadlines({ content: page.content, deletedAt: page.deletedAt, mirror, mappedBlockIds: new Set(active.map(map => map.blockId)) });
      if (inventory.issues.length) throw new LegacyConversionError(describeLegacyIssues(inventory.issues), 422, inventory.issues);
      if (!inventory.convertible.length) throw new LegacyConversionError("Trang không còn hạn có ngày nào để chuyển.", 422);

      const cardByBlock = new Map([...active.map(map => [map.blockId, map.cardId] as const), ...inventory.convertible.map(item => [item.blockId, crypto.randomUUID()] as const)]);
      const content = serializeNoteBlocks(replaceConverted(parseNoteBlocks(page.content), cardByBlock));
      const revision = nextRevision(now, page.updatedAt);
      // Page CAS first: a concurrent save/conversion waits on this row lock, then fails its own CAS.
      const updated = await tx.notePage.updateMany({ where: { id: pageId, userId, updatedAt: page.updatedAt }, data: { content, updatedAt: revision } });
      if (!updated.count) throw new LegacyConversionError("Trang vừa được chỉnh sửa ở nơi khác.", 409);

      const last = await tx.card.findFirst({ where: { listId: targetListId, archivedAt: null }, orderBy: { order: "desc" }, select: { order: true } });
      let order = last?.order ?? 0;
      const converted: { blockId: string; cardId: string }[] = [];
      for (const item of inventory.convertible) {
        const reminder = item.reminder === "none" ? null : item.reminder;
        // shortcut: creates the Card directly with the shared storage/reminder helpers; createCapturedCards owns its
        // transaction and rejects past reminders/completed state, so it cannot carry a legacy block over unchanged.
        const card = await tx.card.create({
          data: {
            id: cardByBlock.get(item.blockId)!, title: item.title, listId: targetListId, order: ++order,
            ...toTaskDeadlineStorage({ dueDate: item.dueAt.toISOString(), deadlineOn: null }),
            isCompleted: item.done,
            // reminderSetAt = now: a reminder whose time already passed is never sent again by the Card fallback.
            ...(reminder ? { reminder, reminderSetAt: now } : {}),
          },
          select: { id: true, updatedAt: true },
        });
        if (reminder) await syncCardReminder(tx, { cardId: card.id, now });
        const snapshot = {
          userId, cardId: card.id, requestId, beforeBlock: item.block as Prisma.InputJsonValue,
          beforePageRevision: page.updatedAt, afterPageRevision: revision, cardRevision: card.updatedAt, convertedAt: now, restoredAt: null,
        };
        // A block converted before and then restored reuses its row (unique pageId+blockId).
        if (maps.some(map => map.blockId === item.blockId)) {
          const reused = await tx.noteDeadlineTaskMap.updateMany({ where: { pageId, blockId: item.blockId, restoredAt: { not: null } }, data: snapshot });
          if (reused.count !== 1) throw new LegacyConversionError("Trang vừa được chuyển ở nơi khác.", 409);
        } else {
          await tx.noteDeadlineTaskMap.create({ data: { pageId, blockId: item.blockId, ...snapshot } });
        }
        converted.push({ blockId: item.blockId, cardId: card.id });
      }
      await syncNoteDeadlines(tx, { userId, pageId, content });
      return { revision: revision.toISOString(), converted, undatedCount: inventory.undated.length, replayed: false };
    });
  } catch (error) {
    // Same requestId committed by a concurrent request: report its result instead of a conflict.
    const winner = await findReplay(input);
    if (winner) return winner;
    throw error;
  }
};

/**
 * Trial-period rollback. Only when neither the page nor any created task changed since the conversion; the
 * tasks are archived with their reminder cleared (never deleted) before the legacy blocks come back.
 */
export const restoreLegacyDeadlines = async ({ userId, pageId, expectedUpdatedAt }: { userId: string; pageId: string; expectedUpdatedAt: string }) =>
  db.$transaction(async tx => {
    const now = new Date();
    const page = await tx.notePage.findFirst({ where: { id: pageId, userId } });
    if (!page) throw new LegacyConversionError("Không tìm thấy trang.", 404);
    if (page.updatedAt.getTime() !== new Date(expectedUpdatedAt).getTime()) throw new LegacyConversionError("Trang đã thay đổi. Tải lại rồi thử lại.", 409);
    const maps = await tx.noteDeadlineTaskMap.findMany({ where: { pageId, userId, restoredAt: null } });
    if (!maps.length) throw new LegacyConversionError("Trang chưa có lần chuyển nào để khôi phục.", 404);
    if (maps.some(map => map.afterPageRevision.getTime() !== page.updatedAt.getTime())) {
      throw new LegacyConversionError("Trang đã được sửa sau khi chuyển nên không khôi phục tự động được.", 409);
    }
    const cards = await tx.card.findMany({
      where: { id: { in: maps.map(map => map.cardId) } },
      select: { id: true, updatedAt: true, archivedAt: true, list: { select: { board: { select: { userId: true } } } } },
    });
    const cardById = new Map(cards.map(card => [card.id, card]));
    const conflict = () => new LegacyConversionError("Có công việc đã được sửa, xoá hoặc không còn quyền. Không khôi phục để tránh mất dữ liệu.", 409);
    for (const map of maps) {
      const card = cardById.get(map.cardId);
      if (!card || card.archivedAt || card.list.board.userId !== userId || card.updatedAt.getTime() !== map.cardRevision.getTime()) throw conflict();
    }
    // Cancel task reminders first, so only one reminder source is ever active.
    for (const map of maps) {
      const archived = await tx.card.updateMany({ where: { id: map.cardId, updatedAt: map.cardRevision, archivedAt: null }, data: { archivedAt: now, reminder: null } });
      if (archived.count !== 1) throw conflict();
      await syncCardReminder(tx, { cardId: map.cardId, now });
    }
    const beforeByBlock = new Map(maps.map(map => [map.blockId, { cardId: map.cardId, block: NoteBlockSchema.parse(map.beforeBlock) }]));
    const blocks = parseNoteBlocks(page.content).map(block => {
      const before = beforeByBlock.get(block.id);
      return block.type === "task" && before && block.taskId === before.cardId ? before.block : block;
    });
    const content = serializeNoteBlocks(blocks);
    const revision = nextRevision(now, page.updatedAt);
    const updated = await tx.notePage.updateMany({ where: { id: pageId, userId, updatedAt: page.updatedAt }, data: { content, updatedAt: revision } });
    if (!updated.count) throw new LegacyConversionError("Trang vừa được chỉnh sửa ở nơi khác.", 409);
    const marked = await tx.noteDeadlineTaskMap.updateMany({ where: { id: { in: maps.map(map => map.id) }, restoredAt: null }, data: { restoredAt: now } });
    if (marked.count !== maps.length) throw new LegacyConversionError("Trang vừa được khôi phục ở nơi khác.", 409);
    await syncNoteDeadlines(tx, { userId, pageId, content });
    return { revision: revision.toISOString(), restored: maps.length };
  });
