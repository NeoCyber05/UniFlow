import { create } from "zustand";

type CreateTeamModalStore = {
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
};

export const useCreateTeamModal = create<CreateTeamModalStore>((set) => ({
  isOpen: false,
  onOpen: () => set({ isOpen: true }),
  onClose: () => set({ isOpen: false }),
}));
