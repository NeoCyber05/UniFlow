"use client";

import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Clock, ListChecks, Loader2, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { analyzeCaptureImage } from "@/actions/ai/analyze-capture-image";
import { importImageItems } from "@/actions/cards/import-image-items";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  parseWeeks,
  WEEKDAY_LABELS,
  type ImageAnalysis,
  type ImageTaskItem,
  type TimetableSession,
} from "@/lib/capture/image-import";
import { cn } from "@/lib/utils";

const MAX_SIDE = 1600;

/** Thu ảnh về ≤1600px JPEG: đủ nét cho OCR, nhỏ cho request. */
const compressImage = async (file: Blob) => {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext("2d")!;
  context.fillStyle = "#fff"; // PNG trong suốt → nền trắng, không đen
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.85);
};

type Row<T> = T & { key: string; checked: boolean };
const withKeys = <T,>(values: T[]): Row<T>[] => values.map((value, index) => ({ ...value, key: String(index), checked: true }));

const cell = "w-full rounded border border-transparent bg-transparent px-1.5 py-1 text-xs outline-none hover:border-neutral-200 focus:border-violet-300 focus:bg-white";

export const ImageImportDialog = ({
  boardId,
  file,
  onClose,
}: {
  boardId: string;
  /** Ảnh vừa dán/chọn. Caller chỉ mount khi có ảnh nên mỗi ảnh là một lần đọc mới. */
  file: Blob;
  onClose: () => void;
}) => {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<"reading" | "review" | "saving" | "error">("reading");
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [type, setType] = useState<ImageAnalysis["type"]>("tasks");
  const [sessions, setSessions] = useState<Row<TimetableSession>[]>([]);
  const [items, setItems] = useState<Row<ImageTaskItem>[]>([]);
  const [week1Start, setWeek1Start] = useState("");

  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    void (async () => {
      try {
        const image = await compressImage(file);
        if (cancelled) return;
        setPreview(image);
        const result = await analyzeCaptureImage({ boardId, image });
        if (cancelled) return;
        if (!result.data) throw new Error(result.error ?? "AI chưa đọc được ảnh.");
        const { analysis } = result.data;
        setType(analysis.type);
        setSessions(analysis.type === "timetable" ? withKeys(analysis.sessions) : []);
        setItems(analysis.type === "tasks" ? withKeys(analysis.items) : []);
        setWeek1Start(result.data.week1Start ?? "");
        setStatus("review");
      } catch (caught) {
        if (cancelled) return;
        setError(caught instanceof Error ? caught.message : "AI chưa đọc được ảnh.");
        setStatus("error");
      }
    })();
    return () => { cancelled = true; };
  }, [file, boardId]);

  const chosenSessions = sessions.filter((row) => row.checked);
  const chosenItems = items.filter((row) => row.checked);
  const sessionCount = useMemo(
    () => chosenSessions.reduce((sum, row) => sum + parseWeeks(row.weeks).length, 0),
    [chosenSessions],
  );
  const total = type === "timetable" ? sessionCount : chosenItems.length;

  const patchSession = (key: string, patch: Partial<Row<TimetableSession>>) =>
    setSessions((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  const patchItem = (key: string, patch: Partial<Row<ImageTaskItem>>) =>
    setItems((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  const submit = async () => {
    setStatus("saving");
    // key/checked thừa: zod ở server tự bỏ field lạ
    const result = await importImageItems(type === "timetable"
      ? { boardId, week1Start, sessions: chosenSessions }
      : { boardId, items: chosenItems });

    if (!result.data) {
      const fieldError = result.fieldErrors ? Object.values(result.fieldErrors).flat().find(Boolean) : undefined;
      toast.error(result.error ?? (fieldError as string | undefined) ?? "Tạo thất bại.");
      setStatus("review");
      return;
    }

    const { created, total: all } = result.data;
    toast.success(created === all ? `Đã tạo ${created} mục.` : `Đã tạo ${created} mục mới, ${all - created} mục đã có từ trước.`);
    // Nhập hàng loạt chạm nhiều view (list, lịch, môn): làm mới toàn bộ
    await queryClient.invalidateQueries();
    onClose();
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open && status !== "saving") onClose(); }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-violet-500" aria-hidden="true" />
            {type === "timetable" && status !== "reading" ? "Thời khoá biểu từ ảnh" : "Tạo việc từ ảnh"}
          </DialogTitle>
          <DialogDescription>AI có thể đọc sai — kiểm tra và sửa trước khi tạo.</DialogDescription>
        </DialogHeader>

        {status === "reading" && (
          <div className="flex flex-col items-center gap-3 py-10 text-sm text-neutral-500" role="status">
            {preview && <img src={preview} alt="" className="max-h-40 rounded-md border border-neutral-200 object-contain opacity-60" />}
            <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />AI đang đọc ảnh…</span>
          </div>
        )}

        {status === "error" && <p role="alert" className="rounded-lg bg-rose-50 p-4 text-sm text-rose-700">{error}</p>}

        {(status === "review" || status === "saving") && type === "timetable" && (
          <div className="space-y-3">
            <label className="flex flex-wrap items-center gap-2 text-xs text-neutral-600">
              <span className="font-medium">Tuần 1 bắt đầu (Thứ Hai)</span>
              <input type="date" value={week1Start} onChange={(event) => setWeek1Start(event.target.value)} className="rounded-md border border-neutral-200 px-2 py-1 text-xs" />
              {!week1Start && <span className="text-amber-700">Bảng chưa gắn học kỳ — chọn ngày để tính lịch.</span>}
            </label>
            <div className="overflow-x-auto rounded-lg border border-neutral-200">
              <table className="w-full min-w-[720px] text-left text-xs">
                <thead className="bg-neutral-50 text-[11px] text-neutral-500">
                  <tr>
                    <th className="w-8 p-2" aria-label="Chọn" /><th className="p-2">Mã</th><th className="p-2">Tên môn</th><th className="p-2">Thứ</th>
                    <th className="p-2">Giờ</th><th className="p-2">Phòng</th><th className="p-2">Tuần học</th><th className="w-8 p-2" aria-label="Xoá" />
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((row) => (
                    <tr key={row.key} className={cn("border-t border-neutral-100", !row.checked && "opacity-40")}>
                      <td className="p-2"><input type="checkbox" checked={row.checked} onChange={(event) => patchSession(row.key, { checked: event.target.checked })} aria-label={`Chọn ${row.name}`} /></td>
                      <td className="w-24"><input value={row.code ?? ""} onChange={(event) => patchSession(row.key, { code: event.target.value || null })} className={cn(cell, "font-mono")} aria-label="Mã học phần" /></td>
                      <td><input value={row.name} onChange={(event) => patchSession(row.key, { name: event.target.value })} className={cell} aria-label="Tên môn" /></td>
                      <td className="w-16">
                        <select value={row.weekday} onChange={(event) => patchSession(row.key, { weekday: Number(event.target.value) })} className={cell} aria-label="Thứ">
                          {WEEKDAY_LABELS.slice(1).map((label, index) => <option key={label} value={index + 1}>{label}</option>)}
                        </select>
                      </td>
                      <td className="w-36 whitespace-nowrap">
                        <input type="time" value={row.start} onChange={(event) => patchSession(row.key, { start: event.target.value })} className={cn(cell, "inline w-16")} aria-label="Giờ bắt đầu" />–
                        <input type="time" value={row.end} onChange={(event) => patchSession(row.key, { end: event.target.value })} className={cn(cell, "inline w-16")} aria-label="Giờ kết thúc" />
                      </td>
                      <td className="w-20"><input value={row.room ?? ""} onChange={(event) => patchSession(row.key, { room: event.target.value || null })} className={cell} aria-label="Phòng" /></td>
                      <td className="w-28">
                        <input value={row.weeks} onChange={(event) => patchSession(row.key, { weeks: event.target.value })} className={cn(cell, parseWeeks(row.weeks).length === 0 && "border-rose-300")} aria-label="Tuần học" />
                      </td>
                      <td><button type="button" onClick={() => setSessions((rows) => rows.filter((item) => item.key !== row.key))} className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-rose-600" aria-label={`Xoá ${row.name}`}><Trash2 className="h-3.5 w-3.5" /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-neutral-500">Buổi học tạo thành <strong>sự kiện</strong> (không có checkbox) trong cột “Lịch học”, gắn môn theo mã.</p>
          </div>
        )}

        {(status === "review" || status === "saving") && type === "tasks" && (
          items.length === 0
            ? <p className="py-8 text-center text-sm text-neutral-500">Không thấy việc nào trong ảnh.</p>
            : (
              <ul className="space-y-1.5">
                {items.map((row) => (
                  <li key={row.key} className={cn("flex flex-wrap items-center gap-2 rounded-lg border border-neutral-200 p-2", !row.checked && "opacity-40")}>
                    <input type="checkbox" checked={row.checked} onChange={(event) => patchItem(row.key, { checked: event.target.checked })} aria-label={`Chọn ${row.title}`} />
                    <button
                      type="button"
                      onClick={() => patchItem(row.key, { kind: row.kind === "TASK" ? "EVENT" : "TASK" })}
                      className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1", row.kind === "EVENT" ? "bg-sky-50 text-sky-700 ring-sky-200" : "bg-violet-50 text-violet-700 ring-violet-200")}
                      title="Đổi Việc/Sự kiện"
                    >
                      {row.kind === "EVENT" ? <Clock className="h-3 w-3" /> : <ListChecks className="h-3 w-3" />}
                      {row.kind === "EVENT" ? "Sự kiện" : "Việc"}
                    </button>
                    <input value={row.title} onChange={(event) => patchItem(row.key, { title: event.target.value })} className={cn(cell, "min-w-48 flex-1 text-sm")} aria-label="Tiêu đề" />
                    <input type="date" value={row.date ?? ""} onChange={(event) => patchItem(row.key, { date: event.target.value || null })} className={cn(cell, "w-32")} aria-label="Ngày" />
                    <input type="time" value={row.start ?? ""} onChange={(event) => patchItem(row.key, { start: event.target.value || null })} className={cn(cell, "w-20")} aria-label={row.kind === "EVENT" ? "Giờ bắt đầu" : "Giờ hạn"} />
                    {row.kind === "EVENT" && <input type="time" value={row.end ?? ""} onChange={(event) => patchItem(row.key, { end: event.target.value || null })} className={cn(cell, "w-20")} aria-label="Giờ kết thúc" />}
                    {row.courseCode && <span className="font-mono text-[11px] text-neutral-500">{row.courseCode}</span>}
                  </li>
                ))}
              </ul>
            )
        )}

        {(status === "review" || status === "saving") && (
          <div className="flex items-center justify-end gap-2 border-t border-neutral-100 pt-3">
            <button type="button" onClick={onClose} disabled={status === "saving"} className="rounded-lg px-3 py-1.5 text-sm font-medium text-neutral-600 hover:bg-neutral-100">Huỷ</button>
            <button
              type="button"
              onClick={() => void submit()}
              disabled={status === "saving" || total === 0 || (type === "timetable" && !week1Start)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
            >
              {status === "saving" && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
              {type === "timetable" ? `Tạo ${total} buổi học` : `Tạo ${total} mục`}
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
