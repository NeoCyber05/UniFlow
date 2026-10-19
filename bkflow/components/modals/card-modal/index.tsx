"use client";

import { useEffect, useRef, useState } from "react";

import { useCardModal } from "@/hooks/use-card-modal";
import { usePathname } from "@/web/shims/next-navigation";
import { X } from "lucide-react";

import { CardRealtimeSync } from "./card-realtime-sync";
import { CardDetailBody } from "./card-detail-body";
import { runBeforeClose, type BeforeClose } from "./close-guard";

export const CardModal = () => {
  const storeId = useCardModal((state) => state.id);
  const isOpen = useCardModal((state) => state.isOpen);
  const onClose = useCardModal((state) => state.onClose);
  const pathname = usePathname();
  const previousPathname = useRef(pathname);
  const guardRef = useRef<BeforeClose | null>(null);
  // The card actually on screen; it only follows the store once unsaved edits are dealt with.
  const [shownId, setShownId] = useState<string | undefined>(undefined);
  const id = shownId ?? storeId;

  useEffect(() => {
    if (previousPathname.current !== pathname) {
      previousPathname.current = pathname;
      // Description blocks navigation until unsaved edits are handled.
      onClose();
    }
  }, [pathname, onClose]);

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

  if (!isOpen) return null;

  return (
    <>
      <CardRealtimeSync cardId={id} isOpen={isOpen} />
      <aside
        aria-label="Chi tiết việc"
        onKeyDown={(event) => {
          if (event.key === "Escape" && !event.defaultPrevented) requestClose();
        }}
        className="fixed right-0 top-14 bottom-0 z-40 flex w-full flex-col border-l border-border bg-background shadow-xl sm:w-[480px] xl:w-[560px]"
      >
        <div className="flex justify-end border-b border-neutral-100 px-3 py-2">
          <button type="button" onClick={requestClose} aria-label="Đóng" className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700">
            <X className="h-4 w-4" />
          </button>
        </div>
        {id ? <CardDetailBody key={id} cardId={id} layout="panel" onClose={onClose} beforeCloseRef={guardRef} /> : null}
      </aside>
    </>
  );
};
