"use server";

import { auth } from "@/server/clerk";
import { revalidatePath } from "@/server/cache";

import { createSafeAction } from "@/lib/create-safe-action";
import { seedDefaultHustSemesters } from "@/lib/semesters-db";

import { InputType, ReturnType } from "./types";
import { SeedDefaultSemesters } from "./schema";

const handler = async (_data: InputType): Promise<ReturnType> => {
  void _data;
  const { userId, orgId } = await auth();

  if (!userId || !orgId) {
    return {
      error: "Không có quyền truy cập.",
    };
  }

  try {
    const semesters = await seedDefaultHustSemesters(orgId);
    revalidatePath(`/organization/${orgId}`);
    return { data: semesters };
  } catch {
    return {
      error: "Khởi tạo học kỳ thất bại.",
    };
  }
};

export const seedDefaultSemesters = createSafeAction(SeedDefaultSemesters, handler);
