import "server-only";

import { BoardType, Prisma } from "@prisma/client";

import { defaultImages } from "@/constants/images";
import { db } from "@/lib/db";

export const SEMESTER_BOARD_DEFAULT_LISTS = ["Cần làm", "Đang làm", "Xong"] as const;

const DEFAULT_LABEL_COLORS = ["#4ade80", "#facc15", "#fb923c", "#f87171", "#c084fc", "#60a5fa"];

export type SemesterBoardUser = {
  userId: string;
  userName?: string;
  userImage?: string;
  userEmail?: string | null;
};

type GetOrCreateSemesterBoardInput = {
  userId?: string;
  orgId?: string;
  semesterId: string;
  user?: SemesterBoardUser;
};

/**
 * Mỗi học kỳ có đúng 1 bảng. Tạo lười ở lần mở đầu tiên.
 * Trả về null khi học kỳ không thuộc user hiện tại.
 */
export const getOrCreateSemesterBoard = async (input: GetOrCreateSemesterBoardInput) => {
  const userId = input.userId ?? input.orgId;
  const { semesterId } = input;

  if (!userId) {
    return null;
  }

  const semester = await db.semester.findFirst({
    where: { id: semesterId, userId },
    select: { id: true, title: true },
  });

  if (!semester) {
    return null;
  }

  const existing = await db.board.findUnique({
    where: { semesterId },
    select: { id: true },
  });

  if (existing) {
    return existing;
  }

  const image = defaultImages[0];

  try {
    return await db.board.create({
      data: {
        userId,
        title: `Học kỳ ${semester.title}`,
        semesterId,
        boardType: BoardType.SEMESTER,
        imageId: image.id,
        imageThumbUrl: image.urls.thumb,
        imageFullUrl: image.urls.full,
        imageUserName: image.user.name,
        imageLinkHTML: image.links.html,
        lists: {
          createMany: {
            data: SEMESTER_BOARD_DEFAULT_LISTS.map((title, index) => ({
              title,
              order: index + 1,
            })),
          },
        },
        labels: {
          createMany: {
            data: DEFAULT_LABEL_COLORS.map((color) => ({ color, title: "" })),
          },
        },
      },
      select: { id: true },
    });
  } catch (error) {
    // Hai request mở cùng kỳ cùng lúc: request thua đọc lại bảng đã tạo
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const board = await db.board.findUnique({
        where: { semesterId },
        select: { id: true },
      });

      if (board) {
        return board;
      }
    }

    throw error;
  }
};
