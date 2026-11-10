import { tr } from "@/lib/i18n";

export const getBoardNavigation = (boardId: string, pathname: string) => {
  const base = `/board/${boardId}`;
  return [
    { id: "tasks", label: tr("boardNav.tasks"), href: `${base}/list`, active: [base, `${base}/list`, `${base}/todo`].includes(pathname) },
    { id: "calendar", label: tr("boardNav.calendar"), href: `${base}/calendar`, active: pathname === `${base}/calendar` },
    { id: "graph", label: tr("boardNav.graph"), href: `${base}/graph`, active: pathname === `${base}/graph` },
    // Tạm ẩn Thống kê khỏi sidebar; route /analytics vẫn mở được bằng URL
    // { id: "analytics", label: tr("boardNav.analytics"), href: `${base}/analytics`, active: pathname === `${base}/analytics` },
  ] as const;
};
