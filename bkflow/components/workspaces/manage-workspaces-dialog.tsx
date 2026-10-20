"use client";

import { useState } from "react";
import { tr } from "@/lib/i18n";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Check, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { createWorkspace } from "@/actions/workspaces/create-workspace";
import { deleteWorkspace } from "@/actions/workspaces/delete-workspace";
import { reorderWorkspaces } from "@/actions/workspaces/reorder-workspaces";
import { updateWorkspace } from "@/actions/workspaces/update-workspace";
import { ConfirmModal } from "@/components/modals/confirm-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAction } from "@/hooks/use-action";
import type { CourseColorKey } from "@/lib/courses/course-colors";
import { MY_TASKS_ROOT_KEY, type SerializedWorkspace } from "@/lib/my-tasks/types";

import { WorkspaceIconPicker } from "./workspace-icon-picker";

type ManageWorkspacesDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaces: SerializedWorkspace[];
  /** Gọi sau khi tạo xong (switcher dùng để mở workspace mới). */
  onCreated?: (workspaceId: string) => void;
};

export const ManageWorkspacesDialog = ({ open, onOpenChange, workspaces, onCreated }: ManageWorkspacesDialogProps) => {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [draft, setDraft] = useState<{ title: string; icon: string | null; color?: CourseColorKey }>({ title: "", icon: null });

  // Danh sách workspace đọc từ context my-tasks: làm mới sau mỗi thay đổi
  const refresh = () => { void queryClient.invalidateQueries({ queryKey: MY_TASKS_ROOT_KEY }); };

  const { execute: executeCreate, isLoading: isCreating } = useAction(createWorkspace, {
    onSuccess: (workspace) => {
      toast.success(tr("workspace.createSuccess"));
      setDraft({ title: "", icon: null });
      refresh();
      onCreated?.(workspace.id);
    },
    onError: (error) => toast.error(error),
  });
  const { execute: executeUpdate, isLoading: isUpdating } = useAction(updateWorkspace, {
    onSuccess: () => { setEditingId(null); refresh(); },
    onError: (error) => toast.error(error),
  });
  const { execute: executeDelete, isLoading: isDeleting } = useAction(deleteWorkspace, {
    onSuccess: () => { toast.success(tr("workspace.deleted")); refresh(); },
    onError: (error) => toast.error(error),
  });
  const { execute: executeReorder, isLoading: isReordering } = useAction(reorderWorkspaces, {
    onSuccess: refresh,
    onError: (error) => toast.error(error),
  });

  const isBusy = isCreating || isUpdating || isDeleting || isReordering;

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= workspaces.length) return;
    const next = [...workspaces];
    [next[index], next[target]] = [next[target], next[index]];
    executeReorder({ items: next.map((workspace, order) => ({ id: workspace.id, order: order + 1 })) });
  };

  const saveTitle = (event: React.FormEvent, id: string) => {
    event.preventDefault();
    executeUpdate({ id, title: editTitle });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{tr("workspace.manage")}</DialogTitle>
        </DialogHeader>

        <ul className="max-h-72 space-y-2 overflow-y-auto pr-1">
          {workspaces.length === 0 && <li className="py-6 text-center text-sm text-muted-foreground">{tr("workspace.none")}</li>}
          {workspaces.map((workspace, index) => (
            <li key={workspace.id} className="flex items-center gap-2 rounded-lg border p-2">
              <div className="flex flex-col">
                <Button type="button" variant="ghost" size="icon-xs" aria-label={tr("workspace.moveUp")} disabled={isBusy || index === 0} onClick={() => move(index, -1)}><ArrowUp /></Button>
                <Button type="button" variant="ghost" size="icon-xs" aria-label={tr("workspace.moveDown")} disabled={isBusy || index === workspaces.length - 1} onClick={() => move(index, 1)}><ArrowDown /></Button>
              </div>
              <WorkspaceIconPicker
                icon={workspace.icon}
                color={workspace.color}
                title={workspace.title}
                onChange={(value) => executeUpdate({ id: workspace.id, ...value })}
              />
              {editingId === workspace.id ? (
                <form className="flex flex-1 items-center gap-1" onSubmit={(event) => saveTitle(event, workspace.id)}>
                  <Input autoFocus value={editTitle} maxLength={50} onChange={(event) => setEditTitle(event.target.value)}
                    onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); setEditingId(null); } }} className="h-8" />
                  <Button type="submit" variant="ghost" size="icon-sm" aria-label={tr("common.save")} disabled={isBusy}><Check /></Button>
                </form>
              ) : (
                <>
                  <span className="flex-1 truncate text-sm font-medium">{workspace.title}</span>
                  {workspace.isCurrent && <Badge variant="violet" className="px-1.5 py-0 text-[10px]">{tr("workspace.current")}</Badge>}
                  <Button type="button" variant="ghost" size="icon-sm" aria-label={tr("workspace.edit")} onClick={() => { setEditingId(workspace.id); setEditTitle(workspace.title); }}><Pencil /></Button>
                </>
              )}
              <ConfirmModal
                title={tr("workspace.deleteTitle", { title: workspace.title })}
                description={tr("workspace.deleteDesc")}
                onConfirm={() => executeDelete({ id: workspace.id })}
                disabled={isBusy}
              >
                <Button type="button" variant="ghost" size="icon-sm" aria-label={tr("workspace.delete")} disabled={isBusy} className="text-rose-500 hover:bg-rose-50">
                  <Trash2 />
                </Button>
              </ConfirmModal>
            </li>
          ))}
        </ul>

        <form
          className="flex items-center gap-2 border-t pt-3"
          onSubmit={(event) => { event.preventDefault(); executeCreate({ title: draft.title, icon: draft.icon, color: draft.color }); }}
        >
          <WorkspaceIconPicker
            icon={draft.icon}
            color={draft.color ?? "violet"}
            title={draft.title}
            onChange={(value) => setDraft((current) => ({ ...current, ...value }))}
          />
          <Input value={draft.title} maxLength={50} placeholder={tr("workspace.namePlaceholder")} aria-label={tr("workspace.namePlaceholder")}
            onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} className="h-9 flex-1" />
          <Button type="submit" variant="primary" size="sm" disabled={isBusy || !draft.title.trim()}><Plus />{tr("workspace.add")}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
