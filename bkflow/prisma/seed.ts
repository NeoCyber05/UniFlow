/**
 * Seed demo cho bảng học kỳ hiện tại.
 * Yêu cầu: đã mở app ít nhất 1 lần ở workspace cá nhân (để học kỳ + bảng kỳ được tạo).
 * Chạy: SEED_ORG_ID=org_xxx npm run db:seed
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const COURSES = [
  { name: "Giải tích 1", code: "MI1111", credits: 4, color: "violet" },
  { name: "Lập trình hướng đối tượng", code: "IT3100", credits: 2, color: "sky" },
  { name: "Cấu trúc dữ liệu và giải thuật", code: "IT3011", credits: 2, color: "emerald" },
  { name: "Vật lý đại cương 1", code: "PH1110", credits: 3, color: "amber" },
  { name: "Tiếng Anh 1", code: "FL1100", credits: 3, color: "rose" },
];

const TASKS: { title: string; course: string | null; inDays: number | null; list: number; done?: boolean }[] = [
  { title: "Bài tập chương 1 - Giới hạn", course: "MI1111", inDays: 2, list: 0 },
  { title: "Ôn thi giữa kỳ Giải tích", course: "MI1111", inDays: 14, list: 0 },
  { title: "Bài tập tuần 3", course: "MI1111", inDays: -3, list: 2, done: true },
  { title: "Bài tập lớn OOP - thiết kế lớp", course: "IT3100", inDays: 10, list: 1 },
  { title: "Lab 2 - Kế thừa", course: "IT3100", inDays: 1, list: 0 },
  { title: "Cài đặt cây AVL", course: "IT3011", inDays: 5, list: 1 },
  { title: "Bài tập đệ quy", course: "IT3011", inDays: -1, list: 0 },
  { title: "Báo cáo thí nghiệm con lắc", course: "PH1110", inDays: 4, list: 0 },
  { title: "Học 50 từ vựng Unit 3", course: "FL1100", inDays: 3, list: 1 },
  { title: "Speaking test", course: "FL1100", inDays: 9, list: 0 },
  { title: "Đi gym", course: null, inDays: 0, list: 0 },
  { title: "Mua đồ dùng học tập", course: null, inDays: null, list: 0 },
];

const main = async () => {
  const userId = process.env.SEED_USER_ID ?? process.env.SEED_ORG_ID;

  if (!userId) {
    throw new Error("Thiếu SEED_USER_ID (id Supabase user).");
  }

  const semester = await db.semester.findFirst({
    where: { userId, isCurrent: true },
    include: {
      board: {
        include: { lists: { where: { archivedAt: null }, orderBy: { order: "asc" } } },
      },
    },
  });

  if (!semester?.board) {
    throw new Error("Chưa có bảng kỳ hiện tại. Mở app ở workspace cá nhân một lần rồi chạy lại.");
  }

  const board = semester.board;

  if (board.lists.length < 3) {
    throw new Error("Bảng kỳ cần ít nhất 3 cột.");
  }

  const courseIdByCode = new Map<string, string>();

  for (const [index, course] of COURSES.entries()) {
    const saved = await db.course.upsert({
      where: { boardId_name: { boardId: board.id, name: course.name } },
      update: {},
      create: { ...course, boardId: board.id, order: index + 1 },
    });
    courseIdByCode.set(course.code, saved.id);
  }

  const now = Date.now();

  for (const [index, task] of TASKS.entries()) {
    await db.card.create({
      data: {
        title: task.title,
        listId: board.lists[task.list].id,
        order: 100 + index,
        courseId: task.course ? courseIdByCode.get(task.course) ?? null : null,
        dueDate: task.inDays === null ? null : new Date(now + task.inDays * 24 * 60 * 60 * 1000),
        isCompleted: task.done ?? false,
      },
    });
  }

  console.log(`Seeded ${COURSES.length} courses, ${TASKS.length} cards into "${board.title}".`);
};

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
