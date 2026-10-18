"use client";

import { useChat } from "@ai-sdk/react";
import { useQueryClient } from "@tanstack/react-query";
import { DefaultChatTransport } from "ai";
import {
  ArrowUp,
  Bot,
  GripHorizontal,
  Maximize2,
  Minimize2,
  Minus,
  Sparkles,
  Square,
  Trash2,
} from "lucide-react";
import { useRouter } from "@/web/shims/next-navigation";
import {
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

import { Hint } from "@/components/hint";
import { useCardModal } from "@/hooks/use-card-modal";
import type { BoardAssistantUIMessage } from "@/lib/ai/assistant/agent";
import { cn } from "@/lib/utils";
import { MY_TASKS_ROOT_KEY } from "@/lib/my-tasks/types";

import { AssistantMessage } from "./assistant-message";

/**
 * Danh sách câu hỏi gợi ý nhanh hiển thị khi cuộc trò chuyện chưa có tin nhắn nào.
 */
const SUGGESTIONS = [
  "Tạo lịch học 5h sáng mỗi ngày",
  "Tìm ghi chú về đồ án trong workspace",
  "Hôm nay có hạn nào từ công việc và ghi chú?",
  "Đánh dấu xong một bước trong checklist đồ án",
];

/**
 * Danh sách định danh công cụ làm biến đổi dữ liệu (mutations) phía server.
 * Dùng để phát hiện khi Agent thực thi xong công cụ nhằm tự động làm mới cache dữ liệu bảng.
 */
const MUTATION_TOOLS = new Set([
  "tool-updateChecklistItem",
  "tool-createDeadlineCard",
  "tool-createRecurringSchedule",
  "tool-batchCreateCards",
  "tool-createCardChecklist",
  "tool-moveCard",
  "tool-updateCardDeadline",
  "tool-updateCardDetails",
  "tool-archiveCard",
]);

/** Khoảng cách đệm an toàn từ mép cửa sổ chat tới viền màn hình (px) */
const EDGE_GAP = 16;

/** Tọa độ độ lệch (Offset) tính từ góc dưới bên phải viewport */
type Offset = { x: number; y: number };

/**
 * Giới hạn tọa độ di chuyển của cửa sổ chat để đảm bảo cửa sổ không bị kéo lệch ra ngoài màn hình.
 *
 * @param offset - Tọa độ dự kiến muốn đặt (tính từ góc dưới bên phải).
 * @param width - Chiều rộng hiện thời của panel chat (px).
 * @param height - Chiều cao hiện thời của panel chat (px).
 * @returns Tọa độ đã được giới hạn an toàn trong viewport.
 */
const clampOffset = (offset: Offset, width: number, height: number): Offset => {
  if (typeof window === "undefined") {
    return offset;
  }

  const maxX = Math.max(0, window.innerWidth - width - EDGE_GAP * 2);
  const maxY = Math.max(0, window.innerHeight - height - EDGE_GAP * 2);

  return {
    x: Math.min(Math.max(offset.x, 0), maxX),
    y: Math.min(Math.max(offset.y, 0), maxY),
  };
};

/**
 * Component Trợ lý AI Bảng làm việc (Board Assistant).
 *
 * @remarks
 * Tính năng chính:
 * 1. Nút bấm nổi Floating Action Button (FAB) ở góc màn hình.
 * 2. Cửa sổ chat có thể kéo thả di chuyển vị trí (Draggable Header) và mở rộng toàn màn hình (Expand).
 * 3. Tích hợp streaming thời gian thực với `useChat` và `DefaultChatTransport`.
 * 4. Tự động đồng bộ và nạp lịch sử trò chuyện được lưu trữ từ DB.
 * 5. Tự động làm mới cache React Query (`card`, `board-calendar`) khi Agent thực hiện tool làm đổi dữ liệu.
 *
 * @param props.boardId - Định danh bảng làm việc hiện tại.
 */
export const BoardAssistant = ({ boardId }: { boardId: string }) => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const openCardModal = useCardModal((state) => state.onOpen);

  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [input, setInput] = useState("");
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [enabled, setEnabled] = useState(true);
  // Offset measured from the bottom-right corner of the viewport.
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });

  const panelRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; origin: Offset } | null>(null);
  const handledToolCalls = useRef(new Set<string>());

  const timeZone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    [],
  );

  const transport = useMemo(
    () =>
      new DefaultChatTransport<BoardAssistantUIMessage>({
        api: "/api/ai/chat",
        // Server owns history: only send the newest message.
        prepareSendMessagesRequest: ({ messages }) => ({
          body: {
            boardId,
            timeZone,
            message: messages[messages.length - 1],
          },
        }),
      }),
    [boardId, timeZone],
  );

  const { messages, sendMessage, setMessages, status, stop, error, clearError } =
    useChat<BoardAssistantUIMessage>({
      id: `board-assistant-${boardId}`,
      transport,
      onError: (chatError) => {
        toast.error(chatError.message || "Trợ lý AI gặp sự cố.");
      },
    });

  const isBusy = status === "submitted" || status === "streaming";

  // Load persisted history the first time the panel opens.
  useEffect(() => {
    if (!isOpen || historyLoaded) {
      return;
    }

    let cancelled = false;

    fetch(`/api/ai/chat?boardId=${encodeURIComponent(boardId)}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { messages?: BoardAssistantUIMessage[]; enabled?: boolean } | null) => {
        if (cancelled || !payload) {
          return;
        }

        setEnabled(payload.enabled !== false);

        if (payload.messages && payload.messages.length > 0) {
          payload.messages.forEach((message) =>
            message.parts.forEach((part) => {
              if ("toolCallId" in part) {
                handledToolCalls.current.add(part.toolCallId);
              }
            }),
          );
          setMessages(payload.messages);
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) {
          setHistoryLoaded(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [boardId, historyLoaded, isOpen, setMessages]);

  // Refresh board data once a mutation tool finishes successfully.
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];

    if (!lastMessage || lastMessage.role !== "assistant") {
      return;
    }

    let shouldRefresh = false;

    lastMessage.parts.forEach((part) => {
      if (
        MUTATION_TOOLS.has(part.type) &&
        "toolCallId" in part &&
        part.state === "output-available" &&
        !handledToolCalls.current.has(part.toolCallId)
      ) {
        handledToolCalls.current.add(part.toolCallId);

        const output = part.output as {
          ok: boolean;
          card?: { id: string };
          cards?: { id: string }[];
        };

        if (output && output.ok) {
          shouldRefresh = true;
          if (output.card) {
            queryClient.invalidateQueries({ queryKey: ["card", output.card.id] });
            queryClient.invalidateQueries({ queryKey: ["card-logs", output.card.id] });
          }
          if (output.cards) {
            output.cards.forEach((c) => {
              queryClient.invalidateQueries({ queryKey: ["card", c.id] });
              queryClient.invalidateQueries({ queryKey: ["card-logs", c.id] });
            });
          }
        }
      }
    });

    if (shouldRefresh) {
      queryClient.invalidateQueries({ queryKey: ["board-calendar", boardId] });
      queryClient.invalidateQueries({ queryKey: MY_TASKS_ROOT_KEY });
      router.refresh();
    }
  }, [boardId, messages, queryClient, router]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  useEffect(() => {
    if (isOpen) {
      textareaRef.current?.focus();
    }
  }, [isOpen]);

  // Keep the panel on-screen when it resizes or the window shrinks.
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const keepInView = () => {
      const panel = panelRef.current;

      if (panel) {
        setOffset((current) => clampOffset(current, panel.offsetWidth, panel.offsetHeight));
      }
    };

    keepInView();
    window.addEventListener("resize", keepInView);

    return () => window.removeEventListener("resize", keepInView);
  }, [isExpanded, isOpen]);

  const submit = useCallback(
    (text: string) => {
      const value = text.trim();

      if (!value || isBusy || !enabled) {
        return;
      }

      clearError();
      sendMessage({ text: value });
      setInput("");
    },
    [clearError, enabled, isBusy, sendMessage],
  );

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit(input);
    }
  };

  const handleClear = async () => {
    if (isBusy) {
      stop();
    }

    const response = await fetch(`/api/ai/chat?boardId=${encodeURIComponent(boardId)}`, {
      method: "DELETE",
    }).catch(() => null);

    if (!response?.ok) {
      toast.error("Không xóa được lịch sử trò chuyện.");
      return;
    }

    handledToolCalls.current.clear();
    setMessages([]);
  };

  const handleOpenCard = useCallback(
    (cardId: string) => openCardModal(cardId),
    [openCardModal],
  );

  const handleDragStart = (event: ReactPointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("button")) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { startX: event.clientX, startY: event.clientY, origin: offset };
  };

  const handleDragMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const panel = panelRef.current;

    if (!drag || !panel) {
      return;
    }

    setOffset(
      clampOffset(
        {
          x: drag.origin.x - (event.clientX - drag.startX),
          y: drag.origin.y - (event.clientY - drag.startY),
        },
        panel.offsetWidth,
        panel.offsetHeight,
      ),
    );
  };

  const handleDragEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    dragRef.current = null;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const lastMessage = messages[messages.length - 1];
  const showThinking =
    status === "submitted" || (status === "streaming" && lastMessage?.role !== "assistant");

  if (!isOpen) {
    return (
      <Hint description="Trợ lý AI quản lý deadline" side="left" sideOffset={10}>
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          aria-label="Mở trợ lý AI"
          className="fixed bottom-5 right-5 z-50 flex size-12 items-center justify-center rounded-xl border border-violet-700 bg-violet-700 text-white shadow-sm transition-colors hover:bg-violet-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-500"
        >
          <Sparkles className="size-6" />
          {isBusy ? (
            <span className="absolute right-1 top-1 size-3 animate-pulse rounded-full bg-emerald-400 ring-2 ring-white" />
          ) : null}
        </button>
      </Hint>
    );
  }

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Trợ lý AI HustFlow"
      style={{ right: EDGE_GAP + offset.x, bottom: EDGE_GAP + offset.y }}
      className={cn(
        "fixed z-50 flex flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl",
        isExpanded
          ? "h-[min(780px,calc(100vh-32px))] w-[min(620px,calc(100vw-32px))]"
          : "h-[min(560px,calc(100vh-32px))] w-[min(390px,calc(100vw-32px))]",
      )}
    >
      <div
        onPointerDown={handleDragStart}
        onPointerMove={handleDragMove}
        onPointerUp={handleDragEnd}
        onPointerCancel={handleDragEnd}
        className="flex cursor-grab touch-none select-none items-center gap-2 bg-gradient-to-r from-violet-600 to-sky-500 px-3 py-2.5 text-white active:cursor-grabbing"
      >
        <div className="flex size-8 items-center justify-center rounded-full bg-white/20">
          <Bot className="size-4.5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-tight">Trợ lý UniFlow</p>
          <p className="text-[11px] leading-tight text-white/80">
            {isBusy ? "Đang xử lý…" : "Quản lý công việc & nhắc deadline"}
          </p>
        </div>
        <GripHorizontal className="size-4 text-white/60" />
        <button
          type="button"
          onClick={handleClear}
          disabled={messages.length === 0}
          aria-label="Xóa lịch sử trò chuyện"
          title="Xóa lịch sử trò chuyện"
          className="rounded-md p-1.5 hover:bg-white/20 disabled:opacity-40"
        >
          <Trash2 className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => setIsExpanded((value) => !value)}
          aria-label={isExpanded ? "Thu nhỏ khung chat" : "Mở rộng khung chat"}
          title={isExpanded ? "Thu nhỏ" : "Mở rộng"}
          className="rounded-md p-1.5 hover:bg-white/20"
        >
          {isExpanded ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
        </button>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          aria-label="Ẩn trợ lý"
          title="Ẩn"
          className="rounded-md p-1.5 hover:bg-white/20"
        >
          <Minus className="size-4" />
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-3 py-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-gradient-to-br from-violet-500/15 to-sky-500/15">
              <Sparkles className="size-6 text-violet-600" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold">Xin chào! Mình là trợ lý deadline của bạn.</p>
              <p className="px-4 text-xs text-muted-foreground">
                Hỏi về việc cần làm, tiến độ bảng, hoặc nhờ mình tạo / gia hạn deadline bằng
                ngôn ngữ tự nhiên.
              </p>
            </div>
            {!enabled ? (
              <p className="rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-700">
                Chưa cấu hình GEMINI_API_KEY trên máy chủ.
              </p>
            ) : null}
          </div>
        ) : (
          messages.map((message) => (
            <AssistantMessage key={message.id} message={message} onOpenCard={handleOpenCard} />
          ))
        )}

        {showThinking ? (
          <div className="flex items-center gap-2 pl-9 text-xs text-muted-foreground">
            <span className="flex gap-1">
              <span className="size-1.5 animate-bounce rounded-full bg-violet-500 [animation-delay:-0.3s]" />
              <span className="size-1.5 animate-bounce rounded-full bg-violet-500 [animation-delay:-0.15s]" />
              <span className="size-1.5 animate-bounce rounded-full bg-violet-500" />
            </span>
            Đang suy nghĩ…
          </div>
        ) : null}

        {error && !isBusy ? (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error.message || "Có lỗi xảy ra. Vui lòng thử lại."}
          </p>
        ) : null}
      </div>

      <div className="border-t bg-background p-3">
        {messages.length === 0 || (!isBusy && messages.length < 2) ? (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => submit(suggestion)}
                disabled={isBusy || !enabled}
                className="rounded-full border bg-muted/40 px-2.5 py-1 text-[11px] text-foreground/80 transition hover:border-violet-400 hover:bg-violet-500/10 disabled:opacity-50"
              >
                {suggestion}
              </button>
            ))}
          </div>
        ) : null}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            submit(input);
          }}
          className="flex items-end gap-2 rounded-xl border bg-muted/30 px-2 py-1.5 focus-within:border-violet-400 focus-within:ring-2 focus-within:ring-violet-400/20"
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            maxLength={2000}
            disabled={!enabled}
            placeholder={enabled ? "Hỏi về deadline hoặc nhờ tạo nhắc hẹn…" : "Trợ lý AI chưa được cấu hình"}
            className="max-h-32 min-h-[36px] flex-1 resize-none bg-transparent px-1 py-2 text-sm outline-none placeholder:text-muted-foreground [field-sizing:content]"
          />
          {isBusy ? (
            <button
              type="button"
              onClick={() => stop()}
              aria-label="Dừng"
              className="mb-1 flex size-8 shrink-0 items-center justify-center rounded-lg bg-foreground text-background"
            >
              <Square className="size-3.5 fill-current" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim() || !enabled}
              aria-label="Gửi"
              className="mb-1 flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-sky-500 text-white disabled:opacity-40"
            >
              <ArrowUp className="size-4" />
            </button>
          )}
        </form>
        <p className="mt-1.5 text-center text-[10px] text-muted-foreground">
          Trợ lý AI chỉ hỗ trợ quản lý công việc — không giải bài tập.
        </p>
      </div>
    </div>
  );
};
