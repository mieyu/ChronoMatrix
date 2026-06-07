import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  nextThemePreference,
  resolveTheme,
  type ResolvedTheme,
  type ThemePreference,
} from "@/domain/theme";

interface ThemeState {
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
  cyclePreference: () => void;
}

const STORAGE_KEY = "chronomatrix.theme";

function systemPrefersDark(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) {
    return false;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyResolvedTheme(theme: ResolvedTheme): void {
  if (typeof document === "undefined") {
    return;
  }

  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      preference: "system",
      setPreference: (preference) => set({ preference }),
      cyclePreference: () =>
        set((state) => ({ preference: nextThemePreference(state.preference) })),
    }),
    { name: STORAGE_KEY },
  ),
);

/**
 * Wire the theme store to the document. Call once at startup. Applies the
 * current preference immediately and keeps the DOM in sync with both
 * preference changes and OS-level appearance changes.
 */
export function initThemeEffect(): () => void {
  const apply = () => {
    const { preference } = useThemeStore.getState();
    applyResolvedTheme(resolveTheme(preference, systemPrefersDark()));
  };

  apply();

  const unsubscribe = useThemeStore.subscribe(apply);

  let media: MediaQueryList | null = null;
  if (typeof window !== "undefined" && window.matchMedia) {
    media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", apply);
  }

  return () => {
    unsubscribe();
    media?.removeEventListener("change", apply);
  };
}
