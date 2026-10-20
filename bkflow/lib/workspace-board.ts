import "server-only";

import { BoardType, Prisma } from "@prisma/client";

import { defaultImages } from "@/constants/images";
import { db } from "@/lib/db";

export const WORKSPACE_BOARD_DEFAULT_LISTS = ["Cần làm", "Đang làm", "Xong"] as const;

const DEFAULT_LABEL_COLORS = ["#4ade80", "#facc15", "#fb923c", "#f87171", "#c084fc", "#60a5fa"];

/**
 * Mỗi workspace có đúng 1 bảng. Tạo lười ở lần mở đầu tiên.
 * Trả về null khi workspace không thuộc user.
 */
export const getOrCreateWorkspaceBoard = async ({ userId, workspaceId }: { userId: string; workspaceId: string }) => {
  const workspace = await db.workspace.findFirst({
    where: { id: workspaceId, userId },
    select: { id: true, title: true },
  });

  if (!workspace) {
    return null;
  }

  const existing = await db.board.findUnique({
    where: { workspaceId },
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
        title: workspace.title,
        workspaceId,
        boardType: BoardType.WORKSPACE,
        imageId: image.id,
        imageThumbUrl: image.urls.thumb,
        imageFullUrl: image.urls.full,
        imageUserName: image.user.name,
        imageLinkHTML: image.links.html,
        lists: {
          createMany: {
            data: WORKSPACE_BOARD_DEFAULT_LISTS.map((title, index) => ({
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
    // Hai request mở cùng workspace cùng lúc: request thua đọc lại bảng đã tạo
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const board = await db.board.findUnique({
        where: { workspaceId },
        select: { id: true },
      });

      if (board) {
        return board;
      }
    }

    throw error;
  }
};
