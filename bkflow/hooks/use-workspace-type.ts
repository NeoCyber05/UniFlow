"use client";

import { useCallback } from "react";

import { useWorkspaceContext } from "@/components/providers/workspace-provider";

export type WorkspaceType = "PERSONAL" | "TEAM";

export const useWorkspaceType = (activeOrgId?: string) => {
  const { personalOrgId, currentSemesterId, setPersonalOrgId } = useWorkspaceContext();

  const isPersonalWorkspace = useCallback(
    (orgId?: string | null): boolean => Boolean(orgId) && orgId === personalOrgId,
    [personalOrgId]
  );

  const currentType: WorkspaceType = isPersonalWorkspace(activeOrgId) ? "PERSONAL" : "TEAM";

  return {
    personalOrgId,
    currentSemesterId,
    setPersonalOrgId,
    isPersonalWorkspace,
    currentType,
  };
};
