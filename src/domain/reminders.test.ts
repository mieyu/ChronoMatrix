import { describe, expect, test } from "vitest";
import {
  buildPlanReminderCandidates,
  filterPlanReminderCandidatesForRules,
  getPlanReminderKey,
} from "./reminders";
import type { Plan } from "./plan";

const now = new Date("2026-06-06T10:30:00.000Z");

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

describe("buildPlanReminderCandidates", () => {
  test("creates a due-soon reminder inside the 30 minute deadline window", () => {
    const candidates = buildPlanReminderCandidates(
      [
        plan({
          id: "due-soon",
          endAt: "2026-06-06T10:59:00.000Z",
        }),
      ],
      now,
      new Set(),
    );

    expect(candidates).toMatchObject([
      {
        kind: "due_soon",
        key: "due-soon:due_soon:2026-06-06T10:59:00.000Z",
      },
    ]);
  });

  test("does not remind before the due-soon window opens", () => {
    const candidates = buildPlanReminderCandidates(
      [
        plan({
          id: "later",
          endAt: "2026-06-06T11:01:00.000Z",
        }),
      ],
      now,
      new Set(),
    );

    expect(candidates).toEqual([]);
  });

  test("creates an expired reminder for unfinished plans after their end time", () => {
    const candidates = buildPlanReminderCandidates(
      [
        plan({
          id: "expired",
          endAt: "2026-06-06T10:00:00.000Z",
        }),
      ],
      now,
      new Set(),
    );

    expect(candidates).toMatchObject([
      {
        kind: "expired",
        key: "expired:expired:2026-06-06T10:00:00.000Z",
      },
    ]);
  });

  test("excludes completed archived and unscheduled plans", () => {
    const candidates = buildPlanReminderCandidates(
      [
        plan({
          id: "completed",
          storedStatus: "completed",
          completedAt: "2026-06-06T09:00:00.000Z",
          endAt: "2026-06-06T10:00:00.000Z",
        }),
        plan({
          id: "archived",
          storedStatus: "archived",
          archivedAt: "2026-06-06T09:00:00.000Z",
          endAt: "2026-06-06T10:00:00.000Z",
        }),
        plan({
          id: "unscheduled",
          endAt: null,
        }),
      ],
      now,
      new Set(),
    );

    expect(candidates).toEqual([]);
  });

  test("does not return reminders that were already sent", () => {
    const reminderPlan = plan({
      id: "due-soon",
      endAt: "2026-06-06T10:59:00.000Z",
    });
    const sentKeys = new Set([getPlanReminderKey(reminderPlan, "due_soon")]);

    expect(buildPlanReminderCandidates([reminderPlan], now, sentKeys)).toEqual(
      [],
    );
  });

  test("returns no candidates when reminders are disabled", () => {
    const candidates = buildPlanReminderCandidates(
      [
        plan({
          id: "due-soon",
          endAt: "2026-06-06T10:59:00.000Z",
        }),
      ],
      now,
      new Set(),
      { enabled: false, dueSoonMinutes: 30 },
    );

    expect(candidates).toEqual([]);
  });

  test("keeps reminders enabled when custom rules omit enabled", () => {
    const candidates = buildPlanReminderCandidates(
      [
        plan({
          id: "due-soon",
          endAt: "2026-06-06T10:59:00.000Z",
        }),
      ],
      now,
      new Set(),
      { dueSoonMinutes: 30 },
    );

    expect(candidates).toMatchObject([
      {
        kind: "due_soon",
        key: "due-soon:due_soon:2026-06-06T10:59:00.000Z",
      },
    ]);
  });

  test("does not create due-soon reminders when the lead time is zero", () => {
    const candidates = buildPlanReminderCandidates(
      [
        plan({
          id: "due-now",
          endAt: "2026-06-06T10:30:00.000Z",
        }),
      ],
      now,
      new Set(),
      { enabled: true, dueSoonMinutes: 0 },
    );

    expect(candidates).toEqual([]);
  });

  test("filters stale due-soon candidates against current reminder rules", () => {
    const candidates = buildPlanReminderCandidates(
      [
        plan({
          id: "due-soon",
          endAt: "2026-06-06T10:59:00.000Z",
        }),
        plan({
          id: "expired",
          endAt: "2026-06-06T10:00:00.000Z",
        }),
      ],
      now,
      new Set(),
    );

    expect(
      filterPlanReminderCandidatesForRules(candidates, now, {
        enabled: false,
        dueSoonMinutes: 30,
      }),
    ).toEqual([]);
    expect(
      filterPlanReminderCandidatesForRules(candidates, now, {
        enabled: true,
        dueSoonMinutes: 0,
      }).map((candidate) => candidate.kind),
    ).toEqual(["expired"]);
  });

  test("changes the reminder key when a plan deadline changes", () => {
    const original = plan({
      id: "moved",
      endAt: "2026-06-06T10:59:00.000Z",
    });
    const moved = plan({
      id: "moved",
      endAt: "2026-06-06T11:00:00.000Z",
    });

    expect(getPlanReminderKey(original, "due_soon")).not.toBe(
      getPlanReminderKey(moved, "due_soon"),
    );
  });
});
