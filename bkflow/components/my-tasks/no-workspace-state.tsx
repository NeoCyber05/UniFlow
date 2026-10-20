"use client";

import { useState } from "react";
import { tr } from "@/lib/i18n";
import { useRouter } from "@/web/shims/next-navigation";
import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ManageWorkspacesDialog } from "@/components/workspaces/manage-workspaces-dialog";

export const NoWorkspaceState = () => {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <div className="mx-auto mt-16 max-w-md rounded-2xl border border-dashed border-neutral-200 p-8 text-center">
      <span className="mx-auto mb-3 flex size-9 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
        <Sparkles aria-hidden="true" className="size-5" />
      </span>
      <p className="font-semibold text-neutral-800">{tr("workspace.noneTitle")}</p>
      <p className="mt-1 text-sm text-neutral-500">{tr("workspace.noneDesc")}</p>
      <Button type="button" className="mt-4" onClick={() => setOpen(true)}>{tr("workspace.create")}</Button>
      <ManageWorkspacesDialog
        open={open}
        onOpenChange={setOpen}
        workspaces={[]}
        onCreated={(id) => router.push(`/workspace/${id}`)}
      />
    </div>
  );
};
