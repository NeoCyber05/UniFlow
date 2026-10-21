"use client";

import { useState } from "react";
import { tr } from "@/lib/i18n";

import { IconPicker } from "@/components/notes/page-actions";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { COURSE_COLOR_KEYS, getCourseColor, type CourseColorKey } from "@/lib/courses/course-colors";
import { cn } from "@/lib/utils";
import { WORKSPACE_ICON_NAMES, parseWorkspaceIcon, toLucideIcon } from "@/lib/workspaces";

import { WORKSPACE_LUCIDE_ICONS, WorkspaceIcon } from "./workspace-icon";

type WorkspaceIconPickerProps = {
  icon: string | null;
  color: string;
  title: string;
  onChange: (value: { icon?: string | null; color?: CourseColorKey }) => void;
  size?: "sm" | "md";
};

export const WorkspaceIconPicker = ({ icon, color, title, onChange, size = "md" }: WorkspaceIconPickerProps) => {
  const [tab, setTab] = useState<"emoji" | "icon">(parseWorkspaceIcon(icon)?.kind === "lucide" ? "icon" : "emoji");

  return (
    <Popover>
      <PopoverTrigger type="button" aria-label={tr("workspace.pickIcon")} className="rounded-md focus-visible:outline-2 focus-visible:outline-ring">
        <WorkspaceIcon icon={icon} color={color} title={title} size={size} />
      </PopoverTrigger>
      {/* Submit của ô emoji tự nhập nổi qua portal tới form ngoài (form tạo workspace): chặn lại */}
      <PopoverContent align="start" className="w-80 space-y-3" onSubmit={(event) => event.stopPropagation()}>
        <div role="tablist" className="grid grid-cols-2 gap-1 rounded-md bg-muted p-1 text-xs font-medium">
          {(["emoji", "icon"] as const).map((value) => (
            <button key={value} type="button" role="tab" aria-selected={tab === value} onClick={() => setTab(value)}
              className={cn("rounded px-2 py-1", tab === value ? "bg-background shadow-xs" : "text-muted-foreground")}>
              {tr(value === "emoji" ? "workspace.iconTabEmoji" : "workspace.iconTabIcon")}
            </button>
          ))}
        </div>

        {tab === "emoji" ? (
          <IconPicker value={icon} onSelect={(next) => onChange({ icon: next })} />
        ) : (
          <div className="grid grid-cols-6 gap-1">
            {WORKSPACE_ICON_NAMES.map((name) => {
              const Icon = WORKSPACE_LUCIDE_ICONS[name];
              const value = toLucideIcon(name);
              return (
                <button key={name} type="button" aria-label={name} onClick={() => onChange({ icon: value })}
                  className={cn("flex size-9 items-center justify-center rounded-md hover:bg-muted", icon === value && "bg-muted ring-1 ring-ring")}>
                  <Icon className="size-4" />
                </button>
              );
            })}
          </div>
        )}

        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground">{tr("workspace.iconColor")}</p>
          <div className="flex flex-wrap gap-1.5">
            {COURSE_COLOR_KEYS.map((key) => (
              <button key={key} type="button" aria-label={key} aria-pressed={color === key} onClick={() => onChange({ color: key })}
                className={cn("size-6 rounded-full ring-offset-2 ring-offset-background", getCourseColor(key).dot, color === key && "ring-2 ring-ring")} />
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
