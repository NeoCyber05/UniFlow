"use client";

import { useEffect, useRef, useState } from "react";

import { useCardModal } from "@/hooks/use-card-modal";
import { Dialog, DialogContent } from "@/components/ui/dialog";

import { CardRealtimeSync } from "./card-realtime-sync";
import { CardDetailBody } from "./card-detail-body";
import { runBeforeClose, type BeforeClose } from "./close-guard";

export const CardModal = () => {
  const storeId = useCardModal((state) => state.id);
  const isOpen = useCardModal((state) => state.isOpen);
  const onClose = useCardModal((state) => state.onClose);
  const guardRef = useRef<BeforeClose | null>(null);
  // The card actually on screen; it only follows the store once unsaved edits are dealt with.
  const [shownId, setShownId] = useState<string | undefined>(undefined);
  const id = shownId ?? storeId;

  useEffect(() => {
    if (!isOpen) {
      setShownId(undefined);
      return;
    }

    if (shownId === undefined || shownId === storeId) {
      setShownId(storeId);
      return;
    }

    let cancelled = false;

    void runBeforeClose(guardRef).then((ok) => {
      if (ok && !cancelled) {
        setShownId(storeId);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [isOpen, storeId, shownId]);

  const requestClose = () => {
    void runBeforeClose(guardRef).then((ok) => {
      if (ok) {
        onClose();
      }
    });
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          requestClose();
        }
      }}
    >
      <CardRealtimeSync cardId={id} isOpen={isOpen} />
      <DialogContent
        onOpenAutoFocus={(event) => event.preventDefault()}
        className="sm:max-w-5xl w-[calc(100%-2rem)] h-[min(760px,calc(100vh-4rem))] rounded-2xl p-0 overflow-hidden shadow-2xl border border-neutral-200 flex flex-col"
      >
        {id && isOpen ? (
          <CardDetailBody key={id} cardId={id} layout="dialog" onClose={onClose} beforeCloseRef={guardRef} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
};
