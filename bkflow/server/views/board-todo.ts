// Data of app/(platform)/(dashboard)/board/[boardId]/todo/page.tsx (pure redirect to the agenda list).
export const loadBoardTodo = async ({ boardId, error }: { boardId: string; error?: string }) => {
  const query = new URLSearchParams();
  query.set("group", "agenda");
  if (error) query.set("error", error);

  return { redirect: `/board/${boardId}/list?${query.toString()}` } as const;
};
