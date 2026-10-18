"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { useRouter } from "@/web/shims/next-navigation";
import { toast } from "sonner";

import { setPersonalWorkspace } from "@/actions/workspace/set-personal-workspace";

type WorkspaceContextValue = {
  personalOrgId: string | null;
  /** Học kỳ đang diễn ra của không gian cá nhân, để link thẳng tới bảng kỳ */
  currentSemesterId: string | null;
  setPersonalOrgId: (orgId: string) => Promise<boolean>;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export const useWorkspaceContext = () => {
  const context = useContext(WorkspaceContext);

  if (!context) {
    throw new Error("useWorkspaceContext must be used within WorkspaceProvider");
  }

  return context;
};

interface WorkspaceProviderProps {
  initialPersonalOrgId: string | null;
  currentSemesterId?: string | null;
  children: React.ReactNode;
}

export const WorkspaceProvider = ({
  initialPersonalOrgId,
  currentSemesterId = null,
  children,
}: WorkspaceProviderProps) => {
  const router = useRouter();
  const [personalOrgId, setPersonalOrgIdState] = useState(initialPersonalOrgId);

  const setPersonalOrgId = useCallback(async (orgId: string) => {
    const previous = personalOrgId;
    setPersonalOrgIdState(orgId);

    const result = await setPersonalWorkspace({ orgId });

    if (result.error || !result.data) {
      setPersonalOrgIdState(previous);
      toast.error(result.error ?? "Không thể lưu không gian cá nhân.");
      return false;
    }

    router.refresh();
    return true;
  }, [personalOrgId, router]);

  return (
    <WorkspaceContext.Provider value={{ personalOrgId, currentSemesterId, setPersonalOrgId }}>
      {children}
    </WorkspaceContext.Provider>
  );
};
