"use client";

import { useEffect, useState } from "react";
import { useParams, usePathname, useRouter } from "@/web/shims/next-navigation";
import { LayoutPanelLeft, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const BoardSplitDropZone = () => {
  const router = useRouter();
  const params = useParams();
  const pathname = usePathname();
  const boardId = params.boardId as string;

  const [isDraggingTab, setIsDraggingTab] = useState(false);
  const [isOverDropZone, setIsOverDropZone] = useState(false);

  const splitHref = `/board/${boardId}/split`;
  const isAlreadySplit = pathname === splitHref;

  useEffect(() => {
    const handleDragStart = () => {
      if (!isAlreadySplit) {
        setIsDraggingTab(true);
      }
    };

    const handleDragEnd = () => {
      setIsDraggingTab(false);
      setIsOverDropZone(false);
    };

    window.addEventListener("bkflow-split-drag-start", handleDragStart);
    window.addEventListener("bkflow-split-drag-end", handleDragEnd);

    return () => {
      window.removeEventListener("bkflow-split-drag-start", handleDragStart);
      window.removeEventListener("bkflow-split-drag-end", handleDragEnd);
    };
  }, [isAlreadySplit]);

  if (!isDraggingTab || isAlreadySplit) {
    return null;
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    if (!isOverDropZone) setIsOverDropZone(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsOverDropZone(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingTab(false);
    setIsOverDropZone(false);

    toast.success("Đang chia đôi màn hình Bảng & Lịch...", {
      icon: <Sparkles className="h-4 w-4 text-violet-500" />,
    });
    router.push(splitHref);
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        "absolute inset-x-4 bottom-4 top-2 z-[99] flex flex-col items-center justify-center rounded-2xl border-2 border-dashed transition-all duration-200 pointer-events-auto",
        isOverDropZone
          ? "border-violet-500 bg-violet-600/20 backdrop-blur-md scale-[0.99] shadow-2xl"
          : "border-white/50 bg-black/40 backdrop-blur-xs",
      )}
    >
      <div className="flex flex-col items-center gap-3 rounded-2xl bg-white/95 px-8 py-6 text-center shadow-xl backdrop-blur-md">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-100 text-violet-600 shadow-xs animate-bounce">
          <LayoutPanelLeft className="h-7 w-7" />
        </div>
        <div>
          <h3 className="text-base font-bold text-neutral-800">
            Thả vào đây để chia đôi màn hình (Bảng & Lịch)
          </h3>
          <p className="mt-1 text-xs text-neutral-500">
            Xem và kéo thả trực tiếp công việc giữa chế độ Bảng và Lịch
          </p>
        </div>
      </div>
    </div>
  );
};
