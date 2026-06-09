import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  defaultAppSettings,
  normalizeAppSettings,
  type AppSettings,
  type SettingsView,
} from "@/domain/settings";

interface SettingsState extends AppSettings {
  setDefaultView: (defaultView: SettingsView) => void;
  setImportantThreshold: (importantThreshold: number) => void;
  setUrgentWindowHours: (urgentWindowHours: number) => void;
  setRemindersEnabled: (remindersEnabled: boolean) => void;
  setReminderLeadMinutes: (reminderLeadMinutes: number) => void;
}

const STORAGE_KEY = "chronomatrix.settings";

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...defaultAppSettings,
      setDefaultView: (defaultView) =>
        set((state) => normalizeAppSettings({ ...state, defaultView })),
      setImportantThreshold: (importantThreshold) =>
        set((state) => normalizeAppSettings({ ...state, importantThreshold })),
      setUrgentWindowHours: (urgentWindowHours) =>
        set((state) => normalizeAppSettings({ ...state, urgentWindowHours })),
      setRemindersEnabled: (remindersEnabled) =>
        set((state) => normalizeAppSettings({ ...state, remindersEnabled })),
      setReminderLeadMinutes: (reminderLeadMinutes) =>
        set((state) => normalizeAppSettings({ ...state, reminderLeadMinutes })),
    }),
    {
      name: STORAGE_KEY,
      merge: (persisted, current) => ({
        ...current,
        ...normalizeAppSettings(persisted),
      }),
    },
  ),
);
