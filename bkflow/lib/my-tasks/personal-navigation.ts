export const getPersonalBoardDestination = (view: string, boardId: string): string | null => {
  // "courses": trang Học phần cũ đã bỏ, chuyển về bảng kỳ
  if (view === "today" || view === "courses") return `/board/${boardId}/list`;
  if (view === "calendar") return `/board/${boardId}/calendar`;
  if (["tasks", "upcoming", "important"].includes(view)) {
    return `/board/${boardId}/list?group=agenda${view === "important" ? "&important=1" : ""}`;
  }
  return null;
};
