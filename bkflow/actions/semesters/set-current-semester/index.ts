"use server";

import { auth } from "@/server/auth";
import { revalidatePath } from "@/server/cache";

import { db } from "@/lib/db";
import { createSafeAction } from "@/lib/create-safe-action";

import { InputType, ReturnType } from "./types";
import { SetCurrentSemester } from "./schema";

const handler = async (data: InputType): Promise<ReturnType> => {
  const { userId } = await auth();

  if (!userId) {
    return {
      error: "Không có quyền truy cập.",
    };
  }

  const { id } = data;
  let semester;

  try {
    const existing = await db.semester.findUnique({ where: { id } });

    if (!existing || existing.userId !== userId) {
      return { error: "Không tìm thấy học kỳ." };
    }

    [, semester] = await db.$transaction([
      db.semester.updateMany({
        where: { userId, isCurrent: true },
        data: { isCurrent: false },
      }),
      db.semester.update({
        where: { id },
        data: { isCurrent: true },
      }),
    ]);
  } catch {
    return {
      error: "Chuyển học kỳ thất bại.",
    };
  }

  revalidatePath("/dashboard");
  return { data: semester };
};

export const setCurrentSemester = createSafeAction(SetCurrentSemester, handler);
