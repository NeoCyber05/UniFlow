"use client";

import { useMemo, useState } from "react";
import { tr } from "@/lib/i18n";
import { CalendarRange, ChevronDown, Settings2 } from "lucide-react";
import type { Semester } from "@prisma/client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  compareHustSemesters,
  formatSemesterLabel,
  getSemesterTermName,
  parseSemesterCode,
} from "@/lib/semesters";

import { ManageSemestersDialog } from "./manage-semesters-dialog";

type SemesterSwitcherProps = {
  semesters: Semester[];
  selectedSemesterId: string;
  onSelectSemester: (semesterId: string) => void;
  /** Hiện mục "Tất cả học kỳ". Tắt khi chọn kỳ để mở bảng. */
  showAll?: boolean;
};

export const SemesterSwitcher = ({
  semesters,
  selectedSemesterId,
  onSelectSemester,
  showAll = true,
}: SemesterSwitcherProps) => {
  const [manageOpen, setManageOpen] = useState(false);

  const sortedSemesters = useMemo(
    () => [...semesters].sort(compareHustSemesters),
    [semesters],
  );

  const selectedSemester = semesters.find((semester) => semester.id === selectedSemesterId);
  const label = selectedSemester ? formatSemesterLabel(selectedSemester.title) : tr("semester.all");

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 rounded-lg border-neutral-200 bg-white text-xs sm:text-sm font-medium text-neutral-700 shadow-sm hover:border-violet-300 hover:text-violet-700 transition-colors"
          >
            <CalendarRange className="h-3.5 w-3.5 text-violet-600 shrink-0" />
            <span className="max-w-44 truncate">{label}</span>
            <ChevronDown className="h-3.5 w-3.5 text-neutral-400 shrink-0" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
            {tr("sidebar.pickSemester")}
          </DropdownMenuLabel>
          <DropdownMenuRadioGroup value={selectedSemesterId} onValueChange={onSelectSemester}>
            {showAll && (
            <DropdownMenuRadioItem value="all" className="cursor-pointer">
              {tr("semester.all")}
            </DropdownMenuRadioItem>
            )}
            {sortedSemesters.map((semester) => {
              const parsed = parseSemesterCode(semester.title);
              const termName = parsed ? getSemesterTermName(parsed.term) : null;

              return (
                <DropdownMenuRadioItem
                  key={semester.id}
                  value={semester.id}
                  className="flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-semibold text-neutral-800">{semester.title}</span>
                    {termName && (
                      <span className="text-[11px] text-neutral-500 font-normal">
                        ({termName})
                      </span>
                    )}
                  </div>
                  {semester.isCurrent && (
                    <span className="ml-2 rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700 shrink-0">
                      {tr("semester.current")}
                    </span>
                  )}
                </DropdownMenuRadioItem>
              );
            })}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => setManageOpen(true)}
            className="cursor-pointer gap-2 text-violet-700 hover:bg-violet-50 font-medium text-xs"
          >
            <Settings2 className="h-3.5 w-3.5 text-violet-600" />
            {tr("semester.manage")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ManageSemestersDialog
        open={manageOpen}
        onOpenChange={setManageOpen}
        semesters={semesters}
      />
    </>
  );
};
