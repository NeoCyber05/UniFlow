"use client";

import type { ReactNode } from "react";
import { motion } from "motion/react";
import { scale, spring, useShouldReduceMotion, useTempoTransition } from "@animate-ui/react/utils/motion";

import { useCardModal } from "@/hooks/use-card-modal";

import type { CardInsight } from "../_types";

export const CardInsightButton = ({
  card,
  meta,
}: {
  card: CardInsight;
  meta?: ReactNode;
}) => {
  const cardModal = useCardModal();
  const reduce = useShouldReduceMotion();
  const pressSpring = useTempoTransition(spring.press);

  return (
    <motion.button
      type="button"
      onClick={() => cardModal.onOpen(card.id)}
      initial={{ transform: "scale(1)" }}
      whileTap={{ transform: reduce ? "scale(1)" : `scale(${scale.choice})` }}
      transition={pressSpring}
      className="group w-full rounded-xl border border-neutral-200/70 border-l-[3px] border-l-rose-400 bg-white p-3 text-left transition-[background-color,border-color,box-shadow] duration-200 hover:border-rose-200 hover:border-l-rose-500 hover:bg-rose-50/40 hover:shadow-xs"
    >
      <p className="line-clamp-2 text-sm font-semibold leading-snug text-neutral-800">
        {card.title}
      </p>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-500">
          {card.listTitle}
        </span>
        {meta}
      </div>
      {card.labels.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1">
          {card.labels.slice(0, 5).map((label) => (
            <span
              key={label.id}
              className="h-1.5 w-6 rounded-full"
              title={label.title}
              style={{ backgroundColor: label.color }}
            />
          ))}
        </div>
      )}
    </motion.button>
  );
};
