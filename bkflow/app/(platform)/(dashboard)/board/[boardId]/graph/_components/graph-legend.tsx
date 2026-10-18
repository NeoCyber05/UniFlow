"use client";

import { memo } from "react";
import { AlertTriangle, CheckCircle2, Lock, Network, Zap } from "lucide-react";
import type { GraphLayoutResult } from "../_types";

type GraphLegendProps = {
  stats: GraphLayoutResult["stats"];
};

export const GraphLegend = memo(function GraphLegend({ stats }: GraphLegendProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200/80 bg-white/90 px-4 py-2.5 text-xs text-neutral-600 backdrop-blur-sm">
      {/* Stats summary */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 font-medium text-neutral-900">
          <Network className="h-3.5 w-3.5 text-violet-600" />
          <span>{stats.totalCards} công việc</span>
        </span>
        <span className="text-neutral-300">|</span>
        <span className="inline-flex items-center gap-1 text-neutral-600">
          <Zap className="h-3 w-3 text-sky-500" />
          <span>{stats.connectedCards} thẻ liên kết ({stats.dependencyCount} quan hệ)</span>
        </span>
        {stats.blockedCount > 0 && (
          <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-semibold text-amber-700 border border-amber-200">
            <Lock className="h-3 w-3" />
            <span>{stats.blockedCount} thẻ đang bị chặn</span>
          </span>
        )}
        {stats.conflictCount > 0 && (
          <span className="inline-flex items-center gap-1 rounded bg-rose-50 px-1.5 py-0.5 text-[11px] font-semibold text-rose-700 border border-rose-200 animate-pulse">
            <AlertTriangle className="h-3 w-3" />
            <span>{stats.conflictCount} xung đột hạn chót</span>
          </span>
        )}
      </div>

      {/* Visual Guide / Legends */}
      <div className="flex flex-wrap items-center gap-3 text-[11px] text-neutral-500">
        <div className="flex items-center gap-1">
          <span className="h-2 w-3 rounded-full bg-slate-400" />
          <span>Luồng chờ</span>
        </div>
        <div className="flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3 text-emerald-500" />
          <span>Đã xong</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="h-2 w-3 rounded-full bg-rose-500" />
          <span>Xung đột ngày</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full border-2 border-amber-400 bg-amber-100" />
          <span>Cần làm trước</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full border-2 border-emerald-500 bg-emerald-100" />
          <span>Mở khóa sau</span>
        </div>
      </div>
    </div>
  );
});
