import { z } from "zod";
import { toSearchKey } from "../my-tasks/parse-quick-add";

export const SearchReference = z.object({ type: z.enum(["card", "course", "board", "note", "page"]), id: z.string().min(1).max(100) });
export type SearchReference = z.infer<typeof SearchReference>;
export type WorkspaceSearchItem = SearchReference & { title: string; subtitle: string; href: string };
export const RECENT_LIMIT = 8;

export const parseRecentItems = (raw: string | null): SearchReference[] => {
  if (raw && raw.length > 3000) return [];
  try {
    const parsed = z.array(SearchReference).max(RECENT_LIMIT).safeParse(JSON.parse(raw ?? "[]"));
    return parsed.success ? parsed.data.filter((item, index, items) => items.findIndex(other => other.type === item.type && other.id === item.id) === index) : [];
  } catch { return []; }
};

export const rememberSearchItem = (items: SearchReference[], item: SearchReference): SearchReference[] =>
  [{ type: item.type, id: item.id }, ...items.filter(old => old.type !== item.type || old.id !== item.id)].slice(0, RECENT_LIMIT);

const NAVIGATION = [
  { id: "today", title: "Hôm nay", href: "/my/today" },
  { id: "tasks", title: "Công việc", href: "/my/tasks" },
  { id: "calendar", title: "Lịch của mình", href: "/my/calendar" },
  { id: "courses", title: "Học phần", href: "/my/courses" },
  { id: "notes", title: "Trang của tôi", href: "/pages" },
] as const;

export const getNavigationItems = (query: string): WorkspaceSearchItem[] => NAVIGATION
  .filter(item => toSearchKey(item.title).includes(toSearchKey(query)))
  .map(item => ({ ...item, type: "page", subtitle: "Đi đến" }));

export const workspaceBoardScope = (userId: string, orgId: string) => ({ orgId, members: { some: { userId } } });
