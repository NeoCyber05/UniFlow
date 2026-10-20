import {
  BookOpen, Brain, Briefcase, Calculator, Calendar, Camera, Code, Coffee, Dumbbell, FlaskConical,
  Flame, Globe, GraduationCap, Heart, House, Languages, Laptop, Leaf, Lightbulb, Microscope,
  Music, Palette, PenTool, Plane, Rocket, Sparkles, Star, Target, Trophy, Users,
  type LucideIcon,
} from "lucide-react";

import { getCourseColor } from "@/lib/courses/course-colors";
import { cn } from "@/lib/utils";
import { parseWorkspaceIcon, type WorkspaceIconName } from "@/lib/workspaces";

export const WORKSPACE_LUCIDE_ICONS: Record<WorkspaceIconName, LucideIcon> = {
  BookOpen, GraduationCap, Briefcase, Code, Target, FlaskConical,
  Rocket, Music, Heart, House, Palette, Calculator,
  Globe, Languages, Dumbbell, Coffee, Lightbulb, Brain,
  Trophy, Star, Flame, Leaf, Plane, Camera,
  PenTool, Microscope, Laptop, Users, Calendar, Sparkles,
};

type WorkspaceIconProps = {
  icon: string | null;
  color: string;
  title: string;
  size?: "sm" | "md";
  className?: string;
};

/** Ô màu của workspace: emoji, icon lucide tô màu, hoặc chữ cái đầu khi chưa chọn icon. */
export const WorkspaceIcon = ({ icon, color, title, size = "sm", className }: WorkspaceIconProps) => {
  const parsed = parseWorkspaceIcon(icon);
  const box = cn(
    "inline-flex shrink-0 items-center justify-center rounded-md ring-1",
    getCourseColor(color).chip,
    size === "sm" ? "size-6 text-sm" : "size-8 text-base",
    className,
  );

  if (parsed?.kind === "emoji") return <span aria-hidden="true" className={box}>{parsed.value}</span>;

  if (parsed?.kind === "lucide") {
    const Icon = WORKSPACE_LUCIDE_ICONS[parsed.name];
    return <span aria-hidden="true" className={box}><Icon className={size === "sm" ? "size-3.5" : "size-4"} /></span>;
  }

  return <span aria-hidden="true" className={cn(box, "font-semibold")}>{title.trim().charAt(0).toUpperCase() || "W"}</span>;
};
