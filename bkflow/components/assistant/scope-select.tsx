"use client";

import { Check, ChevronDown, LayoutGrid } from "lucide-react";

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { tr } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { formatWorkspaceTitle } from "@/lib/workspaces";

import type { AssistantBoard } from "./api";

/**
 * Chọn bảng đích của cuộc trò chuyện. Trợ lý vẫn đọc được mọi bảng và ghi chú của người dùng;
 * bảng này là nơi các đề xuất được áp dụng.
 */
export const ScopeSelect = ({ boards, value, onChange, disabled = false, className }: {
  boards: AssistantBoard[];
  value: string | null;
  onChange: (boardId: string) => void;
  disabled?: boolean;
  className?: string;
}) => {
  const current = boards.find((board) => board.id === value);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={disabled || boards.length === 0}>
        <button
          type="button"
          aria-label={tr("assistant.scope.aria", { board: current ? formatWorkspaceTitle(current.title) : "" })}
          className={cn("inline-flex h-7 max-w-[14rem] items-center gap-1.5 rounded-full bg-muted px-2.5 text-xs font-medium text-foreground/80 hover:bg-muted/80 disabled:opacity-60", className)}
        >
          <LayoutGrid aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="truncate">{current ? formatWorkspaceTitle(current.title) : tr("assistant.scope.pick")}</span>
          <ChevronDown aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">{tr("assistant.scope.help")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {boards.map((board) => (
          <DropdownMenuItem key={board.id} onClick={() => onChange(board.id)}>
            <span className="min-w-0 flex-1 truncate">{formatWorkspaceTitle(board.title)}</span>
            {board.id === value ? <Check className="size-4 text-violet-600" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
