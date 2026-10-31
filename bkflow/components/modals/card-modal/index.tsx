"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ReducedMotionConfig, spring, transition, useTempoTransition } from "@animate-ui/react/utils/motion";

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

  const settle = useTempoTransition(spring.dialog);
  const fadeIn = useTempoTransition(transition.dialogFade);
  const dismiss = useTempoTransition(transition.dismiss);
  const overlay = useTempoTransition(transition.overlay);

  return (
    <>
      {isOpen && <CardRealtimeSync cardId={id} isOpen={isOpen} />}
      <ReducedMotionConfig>
        {/* Exiting nodes keep their last render, so the closing card stays filled. Only opacity/transform animate: no blur on this large surface. */}
        <AnimatePresence>
          {isOpen && (
            /* Not a Radix modal: the AI assistant (z-60) must stay usable while a card is open. */
            <motion.div
              key="overlay"
              aria-hidden="true"
              onClick={requestClose}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: overlay }}
              exit={{ opacity: 0, pointerEvents: "none", transition: overlay }}
              className="fixed inset-0 z-40 bg-neutral-950/45"
            />
          )}
          {isOpen && (
            <motion.div
              key="dialog"
              role="dialog"
              aria-label="Chi tiết việc"
              onKeyDown={(event) => {
                if (event.key === "Escape" && !event.defaultPrevented) requestClose();
              }}
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1, transition: { ...settle, opacity: fadeIn } }}
              exit={{ opacity: 0, scale: 0.97, pointerEvents: "none", transition: dismiss }}
              className="fixed inset-0 z-40 m-auto flex h-full w-full flex-col overflow-hidden bg-background shadow-2xl md:h-[min(780px,calc(100dvh-4rem))] md:w-[min(940px,calc(100vw-4rem))] md:rounded-2xl md:border md:border-border"
            >
              <div className="flex justify-end px-3 pt-3">
                <button type="button" onClick={requestClose} aria-label="Đóng" className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700">
                  <X className="h-4 w-4" />
                </button>
              </div>
              {id ? <CardDetailBody key={id} cardId={id} layout="dialog" onClose={onClose} beforeCloseRef={guardRef} /> : null}
            </motion.div>
          )}
        </AnimatePresence>
      </ReducedMotionConfig>
    </>
  );
};
