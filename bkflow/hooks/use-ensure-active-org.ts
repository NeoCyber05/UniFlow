"use client";

import { useEffect } from "react";
import { useOrganization, useOrganizationList } from "@clerk/react";

/**
 * API thẻ và phần lớn action lọc theo org đang active trong Clerk.
 * Hook đổi org active sang `orgId` và trả về true khi đã khớp.
 */
export const useEnsureActiveOrg = (orgId: string | null | undefined) => {
  const { organization, isLoaded } = useOrganization();
  const { setActive } = useOrganizationList();

  useEffect(() => {
    if (!orgId || !isLoaded || !setActive || organization?.id === orgId) {
      return;
    }

    void setActive({ organization: orgId });
  }, [isLoaded, orgId, organization?.id, setActive]);

  return Boolean(orgId) && isLoaded && organization?.id === orgId;
};
