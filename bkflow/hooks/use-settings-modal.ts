import { create } from "zustand";

export type SettingsTab = "appearance" | "workflow" | "notifications" | "shortcuts" | "language" | "account";

interface SettingsModalStore {
  isOpen: boolean;
  activeTab: SettingsTab;
  onOpen: (tab?: SettingsTab) => void;
  onClose: () => void;
  setTab: (tab: SettingsTab) => void;
}

export const useSettingsModal = create<SettingsModalStore>((set) => ({
  isOpen: false,
  activeTab: "appearance",
  onOpen: (tab = "appearance") => set({ isOpen: true, activeTab: tab }),
  onClose: () => set({ isOpen: false }),
  setTab: (tab: SettingsTab) => set({ activeTab: tab }),
}));
