/* eslint-disable @typescript-eslint/no-explicit-any -- proxied prisma client */
// Tích hợp với PostgreSQL thật (rollback, khóa khóa chính). Chỉ chạy khi CAPTURE_DB_TEST=1 trên DB thử
// đã `prisma db push`; mặc định bỏ qua để `npm test` không đụng DB thật.
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { PrismaClient } from "@prisma/client";

import { CAPTURE_ALREADY_PROCESSED, createCapturedCardsWithStatus } from "./create-captured-cards";

const enabled = process.env.CAPTURE_DB_TEST === "1";

describe("createCapturedCards on a real database", { skip: !enabled && "set CAPTURE_DB_TEST=1 with a test DATABASE_URL" }, () => {
  const prisma = new PrismaClient();
  const userId = `capture-test-${randomUUID()}`;
  let boardId = "";
  let listId = "";
  let courseId = "";
  let foreignCourseId = "";

  /** Client thật, nhưng ghi delivery trong transaction ném lỗi sau khi card/todo đã ghi. */
  const failingReminders = new Proxy(prisma, {
    get(target, prop) {
      if (prop !== "$transaction") return (target as any)[prop];
      return (fn: any, options: any) => target.$transaction((tx) => fn(new Proxy(tx, {
        get(txTarget, txProp) {
          if (txProp !== "reminderDelivery") return (txTarget as any)[txProp];
          return { ...txTarget.reminderDelivery, createMany: async () => { throw new Error("delivery write failed"); } };
        },
      })), options);
    },
  }) as unknown as PrismaClient;

  const draft = (creationId: string, extra: object = {}) => ({
    creationId,
    listId,
    title: "Nộp bài A",
    description: "",
    courseId,
    deadlineOn: "2030-01-10",
    scheduledStartAt: "2030-01-09T12:00:00.000Z",
    scheduledEndAt: "2030-01-09T13:00:00.000Z",
    reminder: "60",
    isImportant: true,
    myDay: true,
    checklistItems: ["Đọc đề", "Làm bài", "Nộp"],
    ...extra,
  });

  before(async () => {
    const image = { imageId: "x", imageThumbUrl: "x", imageFullUrl: "x", imageUserName: "x", imageLinkHTML: "x" };
    const board = await prisma.board.create({ data: { userId, title: "Kỳ thử", boardType: "SEMESTER", ...image } });
    const other = await prisma.board.create({ data: { userId: `${userId}-other`, title: "Khác", ...image } });
    boardId = board.id;
    listId = (await prisma.list.create({ data: { boardId, title: "Cần làm", order: 1 } })).id;
    courseId = (await prisma.course.create({ data: { boardId, name: "CTDL", code: "IT3011", color: "blue" } })).id;
    foreignCourseId = (await prisma.course.create({ data: { boardId: other.id, name: "X", color: "red" } })).id;
    await prisma.webPushSubscription.create({ data: { userId, endpoint: `https://push.test/${userId}`, p256dh: "k", auth: "a" } });
  });

  after(async () => {
    await prisma.board.deleteMany({ where: { userId: { in: [userId, `${userId}-other`] } } });
    await prisma.webPushSubscription.deleteMany({ where: { userId } });
    await prisma.$disconnect();
  });

  const countFor = async (cardId: string) => ({
    cards: await prisma.card.count({ where: { id: cardId } }),
    items: await prisma.checklistItem.count({ where: { checklist: { cardId } } }),
    states: await prisma.cardUserState.count({ where: { cardId } }),
    deliveries: await prisma.reminderDelivery.count({ where: { cardId } }),
  });

  test("reminder failure rolls back card, todos and user state", async () => {
    const id = randomUUID();
    await assert.rejects(() => createCapturedCardsWithStatus({ userId, boardId, drafts: [draft(id)] }, failingReminders), /delivery write failed/);
    assert.deepEqual(await countFor(id), { cards: 0, items: 0, states: 0, deliveries: 0 });
  });

  test("create stores every field, replay after commit is idempotent", async () => {
    const id = randomUUID();
    const first = await createCapturedCardsWithStatus({ userId, boardId, drafts: [draft(id)] });
    assert.deepEqual([...first.createdIds], [id]);
    const card = await prisma.card.findUniqueOrThrow({ where: { id } });
    assert.equal(card.deadlineOn?.toISOString(), "2030-01-10T00:00:00.000Z");
    assert.equal(card.dueDate, null);
    assert.equal(card.startDate, null);
    assert.equal(card.scheduledStartAt?.toISOString(), "2030-01-09T12:00:00.000Z");
    assert.equal(card.reminder, "60");
    assert.equal(card.courseId, courseId);
    assert.deepEqual(await countFor(id), { cards: 1, items: 3, states: 1, deliveries: 1 });

    // Response mất sau commit → client retry cùng id/payload.
    const retry = await createCapturedCardsWithStatus({ userId, boardId, drafts: [draft(id)] });
    assert.equal(retry.createdIds.size, 0);
    assert.equal(retry.cards[0].id, id);
    assert.deepEqual(await countFor(id), { cards: 1, items: 3, states: 1, deliveries: 1 });
  });

  test("same id with changed payload is a conflict and keeps the stored card", async () => {
    const id = randomUUID();
    await createCapturedCardsWithStatus({ userId, boardId, drafts: [draft(id)] });
    await assert.rejects(
      () => createCapturedCardsWithStatus({ userId, boardId, drafts: [draft(id, { scheduledEndAt: "2030-01-09T14:00:00.000Z" })] }),
      (error: any) => error.code === CAPTURE_ALREADY_PROCESSED,
    );
    const card = await prisma.card.findUniqueOrThrow({ where: { id } });
    assert.equal(card.scheduledEndAt?.toISOString(), "2030-01-09T13:00:00.000Z");
  });

  test("two concurrent identical requests create exactly one card", async () => {
    const id = randomUUID();
    const results = await Promise.all([1, 2].map(() => createCapturedCardsWithStatus({ userId, boardId, drafts: [draft(id)] })));
    assert.equal(results.reduce((n, r) => n + r.createdIds.size, 0), 1);
    assert.deepEqual(await countFor(id), { cards: 1, items: 3, states: 1, deliveries: 1 });
  });

  test("wrong user, board or course is rejected without writes", async () => {
    const id = randomUUID();
    await assert.rejects(() => createCapturedCardsWithStatus({ userId: `${userId}-other`, boardId, drafts: [draft(id)] }));
    await assert.rejects(() => createCapturedCardsWithStatus({ userId, boardId, drafts: [draft(id, { courseId: foreignCourseId })] }), /Danh mục không hợp lệ/);
    assert.deepEqual(await countFor(id), { cards: 0, items: 0, states: 0, deliveries: 0 });
  });
});
