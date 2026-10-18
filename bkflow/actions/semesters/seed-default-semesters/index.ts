"use server";

import { auth } from "@/server/auth";
import { revalidatePath } from "@/server/cache";

import { createSafeAction } from "@/lib/create-safe-action";
import { seedDefaultHustSemesters } from "@/lib/semesters-db";

import { InputType, ReturnType } from "./types";
import { SeedDefaultSemesters } from "./schema";

const handler = async (_data: InputType): Promise<ReturnType> => {
  void _data;
  const { userId } = await auth();

  if (!userId) {
    return {
      error: "Không có quyền truy cập.",
    };
  }

  try {
    const semesters = await seedDefaultHustSemesters(userId);
    revalidatePath("/dashboard");
    return { data: semesters };
  } catch {
    return {
      error: "Khởi tạo học kỳ thất bại.",
    };
  }
};

export const seedDefaultSemesters = createSafeAction(SeedDefaultSemesters, handler);
