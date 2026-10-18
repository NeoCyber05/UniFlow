"use server";

import { auth } from "@/server/auth";
import { revalidatePath } from "@/server/cache";

import { db } from "@/lib/db";
import { createSafeAction } from "@/lib/create-safe-action";

import { InputType, ReturnType } from "./types";
import { DeleteSemester } from "./schema";

const handler = async (data: InputType): Promise<ReturnType> => {
  const { userId, orgId } = await auth();

  if (!userId || !orgId) {
    return {
      error: "Không có quyền truy cập.",
    };
  }

  const { id } = data;
  let semester;

  try {
    const existing = await db.semester.findUnique({ where: { id } });

    if (!existing || existing.orgId !== orgId) {
      return { error: "Không tìm thấy học kỳ." };
    }

    // Bảng kỳ gắn 1-1 với học kỳ; xóa kỳ thì bảng (cùng list/card) cũng đi theo
    [, semester] = await db.$transaction([
      db.board.deleteMany({ where: { semesterId: id, orgId } }),
      db.semester.delete({ where: { id } }),
    ]);
  } catch {
    return {
      error: "Xóa học kỳ thất bại.",
    };
  }

  revalidatePath(`/organization/${orgId}`);
  return { data: semester };
};

export const deleteSemester = createSafeAction(DeleteSemester, handler);
