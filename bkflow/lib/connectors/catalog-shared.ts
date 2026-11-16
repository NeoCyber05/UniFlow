// Metadata danh mục ứng dụng (dùng chung server + client). Không chứa trạng thái kết nối của user.
export type ConnectorCatalogItem = {
  slug: string;
  name: string;
  description: string;
  logoUrl: string | null;
  /** Có adapter đọc thật trong Trợ lý (không suy từ việc vendor có OAuth). */
  taskReadSupported: boolean;
};

export type ConnectorCatalog = {
  items: ConnectorCatalogItem[];
  source: "composio" | "fallback";
  /** false khi danh mục chỉ tải được một phần (lỗi/giới hạn trang) hoặc dùng dự phòng. */
  complete: boolean;
};

export type CatalogFilter = "all" | "connected";

// Chỉ hiện ứng dụng giao tiếp, mạng xã hội và công việc trong Cài đặt Trợ lý.
const ASSISTANT_APPS = new Set([
  "gmail", "outlook", "outlookcalendar", "googlecalendar", "google_classroom", "googletasks", "googledrive", "googledocs", "googlesheets",
  "slack", "microsoft_teams", "microsoftteams", "teams", "discord", "discordbot", "telegram", "whatsapp",
  "facebook", "facebook_page", "linkedin", "twitter", "reddit", "youtube", "tiktok",
  "notion", "github", "gitlab", "linear", "jira", "asana", "trello", "clickup", "monday",
  "microsoft_onedrive", "onedrive", "share_point", "sharepoint", "dropbox", "box", "zoom", "googlemeet",
  "todoist", "microsofttodo", "confluence", "airtable",
]);

/** Lọc theo tên/slug (không phân biệt hoa thường) rồi sắp: đã kết nối → có hỗ trợ → tên. */
export const filterCatalog = (
  items: ConnectorCatalogItem[],
  { query, filter, isConnected }: { query: string; filter: CatalogFilter; isConnected: (slug: string) => boolean },
): ConnectorCatalogItem[] => {
  const needle = query.trim().toLowerCase();
  return items
    .filter((item) => ASSISTANT_APPS.has(item.slug))
    .filter((item) => !needle || item.name.toLowerCase().includes(needle) || item.slug.includes(needle))
    .filter((item) => filter === "all" || isConnected(item.slug))
    .sort((a, b) =>
      Number(isConnected(b.slug)) - Number(isConnected(a.slug))
      || Number(b.taskReadSupported) - Number(a.taskReadSupported)
      || a.name.localeCompare(b.name));
};
