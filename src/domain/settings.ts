import {
  importantScoreThreshold,
  maxImportanceScore,
  minImportanceScore,
} from "./importance";
import { defaultMatrixRules, type MatrixRules } from "./plan";
import type { PlanReminderRules } from "./reminders";

export type SettingsView = "today" | "matrix" | "calendar" | "list" | "review";

export interface AppSettings {
  defaultView: SettingsView;
  importantThreshold: number;
  urgentWindowHours: number;
  remindersEnabled: boolean;
  reminderLeadMinutes: number;
}

export const defaultAppSettings: AppSettings = {
  defaultView: "matrix",
  importantThreshold: importantScoreThreshold,
  urgentWindowHours: defaultMatrixRules.urgentWindowHours,
  remindersEnabled: true,
  reminderLeadMinutes: 30,
};

const appViews: SettingsView[] = [
  "today",
  "matrix",
  "calendar",
  "list",
  "review",
];

export function normalizeAppSettings(value: unknown): AppSettings {
  const input = isRecord(value) ? value : {};

  return {
    defaultView: normalizeView(input.defaultView),
    importantThreshold: clampInteger(
      input.importantThreshold,
      minImportanceScore,
      maxImportanceScore,
      defaultAppSettings.importantThreshold,
    ),
    urgentWindowHours: clampInteger(
      input.urgentWindowHours,
      1,
      336,
      defaultAppSettings.urgentWindowHours,
    ),
    remindersEnabled:
      typeof input.remindersEnabled === "boolean"
        ? input.remindersEnabled
        : defaultAppSettings.remindersEnabled,
    reminderLeadMinutes: clampInteger(
      input.reminderLeadMinutes,
      0,
      1440,
      defaultAppSettings.reminderLeadMinutes,
    ),
  };
}

export function getMatrixRulesFromSettings(settings: AppSettings): MatrixRules {
  const normalized = normalizeAppSettings(settings);

  return {
    urgentWindowHours: normalized.urgentWindowHours,
    pressureHorizonDays: defaultMatrixRules.pressureHorizonDays,
    importantThreshold: normalized.importantThreshold,
  };
}

export function getReminderRulesFromSettings(
  settings: AppSettings,
): PlanReminderRules {
  const normalized = normalizeAppSettings(settings);

  return {
    enabled: normalized.remindersEnabled,
    dueSoonMinutes: normalized.reminderLeadMinutes,
  };
}

function normalizeView(value: unknown): SettingsView {
  return typeof value === "string" && appViews.includes(value as SettingsView)
    ? (value as SettingsView)
    : defaultAppSettings.defaultView;
}

function clampInteger(
  value: unknown,
  min: number,
  max: number,
  fallback: number,
): number {
  const numeric = typeof value === "number" ? value : fallback;

  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  return Math.min(Math.max(Math.round(numeric), min), max);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
