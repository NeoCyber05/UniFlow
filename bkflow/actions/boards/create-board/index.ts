"use server";

import { auth, currentUser } from "@/server/auth";
import { revalidatePath } from "@/server/cache";

import { db } from "@/lib/db";
import { createSafeAction } from "@/lib/create-safe-action";

import { InputType, ReturnType } from "./types";
import { CreateBoard } from "./schema";
import { BoardType } from "@prisma/client";

const handler = async (data: InputType): Promise<ReturnType> => {
  const { userId } = await auth();
  const user = await currentUser();

  if (!userId || !user) {
    return {
      error: "Không có quyền truy cập.",
    };
  }

  const { title, image } = data;

  const [
    imageId,
    imageThumbUrl,
    imageFullUrl,
    imageLinkHTML,
    imageUserName,
  ] = image.split("|");

  if (!imageId || !imageThumbUrl || !imageFullUrl || !imageUserName || !imageLinkHTML) {
    return {
      error: "Thiếu thông tin trường dữ liệu. Tạo bảng thất bại.",
    };
  }

  let board;

  try {
    board = await db.board.create({
      data: {
        title,
        userId,
        imageId,
        imageThumbUrl,
        imageFullUrl,
        imageUserName,
        imageLinkHTML,
        boardType: BoardType.TEAM_PROJECT,
        labels: {
          createMany: {
            data: [
              { color: "#4ade80", title: "" },
              { color: "#facc15", title: "" },
              { color: "#fb923c", title: "" },
              { color: "#f87171", title: "" },
              { color: "#c084fc", title: "" },
              { color: "#60a5fa", title: "" },
            ],
          },
        },
      },
    });

  } catch {
    return {
      error: "Tạo bảng thất bại.",
    };
  }

  revalidatePath(`/board/${board.id}`);
  return { data: board };
};

export const createBoard = createSafeAction(CreateBoard, handler);
