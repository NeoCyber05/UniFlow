"use server";

import { auth } from "@/server/clerk";
import { revalidatePath } from "@/server/cache";

import { db } from "@/lib/db";
import { createSafeAction } from "@/lib/create-safe-action";

import { InputType, ReturnType } from "./types";
import { UpdateSemester } from "./schema";

const handler = async (data: InputType): Promise<ReturnType> => {
  const { userId, orgId } = await auth();

  if (!userId || !orgId) {
    return {
      error: "Không có quyền truy cập.",
    };
  }

  const { id, title, startDate, endDate } = data;
  let semester;

  try {
    const existing = await db.semester.findUnique({ where: { id } });

    if (!existing || existing.orgId !== orgId) {
      return { error: "Không tìm thấy học kỳ." };
    }

    semester = await db.semester.update({
      where: { id },
      data: { title, startDate, endDate },
    });
  } catch {
    return {
      error: "Cập nhật học kỳ thất bại.",
    };
  }

  revalidatePath(`/organization/${orgId}`);
  return { data: semester };
};

export const updateSemester = createSafeAction(UpdateSemester, handler);
