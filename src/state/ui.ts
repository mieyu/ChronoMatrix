import { create } from "zustand";
import type { Plan } from "@/domain/plan";

export type AppView = "today" | "matrix" | "calendar" | "list" | "review";

interface UiState {
  view: AppView;
  editingPlan: Plan | null;
  dialogOpen: boolean;
  searchOpen: boolean;
  settingsOpen: boolean;
  setView: (view: AppView) => void;
  openCreateDialog: () => void;
  openEditDialog: (plan: Plan) => void;
  closeDialog: () => void;
  openSearch: () => void;
  closeSearch: () => void;
  setSearchOpen: (open: boolean) => void;
  openSettings: () => void;
  closeSettings: () => void;
  setSettingsOpen: (open: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  view: "matrix",
  editingPlan: null,
  dialogOpen: false,
  searchOpen: false,
  settingsOpen: false,
  setView: (view) => set({ view }),
  openCreateDialog: () => set({ dialogOpen: true, editingPlan: null }),
  openEditDialog: (plan) => set({ dialogOpen: true, editingPlan: plan }),
  closeDialog: () => set({ dialogOpen: false, editingPlan: null }),
  openSearch: () => set({ searchOpen: true }),
  closeSearch: () => set({ searchOpen: false }),
  setSearchOpen: (open) => set({ searchOpen: open }),
  openSettings: () => set({ settingsOpen: true }),
  closeSettings: () => set({ settingsOpen: false }),
  setSettingsOpen: (open) => set({ settingsOpen: open }),
}));
