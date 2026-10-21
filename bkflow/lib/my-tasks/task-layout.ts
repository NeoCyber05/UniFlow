export type TaskLayout = "rows" | "columns" | "split";

const LAYOUT_SUFFIX: Record<TaskLayout, string> = { rows: "/list", columns: "", split: "/split" };

export const getTaskLayoutHref = (boardId: string, layout: TaskLayout, search = "") => {
  const params = new URLSearchParams(search);
  for (const key of ["task", "cardId", "checklistItemId"]) params.delete(key);
  const path = `/board/${boardId}${LAYOUT_SUFFIX[layout]}`;
  const query = params.toString();
  return query ? `${path}?${query}` : path;
};
