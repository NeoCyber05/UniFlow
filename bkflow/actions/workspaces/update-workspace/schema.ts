import { z } from "zod";

import { WorkspaceColorInput, WorkspaceIconInput, WorkspaceTitleInput } from "@/lib/workspaces";

export const UpdateWorkspace = z.object({
  id: z.string(),
  title: WorkspaceTitleInput.optional(),
  icon: WorkspaceIconInput.optional(),
  color: WorkspaceColorInput.optional(),
});
