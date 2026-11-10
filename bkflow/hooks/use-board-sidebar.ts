import { create } from "zustand";
import { persist } from "zustand/middleware";

type BoardSidebarStore = {
  isOpen: boolean;
  calendarExpanded: boolean;
  toggleCalendar: () => void;
  open: () => void;
  close: () => void;
  toggle: () => void;
};

export const useBoardSidebar = create<BoardSidebarStore>()(
  persist(
    (set) => ({
      isOpen: true,
      calendarExpanded: false,
      toggleCalendar: () => set((state) => ({ calendarExpanded: !state.calendarExpanded })),
      open: () => set({ isOpen: true }),
      close: () => set({ isOpen: false }),
      toggle: () => set((state) => ({ isOpen: !state.isOpen })),
    }),
    {
      name: "uniflow-board-sidebar-state",
      partialize: (state) => ({ isOpen: state.isOpen }),
    }
  )
);
