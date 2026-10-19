import { serializeNoteBlocks, type NoteBlock } from "./blocks";

export const shouldResaveNote = (sent: string, saved: string, current: string) => sent === saved && current !== sent;

// A page in preservation mode (unsupported stored document) never autosaves; only an explicit replacement clears it.
export const buildNoteSave = (draft: { title: string; blocks: NoteBlock[]; style: unknown }, expectedUpdatedAt: string, preserved: boolean) =>
  preserved ? null : { title: draft.title, style: draft.style, content: serializeNoteBlocks(draft.blocks), expectedUpdatedAt };
