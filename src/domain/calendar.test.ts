import { describe, expect, test } from "vitest";
import { format } from "date-fns";
import {
  getCalendarDays,
  getCalendarEntriesForDay,
  getCalendarSpansForWeek,
  getUnscheduledPlans,
} from "./calendar";
import type { Plan } from "./plan";

const calendarDay = new Date(2026, 5, 5);
const localMorning = "2026-06-05T00:00:00.000Z";
const localEvening = "2026-06-05T10:00:00.000Z";

function plan(overrides: Partial<Plan> = {}): Plan {
  return {
    id: "plan-1",
    title: "Draft launch plan",
    description: "",
    importanceScore: 70,
    startAt: null,
    endAt: null,
    storedStatus: "not_started",
    categoryId: null,
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
    completedAt: null,
    archivedAt: null,
    ...overrides,
  };
}

describe("getCalendarEntriesForDay", () => {
  test("excludes plans that have neither start time nor end time", () => {
    expect(
      getCalendarEntriesForDay([plan()], calendarDay),
    ).toEqual([]);
  });

  test("shows a start-only plan on its start day with a start marker", () => {
    const entries = getCalendarEntriesForDay(
      [
        plan({
          startAt: localMorning,
        }),
      ],
      calendarDay,
    );

    expect(entries).toHaveLength(1);
    expect(entries[0]?.markers).toEqual([
      { kind: "start", at: localMorning },
    ]);
  });

  test("shows an end-only plan on its end day with an end marker", () => {
    const entries = getCalendarEntriesForDay(
      [
        plan({
          endAt: localEvening,
        }),
      ],
      calendarDay,
    );

    expect(entries).toHaveLength(1);
    expect(entries[0]?.markers).toEqual([
      { kind: "end", at: localEvening },
    ]);
  });

  test("excludes plans with both start and end times because they render as bars", () => {
    const entries = getCalendarEntriesForDay(
      [
        plan({
          startAt: localMorning,
          endAt: localEvening,
        }),
      ],
      calendarDay,
    );

    expect(entries).toEqual([]);
  });
});

describe("getCalendarSpansForWeek", () => {
  test("creates a one-day span when start and end are on the same day", () => {
    const days = getCalendarDays("week", new Date("2026-06-05T10:00:00.000Z"));
    const spans = getCalendarSpansForWeek(
      [
        plan({
          startAt: localMorning,
          endAt: localEvening,
        }),
      ],
      days,
    );

    expect(spans).toHaveLength(1);
    expect(spans[0]?.startIndex).toBe(4);
    expect(spans[0]?.endIndex).toBe(4);
    expect(spans[0]?.isStartVisible).toBe(true);
    expect(spans[0]?.isEndVisible).toBe(true);
  });

  test("creates a multi-day span inside the visible week", () => {
    const days = getCalendarDays("week", new Date("2026-06-05T10:00:00.000Z"));
    const spans = getCalendarSpansForWeek(
      [
        plan({
          startAt: "2026-06-03T00:00:00.000Z",
          endAt: "2026-06-06T10:00:00.000Z",
        }),
      ],
      days,
    );

    expect(spans[0]?.startIndex).toBe(2);
    expect(spans[0]?.endIndex).toBe(5);
  });

  test("clips spans that started before the visible week", () => {
    const days = getCalendarDays("week", new Date("2026-06-05T10:00:00.000Z"));
    const spans = getCalendarSpansForWeek(
      [
        plan({
          startAt: "2026-05-30T00:00:00.000Z",
          endAt: "2026-06-02T10:00:00.000Z",
        }),
      ],
      days,
    );

    expect(spans[0]?.startIndex).toBe(0);
    expect(spans[0]?.endIndex).toBe(1);
    expect(spans[0]?.isStartVisible).toBe(false);
    expect(spans[0]?.isEndVisible).toBe(true);
  });
});

describe("getUnscheduledPlans", () => {
  test("returns plans without any time boundary", () => {
    const unscheduled = plan({ id: "unscheduled" });
    const startOnly = plan({
      id: "start-only",
      startAt: localMorning,
    });

    expect(getUnscheduledPlans([unscheduled, startOnly])).toEqual([unscheduled]);
  });
});

describe("getCalendarDays", () => {
  test("returns Monday to Sunday for week mode", () => {
    const days = getCalendarDays("week", new Date("2026-06-05T10:00:00.000Z"));

    expect(days).toHaveLength(7);
    expect(format(days[0]!, "yyyy-MM-dd")).toBe("2026-06-01");
    expect(format(days[6]!, "yyyy-MM-dd")).toBe("2026-06-07");
  });

  test("returns a full week-aligned grid for month mode", () => {
    const days = getCalendarDays("month", new Date("2026-06-05T10:00:00.000Z"));

    expect(format(days[0]!, "yyyy-MM-dd")).toBe("2026-06-01");
    expect(days.length % 7).toBe(0);
    expect(format(days.at(-1)!, "yyyy-MM-dd")).toBe("2026-07-05");
  });
});
