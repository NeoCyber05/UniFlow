"use client";

import { useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, Loader2, Sparkles, Zap } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createCardDependency } from "@/actions/dependencies/create-card-dependency";
import { cn } from "@/lib/utils";
import type { BoardTimelineCard, BoardTimelineList } from "@/types";

type AutoChainDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  boardId: string;
  lists: BoardTimelineList[];
  onSuccess: () => void;
};

export const AutoChainDialog = ({
  isOpen,
  onClose,
  boardId,
  lists,
  onSuccess,
}: AutoChainDialogProps) => {
  // Find first list with at least 2 cards
  const defaultList = lists.find((l) => l.cards.length >= 2)?.id ?? (lists[0]?.id || "all");

  const [selectedListId, setSelectedListId] = useState<string>(defaultList);
  const [sortBy, setSortBy] = useState<"order" | "due_date" | "created_at">("order");
  const [skipCompleted, setSkipCompleted] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);

  // Filter & sort target cards
  const targetCards = useMemo(() => {
    let cards: BoardTimelineCard[] =
      selectedListId === "all"
        ? lists.flatMap((l) => l.cards)
        : (lists.find((l) => l.id === selectedListId)?.cards ?? []);

    if (skipCompleted) {
      cards = cards.filter((c) => !c.isCompleted);
    }

    return [...cards].sort((a, b) => {
      if (sortBy === "order") {
        return a.order - b.order;
      }
      if (sortBy === "due_date") {
        if (!a.dueDate && !b.dueDate) return a.order - b.order;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      }
      if (sortBy === "created_at") {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      return 0;
    });
  }, [lists, selectedListId, sortBy, skipCompleted]);

  // Compute sequence pairs
  const pairs = useMemo(() => {
    const result: Array<{
      blocker: BoardTimelineCard;
      blocked: BoardTimelineCard;
      alreadyConnected: boolean;
    }> = [];

    for (let i = 0; i < targetCards.length - 1; i++) {
      const blocker = targetCards[i];
      const blocked = targetCards[i + 1];
      const alreadyConnected = blocked.blockedByDependencies.some(
        (d) => d.cardId === blocker.id,
      );
      result.push({ blocker, blocked, alreadyConnected });
    }

    return result;
  }, [targetCards]);

  const pairsToCreate = useMemo(
    () => pairs.filter((p) => !p.alreadyConnected),
    [pairs],
  );

  const handleExecute = async () => {
    if (pairsToCreate.length === 0) {
      toast.info("Không có liên kết mới nào cần tạo trong chuỗi này.");
      return;
    }

    setIsSubmitting(true);
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < pairsToCreate.length; i++) {
      const pair = pairsToCreate[i];
      setProgress({ current: i + 1, total: pairsToCreate.length });

      try {
        const res = await createCardDependency({
          boardId,
          blockerCardId: pair.blocker.id,
          blockedCardId: pair.blocked.id,
        });

        if (res.data) {
          successCount++;
        } else {
          failCount++;
        }
      } catch {
        failCount++;
      }
    }

    setIsSubmitting(false);
    setProgress(null);

    if (successCount > 0) {
      toast.success(
        `Đã tạo thành công ${successCount} liên kết phụ thuộc tuần tự!${
          failCount > 0 ? ` (${failCount} lỗi hoặc vòng lặp bị bỏ qua)` : ""
        }`,
      );
      onSuccess();
      onClose();
    } else {
      toast.error("Không thể tạo liên kết chuỗi (có thể do xung đột vòng lặp).");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !isSubmitting && !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2 text-violet-600">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100">
              <Zap className="h-4 w-4" />
            </span>
            <DialogTitle className="text-base font-bold text-neutral-900">
              Nối chuỗi phụ thuộc tự động (Auto-Chain)
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-neutral-500">
            Tự động liên kết các công việc theo thứ tự tuần tự (Bước 1 ➔ Bước 2 ➔ Bước 3) mà không cần thao tác từng thẻ.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Controls: List Selection & Sort Mode */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-700">Chọn danh sách / Cột</label>
              <Select
                value={selectedListId}
                onValueChange={setSelectedListId}
                disabled={isSubmitting}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Chọn cột" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toàn bộ bảng (Tất cả cột)</SelectItem>
                  {lists.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.title} ({l.cards.length} thẻ)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-700">Tiêu chí sắp xếp chuỗi</label>
              <Select
                value={sortBy}
                onValueChange={(val) => setSortBy(val as "order" | "due_date" | "created_at")}
                disabled={isSubmitting}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Tiêu chí sắp xếp" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="order">Thứ tự trên bảng (Mặc định)</SelectItem>
                  <SelectItem value="due_date">Theo hạn chót (Deadline sớm trước)</SelectItem>
                  <SelectItem value="created_at">Theo ngày tạo (Cũ trước)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Options: Skip completed */}
          <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-neutral-600 select-none">
            <input
              type="checkbox"
              checked={skipCompleted}
              onChange={(e) => setSkipCompleted(e.target.checked)}
              disabled={isSubmitting}
              className="h-3.5 w-3.5 rounded border-neutral-300 text-violet-600 focus:ring-violet-500"
            />
            <span>Bỏ qua các công việc đã hoàn thành</span>
          </label>

          {/* Sequence Preview Box */}
          <div className="rounded-xl border border-neutral-200/80 bg-neutral-50/70 p-3 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-neutral-700">
              <div className="flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-violet-600" />
                <span>Xem trước chuỗi ({targetCards.length} thẻ)</span>
              </div>
              <span className="text-[11px] text-violet-700 bg-violet-100/80 px-2 py-0.5 rounded-full font-bold">
                {pairsToCreate.length} liên kết mới
              </span>
            </div>

            {targetCards.length < 2 ? (
              <p className="text-xs text-neutral-400 italic py-2 text-center">
                Cần tối thiểu 2 công việc để tạo chuỗi liên kết.
              </p>
            ) : (
              <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                {pairs.map((p, idx) => (
                  <div
                    key={`${p.blocker.id}-${p.blocked.id}`}
                    className="flex items-center justify-between gap-2 rounded-lg bg-white p-2 text-xs border border-neutral-100 shadow-2xs"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="text-[10px] font-bold text-neutral-400 w-4">
                        #{idx + 1}
                      </span>
                      <span className="truncate font-medium text-neutral-800" title={p.blocker.title}>
                        {p.blocker.title}
                      </span>
                      <ArrowRight className="h-3 w-3 shrink-0 text-violet-500" />
                      <span className="truncate font-medium text-neutral-800" title={p.blocked.title}>
                        {p.blocked.title}
                      </span>
                    </div>

                    <div className="shrink-0 text-[10px]">
                      {p.alreadyConnected ? (
                        <span className="inline-flex items-center gap-1 rounded bg-neutral-100 px-1.5 py-0.5 text-neutral-500 font-medium">
                          <CheckCircle2 className="h-2.5 w-2.5 text-emerald-600" />
                          Đã có
                        </span>
                      ) : (
                        <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-emerald-700 font-semibold border border-emerald-200">
                          Sẽ tạo
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Progress Indicator */}
          {progress && (
            <div className="space-y-1.5 animate-in fade-in">
              <div className="flex justify-between text-xs font-medium text-neutral-600">
                <span>Đang thiết lập liên kết...</span>
                <span>
                  {progress.current} / {progress.total}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-200">
                <div
                  className="h-full bg-violet-600 transition-all duration-200"
                  style={{
                    width: `${Math.round((progress.current / progress.total) * 100)}%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-xs"
          >
            Hủy
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleExecute}
            disabled={isSubmitting || pairsToCreate.length === 0}
            className={cn(
              "gap-1.5 text-xs bg-violet-600 hover:bg-violet-700 text-white shadow-xs",
            )}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Đang nối ({progress?.current}/{progress?.total})...</span>
              </>
            ) : (
              <>
                <Zap className="h-3.5 w-3.5" />
                <span>Nối {pairsToCreate.length} liên kết</span>
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
