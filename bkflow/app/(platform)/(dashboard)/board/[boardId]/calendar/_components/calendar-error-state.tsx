"use client";

import { AlertCircle } from "lucide-react";

import { tr } from "@/lib/i18n";

export const CalendarErrorState = () => (
  <div className="flex min-h-[320px] flex-col items-center justify-center rounded-b-lg border border-red-100 bg-red-50 px-4 text-center text-red-700">
    <AlertCircle className="mb-2 h-6 w-6" />
    <p className="text-sm font-semibold">{tr("calendar.error.title")}</p>
    <p className="mt-1 max-w-md text-xs text-red-600">
      {tr("calendar.error.desc")}
    </p>
  </div>
);
