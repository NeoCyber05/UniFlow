"use client";

import { useState } from "react";
import { tr } from "@/lib/i18n";
import { Check, ChevronDown, Plus, Settings2 } from "lucide-react";
import { useRouter } from "@/web/shims/next-navigation";

import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useMobileSidebar } from "@/hooks/use-mobile-sidebar";
import { useMyTasksContext } from "@/hooks/use-my-tasks";

import { ManageWorkspacesDialog } from "./manage-workspaces-dialog";
import { WorkspaceIcon } from "./workspace-icon";

/** Switcher duy nhất của app. Chọn = đặt làm hiện tại (qua view /workspace/:id) rồi mở bảng. */
export const WorkspaceSwitcher = () => {
  const router = useRouter();
  const { data: context } = useMyTasksContext();
  const [manageOpen, setManageOpen] = useState(false);
  const workspaces = context?.workspaces ?? [];
  const current = workspaces.find((workspace) => workspace.id === context?.currentWorkspaceId);

  const open = (workspaceId: string) => {
    useMobileSidebar.getState().onClose();
    router.push(`/workspace/${workspaceId}`);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="flex h-10 w-full items-center gap-2 rounded-lg border bg-background px-2 text-sm font-semibold hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring">
          {current && <WorkspaceIcon icon={current.icon} color={current.color} title={current.title} />}
          <span className="flex-1 truncate text-left">{current?.title ?? tr("workspace.label")}</span>
          <ChevronDown aria-hidden="true" className="size-3.5 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-60">
          <DropdownMenuLabel className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{tr("workspace.label")}</DropdownMenuLabel>
          {workspaces.map((workspace) => (
            <DropdownMenuItem key={workspace.id} onSelect={() => open(workspace.id)} className="gap-2">
              <WorkspaceIcon icon={workspace.icon} color={workspace.color} title={workspace.title} />
              <span className="flex-1 truncate">{workspace.title}</span>
              {workspace.id === context?.currentWorkspaceId && <Check aria-label={tr("workspace.current")} className="size-4 text-violet-600" />}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setManageOpen(true)} className="gap-2 text-violet-700">
            <Plus className="size-4" />{tr("workspace.create")}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setManageOpen(true)} className="gap-2">
            <Settings2 className="size-4" />{tr("workspace.manage")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ManageWorkspacesDialog
        open={manageOpen}
        onOpenChange={setManageOpen}
        workspaces={workspaces}
        onCreated={(id) => { setManageOpen(false); open(id); }}
      />
    </>
  );
};
