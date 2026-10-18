import { z } from "zod";
import { PageStyleSchema } from "./page-style";

export const SaveNotePage = z.object({
  title: z.string().trim().min(1).max(200),
  content: z.string().max(100000),
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
