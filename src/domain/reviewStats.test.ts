import { describe, expect, test } from "vitest";
import {
  buildReviewStats,
  getReviewPeriodRange,
  type ReviewPeriodId,
} from "./reviewStats";
import type { Plan } from "./plan";

const now = new Date(2026, 5, 6, 10, 30);

function iso(
  year: number,
  monthIndex: number,
  day: number,
  hour = 0,
  minute = 0,
): string {
  return new Date(year, monthIndex, day, hour, minute).toISOString();
}

function plan(overrides: Partial<Plan> = {}): Plan {
  return {
    id: "plan-1",
    title: "Draft launch plan",
    description: "",
    importanceScore: 7,
    startAt: null,
    endAt: null,
    storedStatus: "not_started",
    categoryId: null,
    createdAt: iso(2026, 5, 1),
    updatedAt: iso(2026, 5, 1),
    completedAt: null,
    archivedAt: null,
    ...overrides,
  };
}

describe("getReviewPeriodRange", () => {
  test.each<[ReviewPeriodId, string]>([
    ["this_week", "2026-06-01"],
    ["last_7_days", "2026-05-31"],
    ["last_30_days", "2026-05-08"],
  ])("starts %s at the expected local day", (period, expectedDay) => {
    const range = getReviewPeriodRange(period, now);

    expect(range.startKey).toBe(expectedDay);
    expect(range.endAt).toBe(now);
  });
});

describe("buildReviewStats", () => {
  test("counts created and completed formal plans for the selected period", () => {
    const stats = buildReviewStats(
      [
        plan({
          id: "created-only",
          createdAt: iso(2026, 5, 2),
        }),
        plan({
          id: "created-and-completed",
          createdAt: iso(2026, 5, 3),
          storedStatus: "completed",
          completedAt: iso(2026, 5, 4),
        }),
        plan({
          id: "completed-old-plan",
          createdAt: iso(2026, 4, 20),
          storedStatus: "completed",
          completedAt: iso(2026, 5, 5),
        }),
        plan({
          id: "outside-period",
          createdAt: iso(2026, 4, 20),
          completedAt: iso(2026, 4, 25),
          storedStatus: "completed",
        }),
      ],
      now,
      "this_week",
    );

    expect(stats.metrics.createdCount).toBe(2);
    expect(stats.metrics.completedCount).toBe(2);
    expect(stats.metrics.completionRate).toBe(0.5);
    expect(stats.completedPlans.map((item) => item.id)).toEqual([
      "completed-old-plan",
      "created-and-completed",
    ]);
  });

  test("counts current expired plans and important expired plans", () => {
    const stats = buildReviewStats(
      [
        plan({
          id: "expired-important",
          importanceScore: 9,
          endAt: iso(2026, 5, 5, 18),
        }),
        plan({
          id: "expired-low",
          importanceScore: 3,
          endAt: iso(2026, 5, 5, 19),
        }),
        plan({
          id: "completed-past",
          importanceScore: 9,
          endAt: iso(2026, 5, 5, 20),
          storedStatus: "completed",
          completedAt: iso(2026, 5, 5, 19),
        }),
      ],
      now,
      "this_week",
    );

    expect(stats.metrics.expiredCount).toBe(2);
    expect(stats.metrics.expiredImportantCount).toBe(1);
    expect(stats.expiredPlans.map((item) => item.id)).toEqual([
      "expired-important",
      "expired-low",
    ]);
  });

  test("summarizes scheduled plans by current matrix quadrant and status", () => {
    const stats = buildReviewStats(
      [
        plan({
          id: "important-urgent-open",
          importanceScore: 9,
          endAt: iso(2026, 5, 6, 12),
        }),
        plan({
          id: "important-urgent-done",
          importanceScore: 8,
          endAt: iso(2026, 5, 4, 12),
          storedStatus: "completed",
          completedAt: iso(2026, 5, 4, 11),
        }),
        plan({
          id: "important-not-urgent-open",
          importanceScore: 8,
          endAt: iso(2026, 5, 20, 12),
        }),
        plan({
          id: "not-important-urgent-expired",
          importanceScore: 3,
          endAt: iso(2026, 5, 5, 12),
        }),
        plan({
          id: "archived-scheduled",
          importanceScore: 9,
          endAt: iso(2026, 5, 6, 12),
          storedStatus: "archived",
          archivedAt: iso(2026, 5, 6, 9),
        }),
        plan({
          id: "unscheduled",
          importanceScore: 9,
        }),
      ],
      now,
      "this_week",
    );

    expect(stats.quadrants["important-urgent"]).toMatchObject({
      total: 2,
      completed: 1,
      expired: 0,
      unfinished: 1,
    });
    expect(stats.quadrants["important-not-urgent"]).toMatchObject({
      total: 1,
      completed: 0,
      expired: 0,
      unfinished: 1,
    });
    expect(stats.quadrants["not-important-urgent"]).toMatchObject({
      total: 1,
      completed: 0,
      expired: 1,
      unfinished: 0,
    });
  });

  test("lists important unscheduled formal plans only", () => {
    const stats = buildReviewStats(
      [
        plan({
          id: "important-unscheduled",
          importanceScore: 9,
          updatedAt: iso(2026, 5, 5, 12),
        }),
        plan({
          id: "low-unscheduled",
          importanceScore: 3,
        }),
        plan({
          id: "important-scheduled",
          importanceScore: 9,
          endAt: iso(2026, 5, 7, 12),
        }),
        plan({
          id: "important-archived",
          importanceScore: 9,
          storedStatus: "archived",
          archivedAt: iso(2026, 5, 5, 12),
        }),
      ],
      now,
      "this_week",
    );

    expect(stats.importantUnscheduledPlans.map((item) => item.id)).toEqual([
      "important-unscheduled",
    ]);
  });

  test("uses custom matrix rules for quadrant review and important unscheduled plans", () => {
    const stats = buildReviewStats(
      [
        plan({
          id: "below-custom-threshold",
          importanceScore: 7,
          endAt: "2026-06-06T11:00:00.000Z",
        }),
        plan({
          id: "unscheduled-below-custom-threshold",
          importanceScore: 7,
        }),
      ],
      new Date("2026-06-06T10:30:00.000Z"),
      "this_week",
      { urgentWindowHours: 72, pressureHorizonDays: 14, importantThreshold: 8 },
    );

    expect(stats.quadrants["not-important-urgent"].total).toBe(1);
    expect(stats.quadrants["important-urgent"].total).toBe(0);
    expect(stats.importantUnscheduledPlans).toEqual([]);
  });
});
