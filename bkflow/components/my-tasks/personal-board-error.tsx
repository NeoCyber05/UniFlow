"use client";

import { tr } from "@/lib/i18n";
import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";

export const PersonalBoardError = () => {
  return (
    <div className="mx-auto mt-16 max-w-md rounded-2xl border border-dashed border-neutral-200 p-8 text-center">
      <span className="mx-auto mb-3 flex size-9 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
        <Sparkles aria-hidden="true" className="size-5" />
      </span>
      <p role="alert" className="font-semibold text-neutral-800">{tr("route.boardLoadError")}</p>
      <Button type="button" className="mt-4" onClick={() => window.location.reload()}>{tr("route.retry")}</Button>
    </div>
  );
};
