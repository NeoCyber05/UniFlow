"use client";

import { useCardContext } from "@/hooks/use-my-tasks";
import { useEnsureActiveOrg } from "@/hooks/use-ensure-active-org";

type MyOrgControlProps = {
  personalOrgId: string | null;
  taskId: string | null;
};

/**
 * Chủ sở hữu duy nhất của org active trên trang /my/* (tránh hai effect tranh nhau).
 * Org của thẻ khi panel đang mở, org cá nhân khi không.
 */
export const MyOrgControl = ({ personalOrgId, taskId }: MyOrgControlProps) => {
  const { data: cardContext } = useCardContext(taskId);
  const targetOrgId = taskId ? cardContext?.orgId : personalOrgId;

  useEnsureActiveOrg(targetOrgId);

  return null;
};
