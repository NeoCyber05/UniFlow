"use client";

import { useMemo, useState } from "react";
import { tr } from "@/lib/i18n";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import {
  CalendarRange,
  Check,
  Loader2,
  Pencil,
  Plus,
  Sparkles,
  Star,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import type { Semester } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { ConfirmModal } from "@/components/modals/confirm-modal";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useAction } from "@/hooks/use-action";
import { createSemester } from "@/actions/semesters/create-semester";
import { updateSemester } from "@/actions/semesters/update-semester";
import { deleteSemester } from "@/actions/semesters/delete-semester";
import { setCurrentSemester } from "@/actions/semesters/set-current-semester";
import { seedDefaultSemesters } from "@/actions/semesters/seed-default-semesters";
import {
  compareHustSemesters,
  getSemesterDefaultDates,
  getSemesterTermName,
  getSuggestedHustSemesters,
  parseSemesterCode,
} from "@/lib/semesters";

type ManageSemestersDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  semesters: Semester[];
};

const toInputDate = (date: Date) => format(date, "yyyy-MM-dd");

type SemesterFormValues = {
  title: string;
  startDate: string;
  endDate: string;
};

const EMPTY_FORM: SemesterFormValues = { title: "", startDate: "", endDate: "" };

export const ManageSemestersDialog = ({
  open,
  onOpenChange,
  semesters,
}: ManageSemestersDialogProps) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState<SemesterFormValues>(EMPTY_FORM);
  const [editForm, setEditForm] = useState<SemesterFormValues>(EMPTY_FORM);

  const sortedSemesters = useMemo(
    () => [...semesters].sort(compareHustSemesters),
    [semesters],
  );

  const existingTitles = useMemo(
    () => new Set(semesters.map((s) => s.title.trim())),
    [semesters],
  );

  const suggestedCodes = useMemo(
    () => getSuggestedHustSemesters(),
    [],
  );

  const { execute: executeCreate, fieldErrors: createErrors, isLoading: isCreating } = useAction(
    createSemester,
    {
      onSuccess: () => {
        toast.success(tr("semester.createSuccess"));
        setCreateForm(EMPTY_FORM);
      },
      onError: (error) => toast.error(error),
    },
  );

  const { execute: executeUpdate, fieldErrors: updateErrors, isLoading: isUpdating } = useAction(
    updateSemester,
    {
      onSuccess: () => {
        toast.success(tr("semester.updateSuccess"));
        setEditingId(null);
      },
      onError: (error) => toast.error(error),
    },
  );

  const { execute: executeDelete, isLoading: isDeleting } = useAction(deleteSemester, {
    onSuccess: () => toast.success(tr("semester.deleted")),
    onError: (error) => toast.error(error),
  });

  const { execute: executeSetCurrent, isLoading: isSettingCurrent } = useAction(
    setCurrentSemester,
    {
      onSuccess: () => toast.success(tr("semester.setCurrentDone")),
      onError: (error) => toast.error(error),
    },
  );

  const { execute: executeSeed, isLoading: isSeeding } = useAction(seedDefaultSemesters, {
    onSuccess: () => toast.success(tr("semester.seedDone")),
    onError: (error) => toast.error(error),
  });

  // Tự động suy luận ngày khi người dùng chọn mã học kỳ
  const applyHustCodeToCreateForm = (code: string) => {
    const parsed = parseSemesterCode(code);
    if (parsed) {
      const dates = getSemesterDefaultDates(parsed.year, parsed.term);
      setCreateForm({
        title: code,
        startDate: toInputDate(dates.startDate),
        endDate: toInputDate(dates.endDate),
      });
    } else {
      setCreateForm((prev) => ({ ...prev, title: code }));
    }
  };

  const handleCreateTitleChange = (val: string) => {
    const parsed = parseSemesterCode(val);
    if (parsed) {
      const dates = getSemesterDefaultDates(parsed.year, parsed.term);
      setCreateForm({
        title: val,
        startDate: toInputDate(dates.startDate),
        endDate: toInputDate(dates.endDate),
      });
    } else {
      setCreateForm((prev) => ({ ...prev, title: val }));
    }
  };

  const startEdit = (semester: Semester) => {
    setEditingId(semester.id);
    setEditForm({
      title: semester.title,
      startDate: toInputDate(new Date(semester.startDate)),
      endDate: toInputDate(new Date(semester.endDate)),
    });
  };

  const onCreateSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    executeCreate({
      title: createForm.title,
      startDate: createForm.startDate as unknown as Date,
      endDate: createForm.endDate as unknown as Date,
    });
  };

  const onEditSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingId) return;
    executeUpdate({
      id: editingId,
      title: editForm.title,
      startDate: editForm.startDate as unknown as Date,
      endDate: editForm.endDate as unknown as Date,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <div className="flex items-center justify-between pr-6">
            <DialogTitle className="flex items-center gap-2 text-base font-semibold text-neutral-900">
              <CalendarRange className="h-4 w-4 text-violet-600" />
              Quản lý học kỳ (HUST)
            </DialogTitle>
            {semesters.length < suggestedCodes.length && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => executeSeed({})}
                disabled={isSeeding}
                className="h-7 gap-1 px-2.5 text-xs font-medium text-violet-700 hover:bg-violet-50 border-violet-200"
              >
                {isSeeding ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Sparkles className="h-3 w-3 text-amber-500" />
                )}
                {tr("semester.seedButton")}
              </Button>
            )}
          </div>
          <DialogDescription className="text-xs text-neutral-500">
            {tr("semester.formatIntro")} <code className="bg-neutral-100 px-1 py-0.5 rounded text-neutral-800 font-mono text-[11px]">2025.1</code>, <code className="bg-neutral-100 px-1 py-0.5 rounded text-neutral-800 font-mono text-[11px]">2025.2</code>, <code className="bg-neutral-100 px-1 py-0.5 rounded text-neutral-800 font-mono text-[11px]">2025.6</code>{tr("semester.formatEnd")}
          </DialogDescription>
        </DialogHeader>

        {/* Danh sách học kỳ đã có */}
        <div className="max-h-64 space-y-2 overflow-y-auto pr-1 styled-scrollbar">
          {sortedSemesters.length === 0 && (
            <div className="py-8 text-center bg-neutral-50 rounded-xl border border-dashed border-neutral-200">
              <CalendarRange className="h-8 w-8 text-neutral-400 mx-auto mb-2" />
              <p className="text-sm font-medium text-neutral-700">{tr("semester.none")}</p>
              <p className="text-xs text-neutral-400 mt-1 max-w-sm mx-auto">
                {tr("semester.seedHint")}
              </p>
            </div>
          )}

          {sortedSemesters.map((semester) => {
            const parsed = parseSemesterCode(semester.title);
            const termName = parsed ? getSemesterTermName(parsed.term) : null;

            return (
              <div
                key={semester.id}
                className={cn(
                  "rounded-xl border border-neutral-200 p-2.5 transition-colors",
                  semester.isCurrent && "border-violet-300 bg-violet-50/50 shadow-xs",
                )}
              >
                {editingId === semester.id ? (
                  <form onSubmit={onEditSubmit} className="space-y-2">
                    <Input
                      autoFocus
                      value={editForm.title}
                      onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                      placeholder={tr("semester.codeLabel")}
                      className="h-8 text-sm"
                    />
                    <div className="flex items-center gap-2">
                      <Input
                        type="date"
                        value={editForm.startDate}
                        onChange={(e) => setEditForm((f) => ({ ...f, startDate: e.target.value }))}
                        className="h-8 text-xs"
                      />
                      <span className="text-xs text-neutral-400">{tr("common.to")}</span>
                      <Input
                        type="date"
                        value={editForm.endDate}
                        onChange={(e) => setEditForm((f) => ({ ...f, endDate: e.target.value }))}
                        className="h-8 text-xs"
                      />
                    </div>
                    {(updateErrors?.title || updateErrors?.startDate || updateErrors?.endDate) && (
                      <p className="text-xs text-rose-500">
                        {updateErrors?.title?.[0] || updateErrors?.startDate?.[0] || updateErrors?.endDate?.[0]}
                      </p>
                    )}
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => setEditingId(null)}
                      >
                        {tr("common.cancel")}
                      </Button>
                      <Button type="submit" size="sm" variant="primary" className="h-7 text-xs" disabled={isUpdating}>
                        {isUpdating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : tr("common.save")}
                      </Button>
                    </div>
                  </form>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-neutral-900 font-mono">
                          {semester.title}
                        </span>
                        {termName && (
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px] px-1.5 py-0 font-medium",
                              parsed?.term === "1" && "bg-sky-50 text-sky-700 border-sky-200",
                              parsed?.term === "2" && "bg-emerald-50 text-emerald-700 border-emerald-200",
                              parsed?.term === "6" && "bg-amber-50 text-amber-700 border-amber-200",
                            )}
                          >
                            {termName}
                          </Badge>
                        )}
                        {semester.isCurrent && (
                          <Badge variant="violet" className="text-[10px] px-1.5 py-0">
                            {tr("semester.current")}
                          </Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-neutral-500 mt-0.5">
                        {format(new Date(semester.startDate), "dd/MM/yyyy", { locale: vi })} –{" "}
                        {format(new Date(semester.endDate), "dd/MM/yyyy", { locale: vi })}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {!semester.isCurrent && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          title={tr("semester.setCurrent")}
                          disabled={isSettingCurrent}
                          onClick={() => executeSetCurrent({ id: semester.id })}
                          className="hover:text-amber-600 hover:bg-amber-50"
                        >
                          <Star className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        title={tr("semester.rename")}
                        onClick={() => startEdit(semester)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <ConfirmModal
                        title={tr("semester.deleteTitle", { title: semester.title })}
                        description={tr("semester.deleteDesc")}
                        onConfirm={() => executeDelete({ id: semester.id })}
                        disabled={isDeleting}
                      >
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          title={tr("semester.delete")}
                          disabled={isDeleting}
                          className="hover:text-rose-600 hover:bg-rose-50"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                        </Button>
                      </ConfirmModal>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Thêm học kỳ mới */}
        <form onSubmit={onCreateSubmit} className="space-y-3 border-t border-neutral-100 pt-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-neutral-700">{tr("semester.codeHint")}</Label>
            <div className="flex flex-wrap gap-1.5">
              {suggestedCodes.map((code) => {
                const isExists = existingTitles.has(code);
                const isSelected = createForm.title === code;

                return (
                  <button
                    key={code}
                    type="button"
                    disabled={isExists}
                    onClick={() => applyHustCodeToCreateForm(code)}
                    className={cn(
                      "px-2 py-0.5 rounded-md text-xs font-mono font-medium border transition-all cursor-pointer flex items-center gap-1",
                      isExists
                        ? "bg-neutral-100 text-neutral-400 border-neutral-200 cursor-not-allowed opacity-60"
                        : isSelected
                          ? "bg-violet-600 text-white border-violet-600 shadow-xs"
                          : "bg-white text-neutral-700 border-neutral-200 hover:border-violet-300 hover:text-violet-700 hover:bg-violet-50/50",
                    )}
                  >
                    {code}
                    {isExists && <Check className="h-2.5 w-2.5 text-neutral-400" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-neutral-700">{tr("semester.codeField")}</Label>
              <span className="text-[11px] text-neutral-400">{tr("semester.autoDate")}</span>
            </div>
            <Input
              value={createForm.title}
              onChange={(e) => handleCreateTitleChange(e.target.value)}
              placeholder={tr("semester.codeExample")}
              className="h-8 text-sm font-mono"
            />
          </div>

          <div className="flex items-center gap-2">
            <div className="flex-1 space-y-1">
              <span className="text-[11px] text-neutral-500">{tr("semester.startDate")}</span>
              <Input
                type="date"
                value={createForm.startDate}
                onChange={(e) => setCreateForm((f) => ({ ...f, startDate: e.target.value }))}
                className="h-8 text-xs"
              />
            </div>
            <div className="flex-1 space-y-1">
              <span className="text-[11px] text-neutral-500">{tr("semester.endDate")}</span>
              <Input
                type="date"
                value={createForm.endDate}
                onChange={(e) => setCreateForm((f) => ({ ...f, endDate: e.target.value }))}
                className="h-8 text-xs"
              />
            </div>
          </div>

          {(createErrors?.title || createErrors?.startDate || createErrors?.endDate) && (
            <p className="text-xs text-rose-500">
              {createErrors?.title?.[0] || createErrors?.startDate?.[0] || createErrors?.endDate?.[0]}
            </p>
          )}

          <Button
            type="submit"
            variant="primary"
            size="sm"
            className="w-full h-8 font-medium gap-1.5 bg-violet-600 hover:bg-violet-700 text-white"
            disabled={isCreating}
          >
            {isCreating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            {tr("semester.add")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
