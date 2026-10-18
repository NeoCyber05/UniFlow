import type { NoteBlock } from "./blocks";

export type BlockCommand = "paragraph" | "h1" | "h2" | "h3" | "todo" | "bullet" | "numbered" | "quote" | "callout" | "divider" | "deadline" | "task";
export type TextBlock = Extract<NoteBlock, { text: string }>;

export const isTextBlock = (block: NoteBlock): block is TextBlock => "text" in block && block.type !== "deadline";

export const makeBlock = (command: BlockCommand, text = ""): NoteBlock => {
  const id = crypto.randomUUID();
  switch (command) {
    case "h1": case "h2": case "h3": return { id, type: "heading", level: Number(command[1]) as 1 | 2 | 3, text };
    case "todo": return { id, type: "todo", checked: false, text };
    case "divider": return { id, type: "divider" };
    case "task": return { id, type: "task", taskId: "" };
    case "deadline": return { id, type: "deadline", text, dueAt: "", reminder: "60", checked: false };
    default: return { id, type: command, text };
  }
};

// Turn a block into another type, keeping its id and text where the new type has text.
export const convertBlock = (block: NoteBlock, command: BlockCommand): NoteBlock => {
  const text = "text" in block ? block.text : "";
  return { ...makeBlock(command, text), id: block.id };
};

const SHORTCUTS: [RegExp, BlockCommand][] = [
  [/^# /, "h1"], [/^## /, "h2"], [/^### /, "h3"], [/^\[\] /, "todo"], [/^\[ \] /, "todo"],
  [/^[-*+] /, "bullet"], [/^1[.)] /, "numbered"], [/^> /, "quote"],
];

// Markdown-style prefixes typed at the start of a paragraph, as in AppFlowy.
export const matchMarkdownShortcut = (text: string): { command: BlockCommand; rest: string } | null => {
  if (text === "---") return { command: "divider", rest: "" };
  for (const [pattern, command] of SHORTCUTS) {
    const match = text.match(pattern);
    if (match) return { command, rest: text.slice(match[0].length) };
  }
  return null;
};

// Enter continues lists; Enter on an empty list item leaves the list instead.
export const commandAfterEnter = (block: NoteBlock): BlockCommand =>
  block.type === "todo" || block.type === "bullet" || block.type === "numbered" ? block.type : "paragraph";

export const shouldExitListOnEnter = (block: NoteBlock) =>
  ["todo", "bullet", "numbered", "quote", "callout"].includes(block.type) && "text" in block && block.text === "";

// 1-based position of a numbered block within its run of consecutive numbered blocks.
export const numberedIndex = (blocks: readonly NoteBlock[], index: number) => {
  let start = index;
  while (start > 0 && blocks[start - 1].type === "numbered") start--;
  return index - start + 1;
};
