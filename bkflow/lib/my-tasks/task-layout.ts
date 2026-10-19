export type TaskLayout = "rows" | "columns";

export const getTaskLayoutHref = (boardId: string, layout: TaskLayout, search = "") => {
  const params = new URLSearchParams(search);
  for (const key of ["task", "cardId", "checklistItemId"]) params.delete(key);
  const path = `/board/${boardId}${layout === "rows" ? "/list" : ""}`;
  const query = params.toString();
  return query ? `${path}?${query}` : path;
};
