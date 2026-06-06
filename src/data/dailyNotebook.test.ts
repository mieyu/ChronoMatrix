import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  getDailyNotebookEntry,
  listDailyNotebookEntries,
  saveDailyNotebookEntry,
} from "./dailyNotebook";

const storage = new Map<string, string>();

beforeEach(() => {
  storage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-06-06T08:00:00.000Z"));
  vi.stubGlobal("window", {});
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  });
});

describe("daily notebook data", () => {
  test("returns an empty entry when a day has not been saved yet", async () => {
    await expect(getDailyNotebookEntry("2026-06-06")).resolves.toEqual({
      date: "2026-06-06",
      body: "",
      createdAt: "2026-06-06T08:00:00.000Z",
      updatedAt: "2026-06-06T08:00:00.000Z",
    });
  });

  test("saves and updates a daily notebook entry", async () => {
    await saveDailyNotebookEntry("2026-06-06", "morning notes");

    vi.setSystemTime(new Date("2026-06-06T09:30:00.000Z"));
    const updated = await saveDailyNotebookEntry("2026-06-06", "updated notes");

    expect(updated).toEqual({
      date: "2026-06-06",
      body: "updated notes",
      createdAt: "2026-06-06T08:00:00.000Z",
      updatedAt: "2026-06-06T09:30:00.000Z",
    });
    await expect(getDailyNotebookEntry("2026-06-06")).resolves.toEqual(updated);
  });

  test("lists notebook history newest day first", async () => {
    await saveDailyNotebookEntry("2026-06-04", "older");
    await saveDailyNotebookEntry("2026-06-06", "today");
    await saveDailyNotebookEntry("2026-06-05", "yesterday");

    await expect(
      listDailyNotebookEntries().then((entries) =>
        entries.map((entry) => entry.date),
      ),
    ).resolves.toEqual(["2026-06-06", "2026-06-05", "2026-06-04"]);
  });
});
