"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getScheduleFormIntent, type ScheduleIntent } from "@/lib/calendar/schedule-command";

export type ScheduleDialogState = {
  cardId: string;
  cardTitle: string;
  /** "plan": chọn ngày/giờ làm; "needs-end": đã có giờ bắt đầu, hỏi giờ kết thúc. */
  mode: "plan" | "needs-end";
  /** YYYY-MM-DD theo giờ VN */
  day: string;
  /** HH:mm theo giờ VN, rỗng nếu chưa có */
  start: string;
  end: string;
  endDay: string;
  hasSchedule: boolean;
};

type ScheduleDialogProps = {
  state: ScheduleDialogState | null;
  isLoading: boolean;
  saveError?: string | null;
  onClose: () => void;
  onSubmit: (cardId: string, intent: ScheduleIntent) => void;
};

const inputClass =
  "h-9 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-800 shadow-sm outline-none transition focus:border-violet-400 focus:ring-1 focus:ring-violet-200 disabled:cursor-not-allowed disabled:bg-neutral-50";


export const ScheduleDialog = ({ state, isLoading, saveError, onClose, onSubmit }: ScheduleDialogProps) => (
  <Dialog open={!!state} onOpenChange={(open) => !open && !isLoading && onClose()}>
    <DialogContent className="max-w-md">
      {/* key: dựng lại form theo thẻ/chế độ để giá trị khởi tạo luôn khớp */}
      {state && <ScheduleForm key={`${state.cardId}:${state.mode}:${state.day}:${state.start}`} state={state} saveError={saveError} isLoading={isLoading} onClose={onClose} onSubmit={onSubmit} />}
    </DialogContent>
  </Dialog>
);

const ScheduleForm = ({
  state,
  isLoading,
  saveError,
  onClose,
  onSubmit,
}: {
  state: ScheduleDialogState;
  isLoading: boolean;
  saveError?: string | null;
  onClose: () => void;
  onSubmit: (cardId: string, intent: ScheduleIntent) => void;
}) => {
  const [day, setDay] = useState(state.day);
  const [start, setStart] = useState(state.start);
  const [end, setEnd] = useState(state.end);
  const [endDay, setEndDay] = useState(state.endDay);
  const [error, setError] = useState<string | null>(null);
  const needsEnd = state.mode === "needs-end";

  const submit = () => {
    const intent = getScheduleFormIntent({ day, endDay, start, end });
    if ("error" in intent) { setError(intent.error); return; }
    if (needsEnd && intent.type !== "time") { setError("Vui lòng chọn thời điểm kết thúc."); return; }
    onSubmit(state.cardId, intent);
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{needsEnd ? "Chọn giờ kết thúc" : "Xếp lịch làm"}</DialogTitle>
        <DialogDescription>
          {needsEnd
            ? `“${state.cardTitle}” chưa có thời lượng. Giờ theo GMT+7; hạn nộp không thay đổi.`
            : `Chọn ngày hoặc khoảng giờ làm cho “${state.cardTitle}”. Giờ theo GMT+7; hạn nộp không thay đổi.`}
        </DialogDescription>
      </DialogHeader>

      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <div className="space-y-1.5">
          <label htmlFor="schedule-day" className="text-xs font-semibold text-neutral-600">Ngày làm</label>
          <input
            id="schedule-day"
            type="date"
            value={day}
            onChange={(event) => {
              const next = event.target.value;
              if (endDay === day) setEndDay(next);
              setDay(next);
            }}
            disabled={isLoading || needsEnd}
            className={inputClass}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="schedule-end-day" className="text-xs font-semibold text-neutral-600">Ngày kết thúc (khi chọn giờ)</label>
          <input id="schedule-end-day" type="date" value={endDay} min={day} onChange={(event) => setEndDay(event.target.value)} disabled={isLoading} className={inputClass} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label htmlFor="schedule-start" className="text-xs font-semibold text-neutral-600">Giờ bắt đầu</label>
            <input
              id="schedule-start"
              type="time"
              value={start}
              onChange={(event) => setStart(event.target.value)}
              disabled={isLoading || needsEnd}
              className={inputClass}
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="schedule-end" className="text-xs font-semibold text-neutral-600">Giờ kết thúc</label>
            <input
              id="schedule-end"
              type="time"
              value={end}
              onChange={(event) => setEnd(event.target.value)}
              disabled={isLoading}
              autoFocus={needsEnd}
              className={inputClass}
            />
          </div>
        </div>
        {(error || saveError) && <p role="alert" className="text-xs text-red-600">{error || saveError}</p>}

        <DialogFooter className="mt-2 gap-2 sm:justify-between">
          {state.hasSchedule && !needsEnd ? (
            <Button
              type="button"
              variant="outline"
              disabled={isLoading}
              onClick={() => onSubmit(state.cardId, { type: "clear" })}
            >
              Bỏ lịch làm
            </Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button type="button" variant="outline" disabled={isLoading} onClick={onClose}>Hủy</Button>
            <Button type="submit" variant="primary" disabled={isLoading}>Lưu lịch</Button>
          </div>
        </DialogFooter>
      </form>
    </>
  );
};
