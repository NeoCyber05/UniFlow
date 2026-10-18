"use client";

import { useEffect } from "react";
import { usePathname } from "@/web/shims/next-navigation";
import { useOrganization, useOrganizationList } from "@clerk/react";

type BoardOrgControlProps = {
  orgId: string;
};

export const BoardOrgControl = ({ orgId }: BoardOrgControlProps) => {
  const pathname = usePathname();
  const { organization, isLoaded } = useOrganization();
  const { setActive } = useOrganizationList();
  // Tab Danh sách (chế độ thời hạn) có thể mở việc nhóm → MyOrgControl trong view tự quản org
  const ownedByListView = pathname.endsWith("/list") || pathname.endsWith("/todo");

  useEffect(() => {
    if (ownedByListView || !isLoaded || !setActive || organization?.id === orgId) {
      return;
    }

    setActive({
      organization: orgId,
    });
  }, [isLoaded, organization?.id, orgId, ownedByListView, setActive]);

  return null;
};
