export type DescriptionSaveStatus = "saved" | "dirty" | "saving" | "error" | "conflict";

export type DescriptionSaveState = {
  draft: string;
  /** Last text known to be stored on the server. */
  base: string;
  baseUpdatedAt: string | null;
  /** Bumped on every edit. */
  revision: number;
  savingSnapshot: string | null;
  /** Identifies the in-flight request; responses with another seq are stale. */
  saveSeq: number;
  status: DescriptionSaveStatus;
};

export type DescriptionSaveEvent =
  | { type: "edit"; value: string }
  | { type: "saveStart" }
  | { type: "saveSuccess"; seq: number; snapshot: string; updatedAt: string | null }
  | { type: "saveFailure"; seq: number; conflict: boolean }
  | { type: "external"; value: string; updatedAt: string | null }
  | { type: "discard" };

export const createDescriptionSaveState = (
  description: string | null | undefined,
  updatedAt: string | null,
): DescriptionSaveState => ({
  draft: description ?? "",
  base: description ?? "",
  baseUpdatedAt: updatedAt,
  revision: 0,
  savingSnapshot: null,
  saveSeq: 0,
  status: "saved",
});

export const descriptionSaveReducer = (
  state: DescriptionSaveState,
  event: DescriptionSaveEvent,
): DescriptionSaveState => {
  switch (event.type) {
    case "edit": {
      if (event.value === state.draft) return state;
      const status: DescriptionSaveStatus =
        state.savingSnapshot !== null || state.status === "conflict"
          ? state.status
          : event.value === state.base
            ? "saved"
            : "dirty";
      return { ...state, draft: event.value, revision: state.revision + 1, status };
    }
    case "saveStart":
      if (state.savingSnapshot !== null) return state;
      return { ...state, savingSnapshot: state.draft, saveSeq: state.saveSeq + 1, status: "saving" };
    case "saveSuccess": {
      if (event.seq !== state.saveSeq) return state;
      return {
        ...state,
        base: event.snapshot,
        baseUpdatedAt: event.updatedAt ?? state.baseUpdatedAt,
        savingSnapshot: null,
        status: state.draft === event.snapshot ? "saved" : "dirty",
      };
    }
    case "saveFailure":
      if (event.seq !== state.saveSeq) return state;
      return { ...state, savingSnapshot: null, status: event.conflict ? "conflict" : "error" };
    case "external": {
      if (state.status !== "saved") return state;
      if (event.value === state.base && event.updatedAt === state.baseUpdatedAt) return state;
      return { ...state, draft: event.value, base: event.value, baseUpdatedAt: event.updatedAt };
    }
    case "discard":
      return { ...state, draft: state.base, savingSnapshot: null, status: "saved" };
  }
};
