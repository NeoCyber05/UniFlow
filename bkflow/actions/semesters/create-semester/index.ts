"use server";

import { auth } from "@/server/clerk";
import { revalidatePath } from "@/server/cache";

import { db } from "@/lib/db";
import { createSafeAction } from "@/lib/create-safe-action";

import { InputType, ReturnType } from "./types";
import { CreateSemester } from "./schema";

const handler = async (data: InputType): Promise<ReturnType> => {
  const { userId, orgId } = await auth();

  if (!userId || !orgId) {
    return {
      error: "Không có quyền truy cập.",
    };
  }

  const { title, startDate, endDate } = data;
  let semester;

  try {
    const existingCount = await db.semester.count({ where: { orgId } });

    semester = await db.semester.create({
      data: {
        orgId,
        title,
        startDate,
        endDate,
        isCurrent: existingCount === 0,
      },
    });
  } catch {
    return {
      error: "Tạo học kỳ thất bại.",
    };
  }

  revalidatePath(`/organization/${orgId}`);
  return { data: semester };
};

export const createSemester = createSafeAction(CreateSemester, handler);
