// Keep bookmarked links working without restoring workspace switching.
export const loadWorkspace = async (_params: { workspaceId: string }, userId: string | null) => {
  if (!userId) {
    return { redirect: "/sign-in" } as const;
  }

  return { redirect: "/my/today" } as const;
};
