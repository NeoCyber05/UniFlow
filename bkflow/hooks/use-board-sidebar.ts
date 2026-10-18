import { create } from "zustand";
import { persist } from "zustand/middleware";

type BoardSidebarStore = {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
};

export const useBoardSidebar = create<BoardSidebarStore>()(
  persist(
    (set) => ({
      isOpen: true,
      open: () => set({ isOpen: true }),
      close: () => set({ isOpen: false }),
      toggle: () => set((state) => ({ isOpen: !state.isOpen })),
    }),
    {
      name: "uniflow-board-sidebar-state",
    }
  )
);
