"use client";

import { useState } from "react";
import { tr } from "@/lib/i18n";
import { useRouter } from "@/web/shims/next-navigation";
import { useQueryClient } from "@tanstack/react-query";
import { GraduationCap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ManageSemestersDialog } from "@/components/semesters/manage-semesters-dialog";
import { MY_TASKS_ROOT_KEY } from "@/lib/my-tasks/types";

export const NoSemesterState = () => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  return (
    <div className="mx-auto mt-16 max-w-md rounded-2xl border border-dashed border-neutral-200 p-8 text-center">
      <GraduationCap className="mx-auto mb-3 h-8 w-8 text-violet-500" />
      <p className="font-semibold text-neutral-800">{tr("semester.noneTitle")}</p>
      <p className="mt-1 text-sm text-neutral-500">{tr("semester.noneDesc")}</p>
      <Button type="button" className="mt-4" onClick={() => setOpen(true)}>
        {tr("semester.create")}
      </Button>
      <ManageSemestersDialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) {
            void queryClient.invalidateQueries({ queryKey: MY_TASKS_ROOT_KEY });
            router.refresh();
          }
        }}
        semesters={[]}
      />
    </div>
  );
};
