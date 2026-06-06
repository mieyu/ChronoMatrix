import { describe, expect, test } from "vitest";
import {
  createEmptyDailyNotebookEntry,
  getDailyNotebookDateKey,
  sortDailyNotebookHistory,
  type DailyNotebookEntry,
} from "./dailyNotebook";

describe("daily notebook domain", () => {
  test("uses the local calendar date as the notebook key", () => {
    const date = new Date(2026, 5, 6, 8, 15);

    expect(getDailyNotebookDateKey(date)).toBe("2026-06-06");
  });

  test("creates an empty entry for the selected day", () => {
    expect(
      createEmptyDailyNotebookEntry(
        "2026-06-06",
        "2026-06-06T00:15:00.000Z",
      ),
    ).toEqual({
      date: "2026-06-06",
      body: "",
      createdAt: "2026-06-06T00:15:00.000Z",
      updatedAt: "2026-06-06T00:15:00.000Z",
    });
  });

  test("sorts notebook history newest day first without mutating input", () => {
    const entries: DailyNotebookEntry[] = [
      entry("2026-06-04"),
      entry("2026-06-06"),
      entry("2026-06-05"),
    ];

    const sorted = sortDailyNotebookHistory(entries);

    expect(sorted.map((item) => item.date)).toEqual([
      "2026-06-06",
      "2026-06-05",
      "2026-06-04",
    ]);
    expect(entries.map((item) => item.date)).toEqual([
      "2026-06-04",
      "2026-06-06",
      "2026-06-05",
    ]);
  });
});

function entry(date: string): DailyNotebookEntry {
  return {
    date,
    body: `${date} note`,
    createdAt: `${date}T00:00:00.000Z`,
    updatedAt: `${date}T00:00:00.000Z`,
  };
}
