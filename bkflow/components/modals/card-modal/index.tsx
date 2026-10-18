"use client";

import { useCardModal } from "@/hooks/use-card-modal";
import { Dialog, DialogContent } from "@/components/ui/dialog";

import { CardRealtimeSync } from "./card-realtime-sync";
import { CardDetailBody } from "./card-detail-body";

export const CardModal = () => {
  const id = useCardModal((state) => state.id);
  const isOpen = useCardModal((state) => state.isOpen);
  const onClose = useCardModal((state) => state.onClose);

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <CardRealtimeSync cardId={id} isOpen={isOpen} />
      <DialogContent
        onOpenAutoFocus={(event) => event.preventDefault()}
        className="sm:max-w-5xl w-[calc(100%-2rem)] h-[min(760px,calc(100vh-4rem))] rounded-2xl p-0 overflow-hidden shadow-2xl border border-neutral-200 flex flex-col"
      >
        {id && isOpen ? (
          <CardDetailBody key={id} cardId={id} layout="dialog" onClose={onClose} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
};
