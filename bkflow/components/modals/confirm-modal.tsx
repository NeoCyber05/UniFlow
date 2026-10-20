"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { tr } from "@/lib/i18n";

interface ConfirmModalProps {
  children: React.ReactNode;
  onConfirm: () => void;
  title?: string;
  description?: string;
  disabled?: boolean;
}

export const ConfirmModal = ({
  children,
  onConfirm,
  title = tr("common.confirmTitle"),
  description = tr("common.confirmDesc"),
  disabled,
}: ConfirmModalProps) => {
  const handleConfirm = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    onConfirm();
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="w-[calc(100vw-24px)] max-w-[400px] p-6 rounded-2xl border border-neutral-200 shadow-2xl bg-white">
        <DialogHeader className="space-y-2">
          <DialogTitle className="text-lg font-semibold text-neutral-900">
            {title}
          </DialogTitle>
          <DialogDescription className="text-sm text-neutral-500 leading-relaxed">
            {description}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 mt-6 justify-end">
          <DialogClose asChild>
            <Button
              variant="outline"
              disabled={disabled}
              className="w-full sm:w-auto h-9 rounded-xl border-neutral-200 text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900 cursor-pointer font-medium"
            >
              {tr("common.cancel")}
            </Button>
          </DialogClose>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={disabled}
            className="w-full sm:w-auto h-9 rounded-xl bg-red-600 hover:bg-red-700 text-white font-medium cursor-pointer"
          >
            {tr("common.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
