import { describe, expect, test } from "vitest";
import {
  deriveEffectiveStatus,
  getPlanMatrixPlacement,
  type Plan,
} from "./plan";

const now = new Date("2026-06-05T10:00:00.000Z");

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

describe("deriveEffectiveStatus", () => {
  test("keeps completed plans completed even when the end time is in the past", () => {
    expect(
      deriveEffectiveStatus(
        plan({
          storedStatus: "completed",
          endAt: "2026-06-04T10:00:00.000Z",
          completedAt: "2026-06-04T09:00:00.000Z",
        }),
        now,
      ),
    ).toBe("completed");
  });

  test("marks an unfinished plan as expired after its end time", () => {
    expect(
      deriveEffectiveStatus(
        plan({
          storedStatus: "in_progress",
          endAt: "2026-06-05T09:59:00.000Z",
        }),
        now,
      ),
    ).toBe("expired");
  });

  test("marks a plan as in progress when its start time has arrived", () => {
    expect(
      deriveEffectiveStatus(
        plan({
          startAt: "2026-06-05T09:00:00.000Z",
          endAt: "2026-06-05T12:00:00.000Z",
        }),
        now,
      ),
    ).toBe("in_progress");
  });

  test("keeps future plans not started before their start time", () => {
    expect(
      deriveEffectiveStatus(
        plan({
          startAt: "2026-06-05T11:00:00.000Z",
          endAt: "2026-06-05T12:00:00.000Z",
        }),
        now,
      ),
    ).toBe("not_started");
  });
});

describe("getPlanMatrixPlacement", () => {
  test("places unscheduled plans outside the matrix body", () => {
    expect(getPlanMatrixPlacement(plan(), now).bucket).toBe("unscheduled");
  });

  test("places expired plans outside the matrix body", () => {
    expect(
      getPlanMatrixPlacement(
        plan({
          endAt: "2026-06-05T09:00:00.000Z",
        }),
        now,
      ).bucket,
    ).toBe("expired");
  });

  test("maps important urgent plans to the important urgent quadrant", () => {
    const placement = getPlanMatrixPlacement(
      plan({
        importanceScore: 90,
        endAt: "2026-06-05T11:00:00.000Z",
      }),
      now,
      { urgentWindowHours: 72, pressureHorizonDays: 14, importantThreshold: 60 },
    );

    expect(placement.bucket).toBe("matrix");
    expect(placement.quadrant).toBe("important-urgent");
    expect(placement.x).toBeGreaterThan(0);
    expect(placement.y).toBeGreaterThan(0);
  });

  test("moves plans closer to the center as their reference time gets closer", () => {
    const sooner = getPlanMatrixPlacement(
      plan({
        endAt: "2026-06-05T11:00:00.000Z",
      }),
      now,
    );
    const later = getPlanMatrixPlacement(
      plan({
        id: "plan-2",
        endAt: "2026-06-12T10:00:00.000Z",
      }),
      now,
    );

    expect(sooner.bucket).toBe("matrix");
    expect(later.bucket).toBe("matrix");
    expect(sooner.radius).toBeLessThan(later.radius);
  });
});
