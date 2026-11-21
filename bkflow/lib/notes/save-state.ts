import { serializeNoteBlocks, type NoteBlock } from "./blocks";

export const shouldResaveNote = (sent: string, saved: string, current: string) => sent === saved && current !== sent;

export const saveBeforeNoteNavigation = async (save: () => Promise<boolean>, hasUnsavedChanges: () => boolean) => {
  while (hasUnsavedChanges()) {
    if (!(await save())) return false;
  }
  return true;
};

// A page in preservation mode (unsupported stored document) never autosaves; only an explicit replacement clears it.
export const buildNoteSave = (draft: { title: string; blocks: NoteBlock[]; style: unknown }, expectedUpdatedAt: string, preserved: boolean) =>
  preserved ? null : { title: draft.title, style: draft.style, content: serializeNoteBlocks(draft.blocks), expectedUpdatedAt };
