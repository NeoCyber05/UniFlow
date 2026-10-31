"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { FieldErrors } from "@/lib/create-safe-action";
import { tr } from "@/lib/i18n";

import type { BoardCalendarList } from "../../_types";

type CreateCardInput = {
  title: string;
  boardId: string;
  listId: string;
  startDate?: Date | null;
  dueDate?: Date | null;
};

type CreateCardDialogProps = {
  open: boolean;
  selectedDayLabel: string;
  title: string;
  startValue: string;
  dueValue: string;
  listId: string;
  lists: BoardCalendarList[];
  fieldErrors?: FieldErrors<CreateCardInput>;
  isLoading: boolean;
  onOpenChange: (open: boolean) => void;
  onTitleChange: (value: string) => void;
  onStartValueChange: (value: string) => void;
  onDueValueChange: (value: string) => void;
  onListIdChange: (value: string) => void;
  onSubmit: () => void;
};

export const CreateCardDialog = ({
  open,
  selectedDayLabel,
  title,
  startValue,
  dueValue,
  listId,
  lists,
  fieldErrors,
  isLoading,
  onOpenChange,
  onTitleChange,
  onStartValueChange,
  onDueValueChange,
  onListIdChange,
  onSubmit,
}: CreateCardDialogProps) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>{tr("calendar.createDialog.title", { day: selectedDayLabel })}</DialogTitle>
        <DialogDescription>
          {tr("calendar.createDialog.desc")}
        </DialogDescription>
      </DialogHeader>

      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <div className="space-y-1.5">
          <label htmlFor="calendar-card-title" className="text-xs font-semibold text-neutral-600">
            {tr("calendar.createDialog.titleLabel")}
          </label>
          <input
            id="calendar-card-title"
            value={title}
            onChange={(event) => onTitleChange(event.target.value)}
            disabled={isLoading}
            autoFocus
            placeholder={tr("calendar.createDialog.titlePlaceholder")}
            className="h-9 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-800 shadow-sm outline-none transition placeholder:text-neutral-400 focus:border-violet-400 focus:ring-1 focus:ring-violet-200 disabled:cursor-not-allowed disabled:bg-neutral-50"
          />
          {fieldErrors?.title?.[0] && (
            <p className="text-xs text-red-600">{fieldErrors.title[0]}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="calendar-card-list" className="text-xs font-semibold text-neutral-600">
            {tr("calendar.createDialog.listLabel")}
          </label>
          <select
            id="calendar-card-list"
            value={listId}
            onChange={(event) => onListIdChange(event.target.value)}
            disabled={isLoading || lists.length === 0}
            className="h-9 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-800 shadow-sm outline-none transition focus:border-violet-400 focus:ring-1 focus:ring-violet-200 disabled:cursor-not-allowed disabled:bg-neutral-50"
          >
            {lists.length === 0 ? (
              <option value="">{tr("calendar.cell.createListFirst")}</option>
            ) : (
              lists.map((list) => (
                <option key={list.id} value={list.id}>
                  {list.title}
                </option>
              ))
            )}
          </select>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="calendar-card-start" className="text-xs font-semibold text-neutral-600">
            {tr("calendar.createDialog.startOptional")}
          </label>
          <input
            id="calendar-card-start"
            type="datetime-local"
            step={60}
            value={startValue}
            onChange={(event) => onStartValueChange(event.target.value)}
            disabled={isLoading}
            className="h-9 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-800 shadow-sm outline-none transition focus:border-violet-400 focus:ring-1 focus:ring-violet-200 disabled:cursor-not-allowed disabled:bg-neutral-50"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="calendar-card-due" className="text-xs font-semibold text-neutral-600">
            {tr("calendar.createDialog.endOptional")}
          </label>
          <input
            id="calendar-card-due"
            type="datetime-local"
            step={60}
            value={dueValue}
            onChange={(event) => onDueValueChange(event.target.value)}
            disabled={isLoading}
            className="h-9 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-800 shadow-sm outline-none transition focus:border-violet-400 focus:ring-1 focus:ring-violet-200 disabled:cursor-not-allowed disabled:bg-neutral-50"
          />
        </div>

        <DialogFooter className="mt-2">
          <Button
            type="button"
            variant="outline"
            disabled={isLoading}
            onClick={() => onOpenChange(false)}
          >
            {tr("calendar.common.cancel")}
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={isLoading || lists.length === 0}
          >
            {tr("calendar.createDialog.submit")}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
);
