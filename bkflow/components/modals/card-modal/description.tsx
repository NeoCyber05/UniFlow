"use client";

import { toast } from "sonner";
import {
  AlignLeft,
  Bold,
  ChevronDown,
  Eye,
  Italic,
  Link2,
  List,
  Pencil,
  RefreshCw,
  Sparkles,
  Type,
  Underline,
} from "lucide-react";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useOnClickOutside } from "usehooks-ts";
import { useBlocker } from "react-router";

import { useAction } from "@/hooks/use-action";
import { updateCard } from "@/actions/cards/update-card";
import { generateAiCardQuality } from "@/actions/ai/generate-ai-card-quality";
import { CardWithList } from "@/types";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Hint } from "@/components/hint";
import { cn } from "@/lib/utils";
import {
  createDescriptionSaveState,
  descriptionSaveReducer,
  type DescriptionSaveEvent,
  type DescriptionSaveState,
} from "@/lib/cards/description-save-state";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverDescription,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";

import { MY_TASKS_ROOT_KEY } from "@/lib/my-tasks/types";
import { patchBoardCardPreview, patchCardQueryData } from "./card-cache-utils";
import { MarkdownPreview } from "./markdown-preview";
import { DescriptionEditor } from "./description-editor";
import type { BeforeCloseRef } from "./close-guard";

interface DescriptionProps {
  data: CardWithList;
  canEdit?: boolean;
  /** Detail containers call this before closing or switching task. */
  beforeCloseRef: BeforeCloseRef;
}

type MarkdownToolbarAction = "bold" | "italic" | "underline" | "bullet" | "link";
type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;
type HeadingOption = HeadingLevel | "normal";
type PreviewMode = "edit" | "preview";

const AUTOSAVE_DELAY_MS = 800;
const DESCRIPTION_CONFLICT_ERROR_CODE = "DESCRIPTION_CONFLICT";
const DESCRIPTION_CONFLICT_MESSAGE =
  "Dữ liệu đã được cập nhật bởi một thành viên khác. Vui lòng reload thẻ để xem bản mới nhất.";

const toTimestampString = (value: Date | string | null | undefined) => {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);

  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const HEADING_OPTIONS: Array<{
  value: HeadingOption;
  label: string;
  previewClassName: string;
}> = [
  { value: "normal", label: "Văn bản bình thường", previewClassName: "text-sm font-normal" },
  { value: 1, label: "Heading 1", previewClassName: "text-2xl font-semibold" },
  { value: 2, label: "Heading 2", previewClassName: "text-xl font-semibold" },
  { value: 3, label: "Heading 3", previewClassName: "text-lg font-semibold" },
  { value: 4, label: "Heading 4", previewClassName: "text-base font-semibold" },
  { value: 5, label: "Heading 5", previewClassName: "text-sm font-semibold" },
  { value: 6, label: "Heading 6", previewClassName: "text-xs font-semibold text-neutral-500" },
];

const getSelectedLineRange = (value: string, selectionStart: number, selectionEnd: number) => {
  const normalizedEnd =
    selectionEnd > selectionStart && value[selectionEnd - 1] === "\n"
      ? selectionEnd - 1
      : selectionEnd;
  const lineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
  const lineEndIndex = value.indexOf("\n", normalizedEnd);
  const lineEnd = lineEndIndex === -1 ? value.length : lineEndIndex;

  return { lineStart, lineEnd };
};

const getLineStarts = (value: string, lineStart: number, lineEnd: number) => {
  const starts = [lineStart];

  for (let index = lineStart; index < lineEnd; index += 1) {
    if (value[index] === "\n" && index + 1 <= lineEnd) {
      starts.push(index + 1);
    }
  }

  return starts;
};

const transformSelectedLines = ({
  value,
  selectionStart,
  selectionEnd,
  transformLine,
  getSelectionAdjustment,
}: {
  value: string;
  selectionStart: number;
  selectionEnd: number;
  transformLine: (line: string) => string;
  getSelectionAdjustment: (lineStarts: number[]) => {
    startDelta: number;
    endDelta: number;
  };
}) => {
  const { lineStart, lineEnd } = getSelectedLineRange(value, selectionStart, selectionEnd);
  const lineStarts = getLineStarts(value, lineStart, lineEnd);
  const selectedLines = value.slice(lineStart, lineEnd).split("\n");
  const nextSelectedLines = selectedLines.map(transformLine);
  const nextValue = `${value.slice(0, lineStart)}${nextSelectedLines.join("\n")}${value.slice(lineEnd)}`;
  const { startDelta, endDelta } = getSelectionAdjustment(lineStarts);

  return {
    nextValue,
    nextSelectionStart: Math.max(lineStart, selectionStart + startDelta),
    nextSelectionEnd: Math.max(lineStart, selectionEnd + endDelta),
  };
};

const getOutdentSize = (line: string) => {
  if (line.startsWith("  ")) {
    return 2;
  }

  return line.startsWith(" ") ? 1 : 0;
};

const stripHeadingPrefix = (line: string) => line.replace(/^(\s*)#{1,6}\s+/, "$1");

export const Description = ({ data, canEdit = true, beforeCloseRef }: DescriptionProps) => {
  const queryClient = useQueryClient();

  const [isEditing, setIsEditing] = useState(false);
  const [isConflictOpen, setIsConflictOpen] = useState(false);
  const [save, setSave] = useState(() =>
    createDescriptionSaveState(data.description, toTimestampString(data.descriptionUpdatedAt)),
  );
  const [previewMode, setPreviewMode] = useState<PreviewMode>("edit");
  const [isSelectionAiBusy, setIsSelectionAiBusy] = useState(false);
  const [decision, setDecision] = useState<{ conflict: boolean } | null>(null);

  const formRef = useRef<HTMLFormElement>(null!);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Mirror of `save` that async code can read right after a dispatch.
  const saveRef = useRef<DescriptionSaveState>(save);
  const saveChainRef = useRef<Promise<boolean>>(Promise.resolve(true));
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const decisionRef = useRef<((choice: "stay" | "retry" | "discard") => void) | null>(null);
  const guardRef = useRef<Promise<boolean> | null>(null);

  const dispatch = (event: DescriptionSaveEvent) => {
    saveRef.current = descriptionSaveReducer(saveRef.current, event);
    setSave(saveRef.current);
  };
  const draftDescription = save.draft;
  const isDirty = save.draft !== save.base;

  const setDraftDescription = (value: string) => {
    dispatch({ type: "edit", value });

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      timerRef.current = null;

      if (saveRef.current.status !== "conflict") {
        void saveDraft();
      }
    }, AUTOSAVE_DELAY_MS);
  };

  // Server data (refetch, realtime) only replaces the text while nothing is unsaved.
  useEffect(() => {
    dispatch({
      type: "external",
      value: data.description ?? "",
      updatedAt: toTimestampString(data.descriptionUpdatedAt),
    });
  }, [data.description, data.descriptionUpdatedAt]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      decisionRef.current?.("stay");
    };
  }, []);

  /** Sends the current draft; requests run one at a time so a later one always uses the newest base. */
  const saveDraft = (): Promise<boolean> => {
    const run = async () => {
      const current = saveRef.current;

      if (current.draft === current.base) {
        return true;
      }

      dispatch({ type: "saveStart" });
      const seq = saveRef.current.saveSeq;
      const snapshot = saveRef.current.draft;

      if (!current.baseUpdatedAt) {
        dispatch({ type: "saveFailure", seq, conflict: false });
        toast.error("Không thể xác định mốc cập nhật nội dung. Hãy tải lại thẻ.");
        return false;
      }

      try {
        const result = await updateCard({
          id: data.id,
          description: snapshot,
          descriptionBaseUpdatedAt: current.baseUpdatedAt,
          boardId: data.list.boardId,
        });

        if (result?.data) {
          const updatedCard = result.data;
          const patch = {
            description: updatedCard.description,
            descriptionUpdatedAt: updatedCard.descriptionUpdatedAt,
            updatedAt: updatedCard.updatedAt,
          };

          dispatch({
            type: "saveSuccess",
            seq,
            snapshot,
            updatedAt: toTimestampString(updatedCard.descriptionUpdatedAt),
          });
          patchCardQueryData(queryClient, updatedCard.id, patch);
          patchBoardCardPreview(data.list.boardId, updatedCard.id, patch);
          void queryClient.invalidateQueries({ queryKey: MY_TASKS_ROOT_KEY });
          void queryClient.invalidateQueries({ queryKey: ["board-calendar", data.list.boardId] });
          return true;
        }

        const conflict = result?.errorCode === DESCRIPTION_CONFLICT_ERROR_CODE;

        dispatch({ type: "saveFailure", seq, conflict });

        if (conflict) {
          setIsConflictOpen(true);
        } else {
          toast.error(result?.error ?? "Không lưu được nội dung. Bản nháp vẫn được giữ.");
        }

        return false;
      } catch {
        dispatch({ type: "saveFailure", seq, conflict: false });
        toast.error("Mất kết nối khi lưu. Bản nháp vẫn được giữ.");
        return false;
      }
    };

    saveChainRef.current = saveChainRef.current.then(run);

    return saveChainRef.current;
  };

  const flush = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    return saveDraft();
  };

  const askUser = (conflict: boolean) =>
    new Promise<"stay" | "retry" | "discard">((resolve) => {
      decisionRef.current = (choice) => {
        decisionRef.current = null;
        setDecision(null);
        resolve(choice);
      };
      setDecision({ conflict });
    });

  const beforeClose = () => {
    guardRef.current ??= (async () => {
      try {
        for (;;) {
          if (await flush()) {
            return true;
          }

          const choice = await askUser(saveRef.current.status === "conflict");

          if (choice === "stay") {
            return false;
          }

          if (choice === "discard") {
            dispatch({ type: "discard" });
            setIsEditing(false);
            setIsConflictOpen(false);
            return true;
          }
        }
      } finally {
        guardRef.current = null;
      }
    })();

    return guardRef.current;
  };

  const beforeCloseLatest = useRef(beforeClose);
  useEffect(() => {
    beforeCloseLatest.current = beforeClose;
  });

  useEffect(() => {
    const ref = beforeCloseRef;
    const guard = () => beforeCloseLatest.current();

    ref.current = guard;

    return () => {
      if (ref.current === guard) {
        ref.current = null;
      }
    };
  }, [beforeCloseRef]);

  // Hard reload / tab close cannot await a save, so only warn.
  useEffect(() => {
    if (!isDirty) {
      return;
    }

    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", warn);

    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty]);

  // In-app navigation to another page (including browser back) goes through the same guard.
  const dirtyRef = useRef(false);
  useEffect(() => {
    dirtyRef.current = isDirty;
  }, [isDirty]);
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirtyRef.current && currentLocation.pathname !== nextLocation.pathname,
  );

  useEffect(() => {
    if (blocker.state !== "blocked") {
      return;
    }

    void beforeCloseLatest.current().then((ok) => {
      if (ok) {
        blocker.proceed();
      } else {
        blocker.reset();
      }
    });
  }, [blocker]);

  const enableEditing = () => {
    if (!canEdit) {
      return;
    }

    setIsConflictOpen(false);
    setPreviewMode("edit");
    setIsEditing(true);
    setTimeout(() => {
      textareaRef.current?.focus();
    });
  };

  /** Leaves edit mode only once the text is stored; on failure stay so nothing is lost. */
  const finishEditing = async () => {
    if (await flush()) {
      setIsEditing(false);
      setPreviewMode("edit");
    }
  };

  const discardDraft = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    dispatch({ type: "discard" });
    setIsConflictOpen(false);
    setIsEditing(false);
    setPreviewMode("edit");
  };

  const onFormKeyDown = (event: ReactKeyboardEvent<HTMLFormElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      void finishEditing();
    }
  };

  const updateTextareaSelection = (
    nextValue: string,
    nextSelectionStart: number,
    nextSelectionEnd = nextSelectionStart,
  ) => {
    setDraftDescription(nextValue);
    setTimeout(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(nextSelectionStart, nextSelectionEnd);
    }, 0);
  };

  const indentSelectedLines = () => {
    if (!textareaRef.current) {
      return;
    }

    const selectionStart = textareaRef.current.selectionStart;
    const selectionEnd = textareaRef.current.selectionEnd;

    if (selectionStart === selectionEnd) {
      updateTextareaSelection(
        `${draftDescription.slice(0, selectionStart)}  ${draftDescription.slice(selectionEnd)}`,
        selectionStart + 2,
      );
      return;
    }

    const result = transformSelectedLines({
      value: draftDescription,
      selectionStart,
      selectionEnd,
      transformLine: (line) => `  ${line}`,
      getSelectionAdjustment: (lineStarts) => ({
        startDelta: 2,
        endDelta: lineStarts.length * 2,
      }),
    });

    updateTextareaSelection(
      result.nextValue,
      result.nextSelectionStart,
      result.nextSelectionEnd,
    );
  };

  const outdentSelectedLines = () => {
    if (!textareaRef.current) {
      return;
    }

    const selectionStart = textareaRef.current.selectionStart;
    const selectionEnd = textareaRef.current.selectionEnd;
    const { lineStart, lineEnd } = getSelectedLineRange(
      draftDescription,
      selectionStart,
      selectionEnd,
    );
    const selectedLines = draftDescription.slice(lineStart, lineEnd).split("\n");
    const lineStarts = getLineStarts(draftDescription, lineStart, lineEnd);
    const removals = selectedLines.map(getOutdentSize);
    const nextSelectedLines = selectedLines.map((line, index) =>
      line.slice(removals[index]),
    );
    const nextValue = `${draftDescription.slice(0, lineStart)}${nextSelectedLines.join("\n")}${draftDescription.slice(lineEnd)}`;
    const startDelta = -removals
      .filter((_, index) => lineStarts[index] < selectionStart)
      .reduce<number>((total, removal) => total + removal, 0);
    const endDelta = -removals
      .filter((_, index) => lineStarts[index] < selectionEnd)
      .reduce<number>((total, removal) => total + removal, 0);
    const nextSelectionStart = Math.max(lineStart, selectionStart + startDelta);
    const nextSelectionEnd =
      selectionStart === selectionEnd
        ? nextSelectionStart
        : Math.max(lineStart, selectionEnd + endDelta);

    updateTextareaSelection(
      nextValue,
      nextSelectionStart,
      nextSelectionEnd,
    );
  };

  const applyLinePrefix = (prefix: string) => {
    if (!textareaRef.current) {
      return;
    }

    const selectionStart = textareaRef.current.selectionStart;
    const selectionEnd = textareaRef.current.selectionEnd;
    const result = transformSelectedLines({
      value: draftDescription,
      selectionStart,
      selectionEnd,
      transformLine: (line) => `${prefix}${line}`,
      getSelectionAdjustment: (lineStarts) => ({
        startDelta: prefix.length,
        endDelta: lineStarts.length * prefix.length,
      }),
    });

    updateTextareaSelection(
      result.nextValue,
      result.nextSelectionStart,
      result.nextSelectionEnd,
    );
  };

  const applyHeading = (heading: HeadingOption) => {
    if (!textareaRef.current) {
      return;
    }

    const selectionStart = textareaRef.current.selectionStart;
    const selectionEnd = textareaRef.current.selectionEnd;
    const { lineStart, lineEnd } = getSelectedLineRange(
      draftDescription,
      selectionStart,
      selectionEnd,
    );
    const selectedLines = draftDescription.slice(lineStart, lineEnd).split("\n");
    const lineStarts = getLineStarts(draftDescription, lineStart, lineEnd);
    const nextSelectedLines = selectedLines.map((line) => {
      const withoutHeading = stripHeadingPrefix(line);

      if (heading === "normal") {
        return withoutHeading;
      }

      const leadingWhitespace = withoutHeading.match(/^\s*/)?.[0] ?? "";
      const content = withoutHeading.slice(leadingWhitespace.length);

      return `${leadingWhitespace}${"#".repeat(heading)} ${content}`;
    });
    const diffs = nextSelectedLines.map(
      (line, index) => line.length - selectedLines[index].length,
    );
    const nextValue = `${draftDescription.slice(0, lineStart)}${nextSelectedLines.join("\n")}${draftDescription.slice(lineEnd)}`;
    const startDelta = diffs
      .filter((_, index) => lineStarts[index] <= selectionStart)
      .reduce((total, diff) => total + diff, 0);
    const endDelta = diffs
      .filter((_, index) => lineStarts[index] < selectionEnd)
      .reduce((total, diff) => total + diff, 0);
    const nextSelectionStart = Math.max(lineStart, selectionStart + startDelta);
    const nextSelectionEnd =
      selectionStart === selectionEnd
        ? nextSelectionStart
        : Math.max(lineStart, selectionEnd + endDelta);

    updateTextareaSelection(
      nextValue,
      nextSelectionStart,
      nextSelectionEnd,
    );
  };

  const insertMarkdown = (action: MarkdownToolbarAction) => {
    if (!textareaRef.current) {
      return;
    }

    const textarea = textareaRef.current;
    const selectionStart = textarea.selectionStart;
    const selectionEnd = textarea.selectionEnd;
    const selectedText = draftDescription.slice(selectionStart, selectionEnd);
    let nextValue = draftDescription;
    let nextSelectionStart = selectionStart;
    let nextSelectionEnd = selectionEnd;

    const replaceSelection = (replacement: string, cursorOffset = replacement.length) => {
      nextValue = `${draftDescription.slice(0, selectionStart)}${replacement}${draftDescription.slice(selectionEnd)}`;
      nextSelectionStart = selectionStart + cursorOffset;
      nextSelectionEnd = nextSelectionStart;
    };

    if (action === "bold") {
      const fallback = selectedText || "text";
      replaceSelection(`**${fallback}**`, 2 + fallback.length);

      if (selectedText) {
        nextSelectionStart = selectionStart + 2;
        nextSelectionEnd = selectionEnd + 2;
      }
    } else if (action === "italic") {
      const fallback = selectedText || "text";
      replaceSelection(`*${fallback}*`, 1 + fallback.length);

      if (selectedText) {
        nextSelectionStart = selectionStart + 1;
        nextSelectionEnd = selectionEnd + 1;
      }
    } else if (action === "underline") {
      const fallback = selectedText || "text";
      replaceSelection(`++${fallback}++`, 2 + fallback.length);

      if (selectedText) {
        nextSelectionStart = selectionStart + 2;
        nextSelectionEnd = selectionEnd + 2;
      }
    } else if (action === "link") {
      const fallback = selectedText || "link";
      replaceSelection(`[${fallback}](https://example.com)`, 1 + fallback.length);

      if (selectedText) {
        nextSelectionStart = selectionStart + 1;
        nextSelectionEnd = selectionEnd + 1;
      }
    } else if (action === "bullet") {
      applyLinePrefix("- ");
      return;
    }

    updateTextareaSelection(nextValue, nextSelectionStart, nextSelectionEnd);
  };

  useOnClickOutside(formRef, (event) => {
    const target = event.target as HTMLElement;

    if (
      target.closest(".description-conflict-popover") ||
      target.closest(".description-toolbar-popover") ||
      target.closest(".description-guard-dialog")
    ) {
      return;
    }

    void finishEditing();
  });

  const [activeAiTask, setActiveAiTask] = useState<"create_description" | "rewrite_description" | null>(null);

  const { execute: executeGenerateAi, isLoading: isGeneratingAi } = useAction(generateAiCardQuality, {
    onSuccess: (resData) => {
      if (resData.description) {
        if (!isEditing) {
          setIsConflictOpen(false);
          setPreviewMode("edit");
          setIsEditing(true);
        }
        
        setDraftDescription(resData.description);
        
        setTimeout(() => {
          textareaRef.current?.focus();
        });
        
        toast.success("Đã tạo mô tả bằng AI!");
      }
      setActiveAiTask(null);
    },
    onError: (error) => {
      toast.error(error);
      setActiveAiTask(null);
    },
  });

  const handleGenerateAi = (task: "create_description" | "rewrite_description") => {
    setActiveAiTask(task);
    executeGenerateAi({
      boardId: data.list.boardId,
      cardId: data.id,
      task,
    });
  };

  const reloadCard = async () => {
    discardDraft();
    await queryClient.invalidateQueries({ queryKey: ["card", data.id] });
  };

  const onSubmit = () => {
    if (!canEdit || isGeneratingAi || isSelectionAiBusy) {
      return;
    }

    void finishEditing();
  };

  const hasDescription = !!draftDescription.trim();
  const statusLabel = {
    saved: "Đã lưu",
    dirty: "Chưa lưu",
    saving: "Đang lưu…",
    error: "Lưu lỗi, bản nháp vẫn được giữ",
    conflict: "Nội dung đã đổi ở nơi khác",
  }[save.status];
  const toolbarItems: Array<{
    action: MarkdownToolbarAction;
    label: string;
    icon: ReactNode;
  }> = [
    { action: "bold", label: "In đậm", icon: <Bold className="h-3.5 w-3.5" /> },
    { action: "italic", label: "In nghiêng", icon: <Italic className="h-3.5 w-3.5" /> },
    { action: "underline", label: "Gạch chân", icon: <Underline className="h-3.5 w-3.5" /> },
    { action: "bullet", label: "Danh sách", icon: <List className="h-3.5 w-3.5" /> },
    { action: "link", label: "Liên kết", icon: <Link2 className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className="flex items-start gap-x-4 w-full">
      <div className="w-10 h-10 rounded-xl bg-neutral-100 flex items-center justify-center flex-shrink-0 mt-0.5">
        <AlignLeft className="h-5 w-5 text-neutral-500" />
      </div>
      <Popover open={isConflictOpen} onOpenChange={setIsConflictOpen}>
        <PopoverAnchor asChild>
          <div className="w-full min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2.5">
              <p className="font-semibold text-base text-neutral-800">
                Nội dung
              </p>
              {canEdit && (
                <div className="flex items-center gap-x-1.5 ml-1">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleGenerateAi("create_description")}
                    disabled={isGeneratingAi || isSelectionAiBusy}
                    className="h-7 rounded-lg border-sky-100 bg-sky-50/50 px-2 text-xs font-semibold text-sky-700 hover:bg-sky-100 hover:text-sky-800 transition-colors shadow-xs"
                  >
                    {isGeneratingAi && activeAiTask === "create_description" ? (
                      <RefreshCw className="mr-1 h-3 w-3 animate-spin" />
                    ) : (
                      <Sparkles className="mr-1 h-3 w-3 text-sky-500" />
                    )}
                    {isGeneratingAi && activeAiTask === "create_description" ? "Đang tạo..." : "Tạo mô tả từ tiêu đề"}
                  </Button>
                  {hasDescription && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleGenerateAi("rewrite_description")}
                      disabled={isGeneratingAi || isSelectionAiBusy}
                      className="h-7 rounded-lg border-sky-100 bg-sky-50/50 px-2 text-xs font-semibold text-sky-700 hover:bg-sky-100 hover:text-sky-800 transition-colors shadow-xs"
                    >
                      {isGeneratingAi && activeAiTask === "rewrite_description" ? (
                        <RefreshCw className="mr-1 h-3 w-3 animate-spin" />
                      ) : (
                        <Sparkles className="mr-1 h-3 w-3 text-sky-500" />
                      )}
                      {isGeneratingAi && activeAiTask === "rewrite_description" ? "Đang viết lại..." : "Viết lại mô tả"}
                    </Button>
                  )}
                </div>
              )}
            </div>
            {isEditing ? (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  onSubmit();
                }}
                onKeyDown={onFormKeyDown}
                ref={formRef}
                className="space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-neutral-200 bg-neutral-50 p-1.5">
                  <div className="flex items-center gap-1">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-7 rounded-lg px-2 text-neutral-600 hover:bg-white hover:text-neutral-900"
                        >
                          <Type className="h-3.5 w-3.5" />
                          <ChevronDown className="h-3 w-3" />
                          <span className="sr-only">Kiểu văn bản</span>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent
                        align="start"
                        side="bottom"
                        sideOffset={6}
                        className="description-toolbar-popover w-56 gap-0 p-1.5"
                      >
                        {HEADING_OPTIONS.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => applyHeading(option.value)}
                            className={cn(
                              "flex w-full items-center rounded-md px-3 py-2 text-left text-neutral-700 transition hover:bg-violet-50 hover:text-violet-700 disabled:opacity-50",
                              option.previewClassName,
                            )}
                          >
                            {option.label}
                          </button>
                        ))}
                      </PopoverContent>
                    </Popover>
                    <div className="mx-1 h-6 w-px bg-neutral-200" />
                    {toolbarItems.map((item) => (
                      <Hint key={item.action} description={item.label} side="top">
                        <Button
                          type="button"
                          size="icon-sm"
                          variant="ghost"
                          onClick={() => insertMarkdown(item.action)}
                          className="h-7 w-7 rounded-lg text-neutral-600 hover:bg-white hover:text-neutral-900"
                        >
                          {item.icon}
                          <span className="sr-only">{item.label}</span>
                        </Button>
                      </Hint>
                    ))}
                  </div>
                  <div className="flex items-center rounded-lg border border-neutral-200 bg-white p-0.5">
                    {(["edit", "preview"] as PreviewMode[]).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setPreviewMode(mode)}
                        className={cn(
                          "inline-flex h-7 items-center gap-1.5 rounded-md px-3 text-xs font-semibold transition disabled:opacity-50",
                          previewMode === mode
                            ? "bg-violet-600 text-white shadow-xs"
                            : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900",
                        )}
                      >
                        {mode === "edit" ? (
                          <Pencil className="h-3.5 w-3.5" />
                        ) : (
                          <Eye className="h-3.5 w-3.5" />
                        )}
                        {mode === "edit" ? "Viết" : "Xem trước"}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="w-full">
                    <div className="space-y-2" hidden={previewMode !== "edit"}>
                      <DescriptionEditor
                        id="description"
                        name="description"
                        textareaRef={textareaRef}
                        boardId={data.list.boardId}
                        cardId={data.id}
                        onBusyChange={setIsSelectionAiBusy}
                        value={draftDescription}
                        onValueChange={setDraftDescription}
                        onKeyDown={(event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
                          if (event.key === "Tab") {
                            event.preventDefault();
                            if (event.shiftKey) {
                              outdentSelectedLines();
                            } else {
                              indentSelectedLines();
                            }
                            return;
                          }

                          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                            event.preventDefault();
                            formRef.current?.requestSubmit();
                          }
                        }}
                        disabled={isGeneratingAi}
                        placeholder="Viết nội dung hoặc gõ / để chèn tiêu đề, danh sách…"
                        aria-describedby="description-error"
                        className="min-h-[260px] w-full resize-y rounded-xl border-neutral-200 bg-white px-4 py-3.5 text-base leading-relaxed shadow-sm focus-visible:border-violet-400 focus-visible:ring-1 focus-visible:ring-violet-200"
                      />
                    </div>
                  {previewMode === "preview" && (
                    <div className="min-h-[260px] rounded-xl border border-neutral-200 bg-white px-4 py-3.5 text-base leading-relaxed shadow-sm">
                      <MarkdownPreview
                        value={draftDescription}
                        emptyText="Xem trước mô tả sẽ hiển thị ở đây."
                      />
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <Button
                    type="submit"
                    disabled={isGeneratingAi || isSelectionAiBusy}
                    size="sm"
                    className="h-9 rounded-lg bg-violet-600 px-5 text-sm text-white hover:bg-violet-700"
                  >
                    {save.status === "error" || save.status === "conflict"
                      ? "Thử lại"
                      : save.status === "saved"
                        ? "Xong"
                        : "Lưu"}
                  </Button>
                  <Button
                    type="button"
                    onClick={discardDraft}
                    disabled={!isDirty}
                    size="sm"
                    variant="ghost"
                    className="h-9 text-sm text-neutral-500 rounded-lg px-4"
                  >
                    Bỏ thay đổi
                  </Button>
                  <p
                    role="status"
                    aria-live="polite"
                    className={cn(
                      "text-xs",
                      save.status === "error" || save.status === "conflict"
                        ? "text-red-600"
                        : "text-neutral-500",
                    )}
                  >
                    {statusLabel}
                  </p>
                </div>
                <p className="text-xs text-neutral-500">
                  Ghi chú bằng Markdown. Ô &quot;- [ ]&quot; ở đây chỉ là ghi chú; để theo dõi tiến độ, dùng mục Checklist bên dưới.
                </p>
              </form>
            ) : (
              <div
                onClick={enableEditing}
                role={canEdit ? "button" : undefined}
                tabIndex={canEdit ? 0 : undefined}
                onKeyDown={(event) => {
                  if (!canEdit) {
                    return;
                  }

                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    enableEditing();
                  }
                }}
                className={cn(
                  "min-h-[96px] rounded-xl px-4 py-3 text-base leading-relaxed transition-colors duration-150 md:text-base",
                  canEdit
                    ? "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-200"
                    : "cursor-default",
                  hasDescription
                    ? cn(
                      "border border-neutral-200 bg-neutral-50 text-neutral-700",
                      canEdit && "hover:bg-neutral-100",
                    )
                    : cn(
                      "border border-dashed border-neutral-200 bg-neutral-50 text-neutral-400",
                      canEdit && "hover:border-neutral-300 hover:bg-neutral-100",
                    ),
                )}
              >
                <MarkdownPreview
                  value={draftDescription}
                  emptyText={canEdit ? "Thêm nội dung" : "Chưa có nội dung."}
                />
              </div>
            )}
          </div>
        </PopoverAnchor>
        <PopoverContent align="start" side="bottom" className="w-80 description-conflict-popover">
          <PopoverDescription>{DESCRIPTION_CONFLICT_MESSAGE}</PopoverDescription>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={reloadCard}
            className="h-8 self-start rounded-lg text-xs font-semibold"
          >
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Reload thẻ
          </Button>
        </PopoverContent>
      </Popover>
      <Dialog
        open={decision !== null}
        onOpenChange={(open) => {
          if (!open) {
            decisionRef.current?.("stay");
          }
        }}
      >
        <DialogContent className="description-guard-dialog sm:max-w-md" showCloseButton={false}>
          <DialogTitle>Chưa lưu được nội dung</DialogTitle>
          <DialogDescription>
            {decision?.conflict
              ? "Nội dung đã được cập nhật ở nơi khác nên bản của bạn chưa thể ghi đè. Bạn có thể ở lại để sao chép bản nháp, hoặc bỏ thay đổi."
              : "Kết nối hoặc máy chủ đang lỗi. Bản nháp vẫn được giữ cho tới khi bạn chọn."}
          </DialogDescription>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => decisionRef.current?.("stay")}>
              Ở lại
            </Button>
            {!decision?.conflict && (
              <Button type="button" variant="outline" onClick={() => decisionRef.current?.("retry")}>
                Thử lại
              </Button>
            )}
            <Button type="button" variant="destructive" onClick={() => decisionRef.current?.("discard")}>
              Bỏ thay đổi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

Description.Skeleton = function DescriptionSkeleton() {
  return (
    <div className="flex items-start gap-x-4 w-full">
      <Skeleton className="h-10 w-10 rounded-xl bg-neutral-100" />
      <div className="w-full space-y-3">
        <Skeleton className="w-28 h-5 rounded bg-neutral-100" />
        <Skeleton className="w-full h-24 rounded-xl bg-neutral-100" />
      </div>
    </div>
  );
};
