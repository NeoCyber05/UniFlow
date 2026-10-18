"use server";

import { auth, clerkClient } from "@/server/auth";
import { revalidatePath } from "@/server/cache";

import { db } from "@/lib/db";
import { createSafeAction } from "@/lib/create-safe-action";

import { SetPersonalWorkspace } from "./schema";
import { InputType, ReturnType } from "./types";

const handler = async (data: InputType): Promise<ReturnType> => {
  const { userId } = await auth();

  if (!userId) {
    return {
      error: "Không có quyền truy cập.",
    };
  }

  const { orgId } = data;

  try {
    const client = await clerkClient();
    const { data: memberships } = await client.organizations.getOrganizationMembershipList({
      organizationId: orgId,
      userId: [userId],
      limit: 1,
    });

    if (memberships.length === 0) {
      return {
        error: "Bạn không thuộc không gian này.",
      };
    }

    await db.userPreference.upsert({
      where: { userId },
      create: { userId, personalOrgId: orgId },
      update: { personalOrgId: orgId },
    });
  } catch (error) {
    console.error("[SET_PERSONAL_WORKSPACE]", error);
    return {
      error: "Không thể lưu không gian cá nhân.",
    };
  }

  revalidatePath("/", "layout");

  return { data: { personalOrgId: orgId } };
};

export const setPersonalWorkspace = createSafeAction(SetPersonalWorkspace, handler);
