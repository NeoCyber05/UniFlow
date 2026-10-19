import { create } from "zustand";

type ShownTask = { id: string; title: string; boardId: string; updatedAt: string };
export const useAssistantTask = create<{
  task: ShownTask | null; show: (task: ShownTask) => void; clear: (id: string) => void;
  openSequence: number; openTaskId: string | null; openChecklist: (id: string) => void;
}>(set => ({
  task: null, show: task => set({ task }), clear: id => set(state => state.task?.id === id ? { task: null, openTaskId: null } : {}),
  openSequence: 0, openTaskId: null, openChecklist: id => set(state => ({ openTaskId: id, openSequence: state.openSequence + 1 })),
}));
