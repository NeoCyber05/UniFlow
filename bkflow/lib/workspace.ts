import "server-only";

import { cache } from "react";
import { clerkClient } from "@/server/auth";

import { db } from "@/lib/db";

export type WorkspaceType = "PERSONAL" | "TEAM";

const PERSONAL_NAME_HINT = /cá nhân|personal|học tập|hust/i;

/**
 * Org dùng làm Không gian cá nhân của user, lưu ở UserPreference.
 * Lần đầu (chưa lưu) tự chọn từ membership Clerk rồi lưu lại, để mọi
 * thiết bị thấy cùng một kết quả.
 */
export const resolvePersonalOrgId = cache(async (userId: string): Promise<string | null> => {
  try {
    const preference = await db.userPreference.findUnique({
      where: { userId },
      select: { personalOrgId: true },
    });

    if (preference?.personalOrgId) {
      return preference.personalOrgId;
    }
  } catch (error) {
    console.error("[RESOLVE_PERSONAL_ORG_ID_PREFERENCE_ERROR]", error);
  }

  try {
    const client = await clerkClient();
    const { data } = await client.users.getOrganizationMembershipList({ userId, limit: 100 });
    const orgs = data.map((membership) => membership.organization);

    if (orgs.length === 0) {
      return null;
    }

    const picked = orgs.find((org) => PERSONAL_NAME_HINT.test(org.name)) ?? orgs[0];

    try {
      await db.userPreference.upsert({
        where: { userId },
        create: { userId, personalOrgId: picked.id },
        update: { personalOrgId: picked.id },
      });
    } catch (upsertError) {
      console.error("[UPSERT_PERSONAL_ORG_ID_ERROR]", upsertError);
    }

    return picked.id;
  } catch (error) {
    console.error("[RESOLVE_PERSONAL_ORG_ID]", error);
    return null;
  }
});

export const getWorkspaceType = async (userId: string, orgId: string): Promise<WorkspaceType> => {
  const personalOrgId = await resolvePersonalOrgId(userId);

  return personalOrgId === orgId ? "PERSONAL" : "TEAM";
};
