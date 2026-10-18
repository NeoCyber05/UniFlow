import type { MutableRefObject } from "react";

/** Resolves true when it is safe to close or switch away (nothing unsaved, or the user chose to discard). */
export type BeforeClose = () => Promise<boolean>;
export type BeforeCloseRef = MutableRefObject<BeforeClose | null>;

export const runBeforeClose = (ref: BeforeCloseRef) => ref.current?.() ?? Promise.resolve(true);
