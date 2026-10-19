"use client";

import { useState } from "react";
import { Columns3, Rows3 } from "lucide-react";

import { cn } from "@/lib/utils";

export type KanbanLayout = "columns" | "rows";

const STORAGE_KEY = "bkflow_kanban_layout";

const readLayout = (): KanbanLayout => {
  try {
    return localStorage.getItem(STORAGE_KEY) === "rows" ? "rows" : "columns";
  } catch {
    return "columns";
  }
};

export const useKanbanLayout = () => {
  const [layout, setLayout] = useState<KanbanLayout>(readLayout);
  const change = (next: KanbanLayout) => {
    setLayout(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Ignore localStorage write errors
    }
  };
  return [layout, change] as const;
};

const OPTIONS = [
  { id: "columns", label: "Cột", icon: Columns3 },
  { id: "rows", label: "Hàng", icon: Rows3 },
] as const;

export const KanbanLayoutToggle = ({
  value,
  onChange,
}: {
  value: KanbanLayout;
  onChange: (layout: KanbanLayout) => void;
}) => (
  <div role="radiogroup" aria-label="Bố cục bảng" className="inline-flex h-8 items-center rounded-lg bg-white/90 p-0.5 shadow-sm ring-1 ring-black/5">
    {OPTIONS.map(({ id, label, icon: Icon }) => (
      <button
        key={id}
        type="button"
        role="radio"
        aria-checked={value === id}
        onClick={() => onChange(id)}
        className={cn(
          "inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-semibold text-neutral-500 transition hover:text-neutral-800",
          value === id && "bg-neutral-900 text-white hover:text-white",
        )}
      >
        <Icon className="h-3.5 w-3.5" />
        {label}
      </button>
    ))}
  </div>
);
