"use client";

import { Download } from "lucide-react";

import { tr } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import type { TimelineZoom } from "../_types";
import { getZoomLabel, ZOOM_OPTIONS } from "../_lib/date-utils";

type TimelineToolbarProps = {
  zoom: TimelineZoom;
  onZoomChange: (zoom: TimelineZoom) => void;
  onExportPng?: () => void;
  isExporting?: boolean;
  canExport?: boolean;
};

export const TimelineToolbar = ({
  zoom,
  onZoomChange,
  onExportPng,
  isExporting = false,
  canExport = true,
}: TimelineToolbarProps) => (
  <div className="flex flex-wrap items-center gap-2">
    <div className="flex items-center gap-1 rounded-lg border border-neutral-200 bg-white p-1">
      {ZOOM_OPTIONS.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onZoomChange(option)}
          className={cn(
            "h-8 cursor-pointer rounded-md px-3 text-xs font-semibold text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-950",
            zoom === option && "bg-violet-600 text-white shadow-sm hover:bg-violet-600 hover:text-white",
          )}
        >
          {getZoomLabel(option)}
        </button>
      ))}
    </div>
    {onExportPng && (
      <button
        type="button"
        onClick={onExportPng}
        disabled={!canExport || isExporting}
        className="inline-flex h-9 cursor-pointer items-center gap-x-1.5 rounded-lg border border-neutral-200 bg-white px-3 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50 hover:text-neutral-950 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Download className="h-3.5 w-3.5 shrink-0" />
        <span>{isExporting ? tr("timeline.toolbar.exporting") : tr("timeline.toolbar.exportPng")}</span>
      </button>
    )}
  </div>
);
