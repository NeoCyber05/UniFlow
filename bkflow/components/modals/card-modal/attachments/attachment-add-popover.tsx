"use client";

import { X } from "lucide-react";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { CardAttachment } from "@prisma/client";

import { createCardAttachment } from "@/actions/attachments/create-card-attachment";
import { createCardFileAttachments } from "@/actions/attachments/create-card-file-attachments";
import { FormInput } from "@/components/form/form-input";
import { FormSubmit } from "@/components/form/form-submit";
import { Button } from "@/components/ui/button";
import { useAction } from "@/hooks/use-action";
import {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { tr } from "@/lib/i18n";
import { UploadButton } from "@/lib/uploads/uploadthing";
import { patchBoardCardCount } from "../card-cache-utils";

interface AttachmentAddPopoverProps {
  cardId: string;
  boardId: string;
  children: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
}

export const AttachmentAddPopover = ({
  cardId,
  boardId,
  children,
  side = "bottom",
  align = "end",
}: AttachmentAddPopoverProps) => {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  const {
    execute: executeCreate,
    fieldErrors,
    isLoading: isCreating,
  } = useAction(createCardAttachment, {
    onSuccess: (attachment) => {
      queryClient.setQueryData(
        ["card", cardId],
        (current: unknown) => {
          if (!current || typeof current !== "object") {
            return current;
          }

          const currentCard = current as { attachments?: CardAttachment[] };

          return {
            ...currentCard,
            attachments: [
              attachment,
              ...(currentCard.attachments ?? []).filter((item) => item.id !== attachment.id),
            ],
          };
        },
      );
      patchBoardCardCount(boardId, cardId, "attachments", 1);
      queryClient.invalidateQueries({ queryKey: ["card", cardId] });
      toast.success(tr("attachment.linkAddedToast"), { id: "card-attachment-link" });
      setIsOpen(false);
    },
    onError: (error) => {
      toast.error(error, { id: "card-attachment-link" });
    },
  });

  const {
    execute: executeCreateFiles,
    isLoading: isSavingFile,
  } = useAction(createCardFileAttachments, {
    onSuccess: (attachments) => {
      queryClient.setQueryData(
        ["card", cardId],
        (current: unknown) => {
          if (!current || typeof current !== "object") {
            return current;
          }

          const currentCard = current as { attachments?: CardAttachment[] };

          return {
            ...currentCard,
            attachments: [
              ...attachments,
              ...(currentCard.attachments ?? []).filter(
                (item) => !attachments.some((attachment) => attachment.id === item.id),
              ),
            ],
          };
        },
      );
      patchBoardCardCount(boardId, cardId, "attachments", attachments.length);
      queryClient.invalidateQueries({ queryKey: ["card", cardId] });
      setUploadProgress(null);
      toast.success(tr("attachment.filesUploadedToast", { count: attachments.length }), { id: "card-attachment-upload" });
      setIsOpen(false);
    },
    onError: (error) => {
      setUploadProgress(null);
      toast.error(error, { id: "card-attachment-upload" });
    },
  });

  const onSubmit = (formData: FormData) => {
    if (isCreating) {
      return;
    }

    const url = formData.get("url") as string;
    const name = formData.get("name") as string;

    toast.loading(tr("attachment.addingLinkToast"), { id: "card-attachment-link" });
    executeCreate({
      cardId,
      boardId,
      url,
      name,
    });
  };

  const onOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      setUploadProgress(null);
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        {children}
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4" align={align} side={side} sideOffset={6}>
        <div className="flex items-center justify-between border-b pb-2 mb-3">
          <span className="text-sm font-semibold text-neutral-700 flex-1 text-center">
            {tr("attachment.popoverTitle")}
          </span>
          <PopoverClose asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={tr("cardModal.close")}
              className="h-6 w-6 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 cursor-pointer"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </PopoverClose>
        </div>

        {/* Section 1: Attach file */}
        <div className="space-y-1 mb-4">
          <p className="text-sm font-medium text-neutral-700">
            {tr("attachment.uploadFromComputer")}
          </p>
          <div className="pt-2">
            <UploadButton
              endpoint="cardAttachmentUploader"
              input={{ cardId, boardId }}
              disabled={isSavingFile}
              uploadProgressGranularity="coarse"
              onUploadBegin={() => {
                setUploadProgress(0);
              }}
              onUploadProgress={(progress) => {
                setUploadProgress(progress);
              }}
              onClientUploadComplete={(files) => {
                if (files.length === 0) {
                  setUploadProgress(null);
                  toast.error(tr("attachment.uploadNoInfoError"), { id: "card-attachment-upload" });
                  return;
                }

                executeCreateFiles({
                  cardId,
                  boardId,
                  files: files.map((file) => ({
                    name: file.name,
                    url: file.ufsUrl,
                    fileKey: file.key,
                    fileSize: file.size,
                    mimeType: file.type,
                  })),
                });
              }}
              onUploadError={(error) => {
                setUploadProgress(null);
                toast.error(error.message || tr("attachment.uploadFailedError"), { id: "card-attachment-upload" });
              }}
              content={{
                button({ ready, isUploading }) {
                  if (!ready) return tr("attachment.uploadPreparing");
                  return isUploading 
                    ? tr("attachment.uploading", { progress: uploadProgress !== null ? `${uploadProgress}%` : "" }).trim()
                    : tr("attachment.chooseFile");
                },
                allowedContent() {
                  return null;
                }
              }}
              appearance={{
                container: "w-full",
                button: "w-full h-9 rounded-lg border border-neutral-300 !bg-white !text-neutral-700 text-sm font-medium hover:bg-neutral-50 transition-colors focus-within:ring-0 focus-within:ring-offset-0 after:hidden before:hidden cursor-pointer",
                allowedContent: "hidden",
              }}
            />
          </div>
        </div>

        <div className="border-t my-3 border-neutral-200" />

        {/* Section 2: Add Link */}
        <form action={onSubmit} className="space-y-3">
          <div className="space-y-1">
            <label className="text-sm font-semibold text-neutral-700 flex items-center">
              {tr("attachment.pasteLinkLabel")} <span className="text-rose-500 ml-0.5">*</span>
            </label>
            <FormInput
              id="url"
              type="text"
              placeholder={tr("attachment.pasteLinkPlaceholder")}
              disabled={isCreating}
              errors={fieldErrors}
              className="h-9 rounded-lg bg-white border border-neutral-300"
            />
          </div>
          
          <div className="space-y-1">
            <label className="text-sm font-semibold text-neutral-700">
              {tr("attachment.displayTextOptional")}
            </label>
            <FormInput
              id="name"
              placeholder={tr("attachment.displayTextPlaceholder")}
              disabled={isCreating}
              errors={fieldErrors}
              className="h-9 rounded-lg bg-white border border-neutral-300"
            />
            <p className="text-[11px] text-neutral-500 leading-normal">
              {tr("attachment.displayTextHint")}
            </p>
          </div>

          <div className="flex justify-end gap-x-2 pt-1">
            <PopoverClose asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 rounded-lg px-3 text-xs text-neutral-500 cursor-pointer"
              >
                {tr("attachment.cancel")}
              </Button>
            </PopoverClose>
            <FormSubmit
              disabled={isCreating}
              className="h-8 rounded-lg px-4 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
            >
              {tr("attachment.add")}
            </FormSubmit>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
};
