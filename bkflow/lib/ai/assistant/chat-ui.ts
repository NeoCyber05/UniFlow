// Logic thuần cho giao diện chat Trợ lý (dùng chung client + test): nguồn đã đọc, câu hỏi gợi ý, tag @ứng dụng.

export type MentionApp = { slug: string; handle: string; name: string; logo: string };

/** App có công cụ đọc trong Trợ lý; `handle` là chữ sau @ (không dấu cách). */
export const MENTION_APPS: MentionApp[] = [
  { slug: "gmail", handle: "Gmail", name: "Gmail", logo: "/gmail.svg" },
  { slug: "slack", handle: "Slack", name: "Slack", logo: "/slack.svg" },
  { slug: "outlook", handle: "Outlook", name: "Outlook", logo: "/connector-logos/outlook.svg" },
  { slug: "googlecalendar", handle: "Calendar", name: "Google Calendar", logo: "/connector-logos/googlecalendar.svg" },
  { slug: "google_classroom", handle: "Classroom", name: "Google Classroom", logo: "/connector-logos/google_classroom.svg" },
  { slug: "googletasks", handle: "Tasks", name: "Google Tasks", logo: "/connector-logos/googletasks.svg" },
  { slug: "notion", handle: "Notion", name: "Notion", logo: "/connector-logos/notion.svg" },
  { slug: "microsoft_teams", handle: "Teams", name: "Microsoft Teams", logo: "/connector-logos/microsoft_teams.svg" },
  { slug: "jira", handle: "Jira", name: "Jira", logo: "/connector-logos/jira.svg" },
  { slug: "trello", handle: "Trello", name: "Trello", logo: "/connector-logos/trello.svg" },
];

const APP_BY_SLUG = new Map(MENTION_APPS.map((app) => [app.slug, app]));
const APP_BY_HANDLE = new Map(MENTION_APPS.map((app) => [app.handle.toLowerCase(), app]));

export const findMentionApp = (handle: string) => APP_BY_HANDLE.get(handle.toLowerCase());

/** Ứng dụng khớp chữ đang gõ sau @ (theo handle hoặc tên). */
export const matchMentionApps = (query: string) => {
  const needle = query.toLowerCase();
  return MENTION_APPS.filter((app) => app.handle.toLowerCase().startsWith(needle) || app.name.toLowerCase().includes(needle));
};

/** Tách "@Gmail xem mail" thành chữ và tag app; handle không khớp app nào giữ nguyên là chữ. */
export const splitMentions = (text: string): (string | MentionApp)[] =>
  text.split(/(@[A-Za-z]+)/).flatMap((chunk) => {
    if (!chunk) return [];
    const app = chunk.startsWith("@") ? findMentionApp(chunk.slice(1)) : undefined;
    return [app ?? chunk];
  });

export type AnswerSource = {
  /** Khóa duy nhất trong một câu trả lời (href nếu có). */
  id: string;
  title: string;
  subtitle?: string;
  href?: string;
  /** "uniflow" hoặc slug ứng dụng kết nối. */
  app: string;
  /** Loại mục UniFlow (card, note, board, course) để chọn icon. */
  kind?: string;
};

const TOOL_APP: Record<string, string> = {
  listRecentEmails: "gmail", readEmail: "gmail", searchSlackMessages: "slack",
  listClassroomCourses: "google_classroom", listClassroomCoursework: "google_classroom",
  listOutlookEmails: "outlook", readOutlookEmail: "outlook",
  listGoogleCalendarEvents: "googlecalendar", getGoogleCalendarBusy: "googlecalendar",
  searchNotionPages: "notion", readNotionBlocks: "notion", searchTeamsMessages: "microsoft_teams",
  searchJiraIssues: "jira", listTrelloBoards: "trello", listTrelloCards: "trello",
  listGoogleTaskLists: "googletasks", listGoogleTasks: "googletasks",
};

type Row = Record<string, unknown>;
const row = (value: unknown): Row | undefined => (value && typeof value === "object" && !Array.isArray(value) ? (value as Row) : undefined);
const rows = (value: unknown): Row[] => (Array.isArray(value) ? value.map(row).filter((item): item is Row => item !== undefined) : []);
const str = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : undefined);

const uniflow = (item: Row, subtitle?: string): AnswerSource[] => {
  const title = str(item.title);
  const href = str(item.href);
  return title && href ? [{ id: href, title, href, subtitle: subtitle ?? str(item.subtitle), app: "uniflow", kind: str(item.type) }] : [];
};

const email = (item: Row): AnswerSource[] => {
  const href = str(item.href);
  const id = href ?? str(item.id);
  return id ? [{ id, href, title: str(item.subject) ?? "(Không tiêu đề)", subtitle: str(item.from), app: "gmail" }] : [];
};

/** Mảng `matches` của kết quả tìm Slack (JSON thô, vị trí tùy lớp bọc của Composio). */
const findMatches = (value: unknown, depth = 0): Row[] => {
  const item = row(value);
  if (!item || depth > 4) return [];
  if (Array.isArray(item.matches)) return rows(item.matches);
  for (const child of Object.values(item)) {
    const found = findMatches(child, depth + 1);
    if (found.length) return found;
  }
  return [];
};

const slackMessages = (raw: unknown): AnswerSource[] => {
  let data: unknown;
  try { data = JSON.parse(String(raw)); } catch { return []; } // bị cắt cụt: dùng nguồn chung
  return findMatches(data).flatMap((match) => {
    const href = str(match.permalink);
    const text = str(match.text)?.replace(/<!channel>|<!here>/g, "@channel").replace(/\s+/g, " ");
    if (!href || !text) return [];
    const channel = str(row(match.channel)?.name);
    const user = str(match.username) ?? str(match.user_name);
    return [{ id: href, href, title: text.length > 90 ? `${text.slice(0, 90)}…` : text, subtitle: [user, channel && `#${channel}`].filter(Boolean).join(" · ") || undefined, app: "slack" }];
  });
};

/** Nguồn một lần gọi công cụ đã đọc (chỉ công cụ tra cứu có kết quả). */
export const sourcesFromTool = (tool: string, output: unknown, callId: string): AnswerSource[] => {
  const result = row(output);
  if (!result || result.ok === false) return [];
  switch (tool) {
    case "searchWorkspace":
      return rows(result.items).flatMap((item) => uniflow(item));
    case "getMyAgenda":
      return rows(result.items).flatMap((item) => uniflow(item, str(item.source)));
    case "getPage": {
      const page = row(result.page);
      return page ? uniflow({ ...page, type: "note" }, "Trang ghi chú") : [];
    }
    case "listRecentEmails":
      return rows(result.emails).flatMap(email);
    case "readEmail":
      return email(row(result.email) ?? {});
    case "searchSlackMessages": {
      const messages = slackMessages(result.result);
      if (messages.length) return messages;
      break;
    }
  }
  const app = APP_BY_SLUG.get(TOOL_APP[tool] ?? "");
  return app ? [{ id: `${tool}:${callId}`, title: app.name, subtitle: "Dữ liệu đã đọc", app: app.slug }] : [];
};

type ToolPartLike = { type: string; toolCallId: string; state: string; output?: unknown };

/** Mọi nguồn của một câu trả lời, theo thứ tự đọc, bỏ trùng. */
export const collectSources = (parts: ToolPartLike[]): AnswerSource[] => {
  const seen = new Set<string>();
  return parts.flatMap((part) => part.state === "output-available"
    ? sourcesFromTool(part.type.replace(/^tool-/, ""), part.output, part.toolCallId)
    : []).filter((source) => !seen.has(source.id) && Boolean(seen.add(source.id)));
};

const normalizeHref = (href: string) => {
  let value = href.trim();
  try { value = decodeURI(value); } catch { /* giữ nguyên */ }
  return value.replace(/^https?:\/\/[^/]+(?=\/(board|pages)\/)/, "");
};

/** Số thứ tự (từ 0) của nguồn có href khớp liên kết trong câu trả lời, hoặc -1. */
export const sourceIndexOf = (sources: AnswerSource[], href: string | undefined) => {
  if (!href) return -1;
  const target = normalizeHref(href);
  return sources.findIndex((source) => source.href !== undefined && normalizeHref(source.href) === target);
};

const FOLLOW_UP = /^\s*>>\s*(.*?)\s*$/;

/** Tách các dòng ">> câu hỏi" (gợi ý hỏi tiếp) khỏi thân câu trả lời. */
export const splitFollowUps = (text: string, streaming = false) => {
  const followUps: string[] = [];
  const lines = text.split("\n").filter((line) => {
    const match = FOLLOW_UP.exec(line);
    if (!match) return true;
    if (match[1]) followUps.push(match[1]);
    return false;
  });
  // Dòng ">" đang gõ dở của một gợi ý: không hiện thành trích dẫn trong lúc stream.
  if (streaming && /^\s*>\s*$/.test(lines[lines.length - 1] ?? "")) lines.pop();
  return { body: lines.join("\n").trimEnd(), followUps: followUps.slice(0, 3) };
};

/** Thời gian (ms) server ghi kèm câu trả lời đã lưu. */
export const answerDurationMs = (parts: { type: string }[]) => {
  const part = parts.find((item) => item.type === "data-timing") as { data?: { ms?: unknown } } | undefined;
  return typeof part?.data?.ms === "number" ? part.data.ms : undefined;
};
