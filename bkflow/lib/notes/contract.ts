import { z } from "zod";
import { isStructuredNoteContent, parseNoteBlocks } from "./blocks";
import { PageStyleSchema } from "./page-style";

export const SaveNotePage = z.object({
  title: z.string().trim().min(1).max(200),
  content: z.string().max(100000).refine(isStructuredNoteContent, "Nội dung trang không đúng định dạng."),
  style: PageStyleSchema.nullable(),
  expectedUpdatedAt: z.string().datetime(),
});

export type NotePageData = {
  id: string;
  title: string;
  content: string;
  style: unknown;
  updatedAt: string;
};

// A page link stores only Card.id; title/deadline/status are read fresh per request under the viewer's permission.
export type LinkedTask = {
  id: string;
  title: string;
  boardId: string;
  isCompleted: boolean;
  dueDate: string | null;
  deadlineOn: string | null;
  updatedAt: string;
};

// "unavailable" covers deleted, archived and out-of-permission tasks alike, so no detail leaks.
export type LinkedTaskResult = { taskId: string; state: "available"; task: LinkedTask } | { taskId: string; state: "unavailable" };

export const MAX_LINKED_TASKS = 100;

// Empty taskId is an unpicked task block, never a query.
export const getLinkedTaskIds = (content: string) =>
  [...new Set(parseNoteBlocks(content).flatMap(block => block.type === "task" && block.taskId ? [block.taskId] : []))].slice(0, MAX_LINKED_TASKS);

export type LinkedTaskView =
  | { state: "empty" | "checking" | "unavailable" | "error" | "pending" }
  | { state: "available"; task: LinkedTask }
  | { state: "picked"; title: string; subtitle: string };

// Old ref data is never shown as confirmed: hidden while re-checking, and a network error is not reported as deletion.
export const resolveLinkedTaskView = (
  taskId: string,
  query: { results?: LinkedTaskResult[]; fetching: boolean; error: "denied" | "network" | null },
  picked?: { title: string; subtitle: string },
): LinkedTaskView => {
  if (!taskId) return { state: "empty" };
  if (query.fetching) return { state: "checking" };
  if (query.error) return { state: query.error === "denied" ? "unavailable" : "error" };
  const result = query.results?.find(item => item.taskId === taskId);
  if (result) return result.state === "available" ? { state: "available", task: result.task } : { state: "unavailable" };
  // Picked in an unsaved edit: the endpoint reads saved content, so show the search hit until autosave + refetch.
  return picked ? { state: "picked", ...picked } : { state: "pending" };
};
