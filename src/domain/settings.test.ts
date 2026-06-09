import { describe, expect, test } from "vitest";
import {
  defaultAppSettings,
  getMatrixRulesFromSettings,
  getReminderRulesFromSettings,
  normalizeAppSettings,
  type AppSettings,
} from "./settings";

describe("app settings", () => {
  test("defaults preserve current product behavior", () => {
    expect(defaultAppSettings).toEqual({
      defaultView: "matrix",
      importantThreshold: 6,
      urgentWindowHours: 72,
      remindersEnabled: true,
      reminderLeadMinutes: 30,
    });
  });

  test("normalizes invalid persisted settings", () => {
    const settings = normalizeAppSettings({
      defaultView: "unknown",
      importantThreshold: 99,
      urgentWindowHours: -2,
      remindersEnabled: "yes",
      reminderLeadMinutes: 2000,
    });

    expect(settings).toEqual({
      defaultView: "matrix",
      importantThreshold: 10,
      urgentWindowHours: 1,
      remindersEnabled: true,
      reminderLeadMinutes: 1440,
    });
  });

  test("derives matrix rules from settings", () => {
    const settings: AppSettings = {
      ...defaultAppSettings,
      importantThreshold: 8,
      urgentWindowHours: 24,
    };

    expect(getMatrixRulesFromSettings(settings)).toEqual({
      urgentWindowHours: 24,
      pressureHorizonDays: 14,
      importantThreshold: 8,
    });
  });

  test("derives reminder rules from settings", () => {
    const settings: AppSettings = {
      ...defaultAppSettings,
      remindersEnabled: false,
      reminderLeadMinutes: 15,
    };

    expect(getReminderRulesFromSettings(settings)).toEqual({
      enabled: false,
      dueSoonMinutes: 15,
    });
  });
});
