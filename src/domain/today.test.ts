import { describe, expect, test } from "vitest";
import { buildTodaySections } from "./today";
import type { Plan } from "./plan";

const now = new Date(2026, 5, 6, 10, 30);

function localIso(
  year: number,
  monthIndex: number,
  day: number,
  hour: number,
): string {
  return new Date(year, monthIndex, day, hour).toISOString();
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
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
    completedAt: null,
    archivedAt: null,
    ...overrides,
  };
}

function sectionIds(plans: Plan[]) {
  return Object.fromEntries(
    buildTodaySections(plans, now).map((section) => [
      section.id,
      section.plans.map((item) => item.id),
    ]),
  );
}

describe("buildTodaySections", () => {
  test("puts expired unfinished plans only in the expired section", () => {
    const expired = plan({
      id: "expired",
      startAt: localIso(2026, 5, 5, 9),
      endAt: localIso(2026, 5, 5, 18),
    });

    expect(sectionIds([expired])).toEqual({
      expired: ["expired"],
      due_today: [],
      starts_today: [],
      important_unscheduled: [],
    });
  });

  test("puts plans ending today in the due today section", () => {
    const dueToday = plan({
      id: "due-today",
      endAt: localIso(2026, 5, 6, 18),
    });

    expect(sectionIds([dueToday]).due_today).toEqual(["due-today"]);
  });

  test("puts plans starting today in starts today when not due today", () => {
    const startsToday = plan({
      id: "starts-today",
      startAt: localIso(2026, 5, 6, 9),
      endAt: localIso(2026, 5, 8, 18),
    });

    expect(sectionIds([startsToday]).starts_today).toEqual(["starts-today"]);
  });

  test("puts important unscheduled plans in the important unscheduled section", () => {
    const important = plan({
      id: "important",
      importanceScore: 9,
    });

    expect(sectionIds([important]).important_unscheduled).toEqual(["important"]);
  });

  test("excludes completed and archived plans", () => {
    const completed = plan({
      id: "completed",
      storedStatus: "completed",
      endAt: localIso(2026, 5, 6, 18),
    });
    const archived = plan({
      id: "archived",
      storedStatus: "archived",
      endAt: localIso(2026, 5, 6, 18),
    });

    expect(sectionIds([completed, archived])).toEqual({
      expired: [],
      due_today: [],
      starts_today: [],
      important_unscheduled: [],
    });
  });

  test("uses the highest priority section when a plan qualifies for multiple sections", () => {
    const dueAndStartsToday = plan({
      id: "due-and-starts",
      startAt: localIso(2026, 5, 6, 9),
      endAt: localIso(2026, 5, 6, 18),
    });

    expect(sectionIds([dueAndStartsToday])).toEqual({
      expired: [],
      due_today: ["due-and-starts"],
      starts_today: [],
      important_unscheduled: [],
    });
  });

  test("sorts each section by its rule", () => {
    const sections = sectionIds([
      plan({
        id: "expired-newer",
        endAt: localIso(2026, 5, 5, 18),
      }),
      plan({
        id: "expired-older",
        endAt: localIso(2026, 5, 4, 18),
      }),
      plan({
        id: "due-later",
        endAt: localIso(2026, 5, 6, 20),
      }),
      plan({
        id: "due-sooner",
        endAt: localIso(2026, 5, 6, 12),
      }),
      plan({
        id: "starts-later",
        startAt: localIso(2026, 5, 6, 14),
        endAt: localIso(2026, 5, 8, 18),
      }),
      plan({
        id: "starts-sooner",
        startAt: localIso(2026, 5, 6, 8),
        endAt: localIso(2026, 5, 8, 18),
      }),
      plan({
        id: "important-lower",
        importanceScore: 7,
        updatedAt: "2026-06-05T10:00:00.000Z",
      }),
      plan({
        id: "important-higher",
        importanceScore: 9,
        updatedAt: "2026-06-04T10:00:00.000Z",
      }),
    ]);

    expect(sections.expired).toEqual(["expired-older", "expired-newer"]);
    expect(sections.due_today).toEqual(["due-sooner", "due-later"]);
    expect(sections.starts_today).toEqual(["starts-sooner", "starts-later"]);
    expect(sections.important_unscheduled).toEqual([
      "important-higher",
      "important-lower",
    ]);
  });
});
