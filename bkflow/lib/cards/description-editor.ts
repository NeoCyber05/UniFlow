import type { SelectionTask } from "../ai/selection-contract";

// Only offer Markdown blocks supported by the existing description preview.
export const SLASH_COMMANDS = [
  { id: "text", label: "Văn bản", aliases: "text paragraph", markdown: "" },
  { id: "h1", label: "Tiêu đề 1", aliases: "heading h1", markdown: "# " },
  { id: "h2", label: "Tiêu đề 2", aliases: "heading h2", markdown: "## " },
  { id: "h3", label: "Tiêu đề 3", aliases: "heading h3", markdown: "### " },
  { id: "bullet", label: "Danh sách", aliases: "list bullet", markdown: "- " },
  { id: "checklist", label: "Checklist", aliases: "cong viec todo checkbox", markdown: "- [ ] " },
] as const;

export type SlashContext = { start: number; end: number; query: string };

export const getSlashContext = (value: string, start: number, end: number): SlashContext | null => {
  if (start !== end) return null;
  const before = value.slice(0, start);
  let fence: string | null = null;
  for (const line of before.split("\n").slice(0, -1)) {
    const match = line.match(/^\s*(`{3,}|~{3,})/);
    if (!match) continue;
    if (!fence) fence = match[1];
    else if (match[1][0] === fence[0] && match[1].length >= fence.length) fence = null;
  }
  if (fence) return null;
  const match = before.slice(before.lastIndexOf("\n") + 1).match(/^[\t ]*\/([\p{L}\p{N} _-]*)$/u);
  return match ? { start: start - match[1].length - 1, end: start, query: match[1] } : null;
};

const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d").toLowerCase().trim();

export const filterSlashCommands = (query: string) => SLASH_COMMANDS.filter(command =>
  normalize(`${command.label} ${command.aliases}`).includes(normalize(query)),
);

export const insertSlashCommand = (value: string, context: SlashContext, markdown: string) => ({
  value: value.slice(0, context.start) + markdown + value.slice(context.end),
  caret: context.start + markdown.length,
});

export const applySelectionResult = (current: string, snapshot: string, start: number, end: number, result: string, task: SelectionTask) => {
  if (current !== snapshot || start < 0 || end <= start || end > snapshot.length) return null;
  const selected = snapshot.slice(start, end);
  const suffix = snapshot.slice(end);
  const replacement = task === "explain"
    ? `${selected}\n\n${result}${suffix && !suffix.startsWith("\n") ? "\n\n" : ""}`
    : `${selected.match(/^\s*/)?.[0] ?? ""}${result}${selected.match(/\s*$/)?.[0] ?? ""}`;
  return snapshot.slice(0, start) + replacement + snapshot.slice(end);
};

/** "Thêm nội dung": puts a "/" on its own line so the shared slash command list opens. */
export const openSlashAtCursor = (value: string, start: number) => {
  const lineStart = value.lastIndexOf("\n", start - 1) + 1;
  const prefix = value.slice(lineStart, start).trim() ? "\n/" : "/";
  return { value: value.slice(0, start) + prefix + value.slice(start), caret: start + prefix.length };
};
