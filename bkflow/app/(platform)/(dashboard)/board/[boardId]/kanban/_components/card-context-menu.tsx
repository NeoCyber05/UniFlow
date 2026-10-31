"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { ReducedMotionConfig, scale, transition, useTempoTransition } from "@animate-ui/react/utils/motion";
import { Archive, Copy, ExternalLink, Pencil } from "lucide-react";

import { tr } from "@/lib/i18n";
import type { CardContextMenuProps } from "../_types";

// Every card renders one of these: keep closed cards at null, mount the motion layer only while open or exiting.
export const CardContextMenu = (props: CardContextMenuProps) => {
  const [mounted, setMounted] = useState(props.isOpen);
  if (props.isOpen && !mounted) setMounted(true);

  if (!props.canEdit || !mounted) {
    return null;
  }

  return <CardContextMenuLayer {...props} onExited={() => setMounted(false)} />;
};

const CardContextMenuLayer = ({
  isOpen,
  position,
  isLoadingArchive,
  onClose,
  onOpen,
  onRename,
  onCopy,
  onArchive,
  onExited,
}: CardContextMenuProps & { onExited: () => void }) => {
  const menu = useTempoTransition(transition.menu);

  return createPortal(
    <ReducedMotionConfig>
      <AnimatePresence onExitComplete={onExited}>
      {isOpen && (
      <motion.div
        key="overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: menu }}
        exit={{ opacity: 0, pointerEvents: "none", transition: menu }}
        className="fixed inset-0 bg-black/40 z-[45] cursor-default"
        onClick={(event) => {
          event.stopPropagation();
          onClose();
        }}
        onContextMenu={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onClose();
        }}
      />
      )}
      {isOpen && (
      <motion.div
        key="menu"
        data-context-menu="true"
        initial={{ opacity: 0, scale: scale.menu }}
        animate={{ opacity: 1, scale: 1, transition: menu }}
        exit={{ opacity: 0, scale: scale.menu, pointerEvents: "none", transition: menu }}
        className="fixed z-[100] w-52 bg-white rounded-xl shadow-2xl border border-neutral-200 p-1.5 flex flex-col gap-y-1"
        style={{
          top: position.top,
          left: position.left,
          transformOrigin: position.origin,
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          onClick={(event) => onOpen(event)}
          className="w-full flex items-center gap-x-2.5 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors cursor-pointer"
        >
          <ExternalLink className="h-4 w-4 text-neutral-400" />
          {tr("kanban.contextMenu.openCard")}
        </button>
        <button
          onClick={onRename}
          className="w-full flex items-center gap-x-2.5 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors cursor-pointer"
        >
          <Pencil className="h-4 w-4 text-neutral-400" />
          {tr("kanban.contextMenu.renameCard")}
        </button>
        <button
          onClick={onCopy}
          disabled={isLoadingArchive}
          className="w-full flex items-center gap-x-2.5 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-50 rounded-lg transition-colors cursor-pointer"
        >
          <Copy className="h-4 w-4 text-neutral-400" />
          {tr("kanban.contextMenu.copyCard")}
        </button>
        <button
          onClick={onArchive}
          disabled={isLoadingArchive}
          className="w-full flex items-center gap-x-2.5 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-50 rounded-lg transition-colors cursor-pointer"
        >
          <Archive className="h-4 w-4 text-neutral-400" />
          {isLoadingArchive ? tr("kanban.contextMenu.archivingCard") : tr("kanban.contextMenu.archiveCard")}
        </button>
      </motion.div>
      )}
      </AnimatePresence>
    </ReducedMotionConfig>,
    document.body,
  );
};
