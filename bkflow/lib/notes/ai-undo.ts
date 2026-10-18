export type AiUndoState = "ready" | "already-undone" | "conflict";

export const canUndoAiNoteEdit = (input: {
  undoneAt: Date | null;
  appliedUpdatedAt: Date;
  pageUpdatedAt: Date;
}): AiUndoState => {
  if (input.undoneAt) return "already-undone";
  return input.appliedUpdatedAt.getTime() === input.pageUpdatedAt.getTime() ? "ready" : "conflict";
};
