import { z } from "zod";

import { WorkspaceColorInput, WorkspaceIconInput, WorkspaceTitleInput } from "@/lib/workspaces";

export const CreateWorkspace = z.object({
  title: WorkspaceTitleInput,
  icon: WorkspaceIconInput.optional(),
  color: WorkspaceColorInput.optional(),
});
