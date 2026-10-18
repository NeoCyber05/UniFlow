export const getPersonalBoardDestination = (view: string, boardId: string): string | null => {
  if (view === "calendar") return `/board/${boardId}/calendar`;
  if (["tasks", "upcoming", "important"].includes(view)) {
    return `/board/${boardId}/list?group=agenda${view === "important" ? "&important=1" : ""}`;
  }
  return null;
};
