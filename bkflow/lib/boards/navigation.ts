export const getBoardNavigation = (boardId: string, pathname: string) => {
  const base = `/board/${boardId}`;
  return [
    { id: "tasks", label: "Việc cần làm", href: pathname === base ? base : `${base}/list`, active: [base, `${base}/list`, `${base}/todo`, `${base}/split`].includes(pathname) },
    { id: "calendar", label: "Lịch", href: `${base}/calendar`, active: pathname === `${base}/calendar` },
    { id: "graph", label: "Sơ đồ", href: `${base}/graph`, active: pathname === `${base}/graph` },
    { id: "analytics", label: "Thống kê", href: `${base}/analytics`, active: pathname === `${base}/analytics` },
  ] as const;
};
