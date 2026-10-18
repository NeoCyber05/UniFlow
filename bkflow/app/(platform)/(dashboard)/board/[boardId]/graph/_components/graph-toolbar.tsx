"use client";

import { memo } from "react";
import {
  Download,
  Filter,
  Maximize2,
  Minus,
  Plus,
  Search,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { GraphFilterMode } from "../_types";

type GraphToolbarProps = {
  filterMode: GraphFilterMode;
  onFilterModeChange: (mode: GraphFilterMode) => void;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onFitView: () => void;
  onExportPng: () => void;
  isExporting: boolean;
  totalCardsCount: number;
  connectedCardsCount: number;
  canEdit?: boolean;
  onOpenAutoChain?: () => void;
};

export const GraphToolbar = memo(function GraphToolbar({
  filterMode,
  onFilterModeChange,
  searchQuery,
  onSearchQueryChange,
  zoom,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onFitView,
  onExportPng,
  isExporting,
  totalCardsCount,
  connectedCardsCount,
  canEdit = false,
  onOpenAutoChain,
}: GraphToolbarProps) {
  const zoomPercent = Math.round(zoom * 100);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200/80 bg-white/95 px-4 py-2.5 backdrop-blur-sm">
      {/* Left controls: Filter buttons & Search */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center rounded-lg border border-neutral-200 bg-neutral-100/60 p-0.5 shadow-2xs">
          <button
            type="button"
            onClick={() => onFilterModeChange("connected_only")}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition cursor-pointer",
              filterMode === "connected_only"
                ? "bg-white text-violet-700 shadow-xs"
                : "text-neutral-600 hover:text-neutral-900",
            )}
          >
            <Filter className="h-3 w-3" />
            <span>Có liên kết ({connectedCardsCount})</span>
          </button>
          <button
            type="button"
            onClick={() => onFilterModeChange("all")}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-semibold transition cursor-pointer",
              filterMode === "all"
                ? "bg-white text-violet-700 shadow-xs"
                : "text-neutral-600 hover:text-neutral-900",
            )}
          >
            <span>Tất cả ({totalCardsCount})</span>
          </button>
        </div>

        {/* Search */}
        <div className="relative w-48 sm:w-56">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
          <Input
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            placeholder="Tìm kiếm công việc..."
            className="h-8 pl-8 pr-2.5 text-xs bg-white border-neutral-200 focus-visible:ring-violet-500"
          />
        </div>
      </div>

      {/* Right controls: Zoom & Export */}
      <div className="flex items-center gap-1.5">
        {/* Zoom controls */}
        <div className="flex items-center rounded-lg border border-neutral-200 bg-white p-0.5 shadow-2xs">
          <Button
            variant="ghost"
            size="sm"
            onClick={onZoomOut}
            title="Thu nhỏ"
            className="h-7 w-7 p-0 text-neutral-600 hover:bg-neutral-100"
          >
            <Minus className="h-3.5 w-3.5" />
          </Button>

          <button
            type="button"
            onClick={onResetZoom}
            title="Đặt lại 100%"
            className="px-2 text-xs font-semibold text-neutral-700 hover:text-violet-600 cursor-pointer min-w-10 text-center"
          >
            {zoomPercent}%
          </button>

          <Button
            variant="ghost"
            size="sm"
            onClick={onZoomIn}
            title="Phóng to"
            className="h-7 w-7 p-0 text-neutral-600 hover:bg-neutral-100"
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>

        {canEdit && onOpenAutoChain && (
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenAutoChain}
            title="Tự động thiết lập chuỗi phụ thuộc theo cột hoặc deadline"
            className="h-8 gap-1.5 px-2.5 text-xs font-semibold text-violet-700 border-violet-200 bg-violet-50/60 hover:bg-violet-100 shadow-2xs"
          >
            <Zap className="h-3.5 w-3.5 fill-violet-600 text-violet-600" />
            <span className="hidden sm:inline">Nối chuỗi tự động</span>
          </Button>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={onFitView}
          title="Vừa màn hình"
          className="h-8 gap-1 px-2.5 text-xs font-semibold text-neutral-700 shadow-2xs"
        >
          <Maximize2 className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Vừa màn hình</span>
        </Button>

        {/* Export PNG */}
        <Button
          variant="outline"
          size="sm"
          onClick={onExportPng}
          disabled={isExporting}
          className="h-8 gap-1.5 px-3 text-xs font-semibold text-neutral-700 shadow-2xs"
        >
          <Download className="h-3.5 w-3.5" />
          <span>{isExporting ? "Đang xuất..." : "Xuất PNG"}</span>
        </Button>
      </div>
    </div>
  );
});
