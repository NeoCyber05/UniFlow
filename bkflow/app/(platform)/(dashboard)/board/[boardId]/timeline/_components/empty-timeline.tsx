"use client";

import { CalendarClock } from "lucide-react";

import { tr } from "@/lib/i18n";

export const EmptyTimeline = ({ hasCards }: { hasCards: boolean }) => (
  <div className="flex min-h-[320px] items-center justify-center rounded-lg border border-dashed border-neutral-300 bg-white p-6 text-center">
    <div>
      <CalendarClock className="mx-auto h-10 w-10 text-neutral-300" />
      <h2 className="mt-3 text-base font-semibold text-neutral-900">
        {hasCards ? tr("timeline.empty.noScheduledTitle") : tr("timeline.empty.noCardsTitle")}
      </h2>
      <p className="mt-1 max-w-md text-sm text-neutral-500">
        {hasCards
          ? tr("timeline.empty.noScheduledDesc")
          : tr("timeline.empty.noCardsDesc")}
      </p>
    </div>
  </div>
);
