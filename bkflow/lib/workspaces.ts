import { z } from "zod";

import { COURSE_COLOR_KEYS } from "@/lib/courses/course-colors";

export const DEFAULT_WORKSPACE_TITLE = "Workspace của tôi";

/** Icon lucide cho workspace. Thêm tên ở đây thì phải thêm vào WORKSPACE_LUCIDE_ICONS (TS báo nếu thiếu). */
export const WORKSPACE_ICON_NAMES = [
  "BookOpen", "GraduationCap", "Briefcase", "Code", "Target", "FlaskConical",
  "Rocket", "Music", "Heart", "House", "Palette", "Calculator",
  "Globe", "Languages", "Dumbbell", "Coffee", "Lightbulb", "Brain",
  "Trophy", "Star", "Flame", "Leaf", "Plane", "Camera",
  "PenTool", "Microscope", "Laptop", "Users", "Calendar", "Sparkles",
] as const;

export type WorkspaceIconName = (typeof WORKSPACE_ICON_NAMES)[number];

const LUCIDE_PREFIX = "lucide:";

export const toLucideIcon = (name: WorkspaceIconName) => `${LUCIDE_PREFIX}${name}`;

export type ParsedWorkspaceIcon =
  | { kind: "emoji"; value: string }
  | { kind: "lucide"; name: WorkspaceIconName }
  | null;

export const parseWorkspaceIcon = (icon: string | null | undefined): ParsedWorkspaceIcon => {
  if (!icon) return null;
  if (!icon.startsWith(LUCIDE_PREFIX)) return { kind: "emoji", value: icon };
  const name = icon.slice(LUCIDE_PREFIX.length);
  return (WORKSPACE_ICON_NAMES as readonly string[]).includes(name)
    ? { kind: "lucide", name: name as WorkspaceIconName }
    : null;
};

export const WorkspaceTitleInput = z.string().trim()
  .min(1, { message: "Vui lòng nhập tên workspace." })
  .max(50, { message: "Tên workspace tối đa 50 ký tự." });

export const WorkspaceIconInput = z.string().trim().min(1).max(40).nullable()
  .refine(
    (icon) => icon === null || (icon.startsWith(LUCIDE_PREFIX) ? parseWorkspaceIcon(icon) !== null : icon.length <= 16),
    { message: "Icon không hợp lệ." },
  );

export const WorkspaceColorInput = z.enum(COURSE_COLOR_KEYS);

/** Workspace mặc định để mở: cái được đánh dấu hiện tại, không có thì cái đầu tiên theo order. */
export const pickCurrentWorkspace = <T extends { isCurrent: boolean; order: number }>(workspaces: T[]): T | null =>
  workspaces.find((workspace) => workspace.isCurrent)
  ?? [...workspaces].sort((a, b) => a.order - b.order)[0]
  ?? null;
