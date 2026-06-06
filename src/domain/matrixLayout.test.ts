import { describe, expect, test } from "vitest";
import {
  buildMatrixLayoutItems,
  type MatrixClusterLayoutItem,
  type MatrixPlanLayoutItem,
} from "./matrixLayout";
import type { Plan } from "./plan";

const now = new Date("2026-06-05T10:00:00.000Z");

function plan(overrides: Partial<Plan> = {}): Plan {
  return {
    id: "plan-1",
    title: "Draft launch plan",
    description: "",
    importanceScore: 7,
    startAt: null,
    endAt: "2026-06-05T11:00:00.000Z",
    storedStatus: "not_started",
    categoryId: null,
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
    completedAt: null,
    archivedAt: null,
    ...overrides,
  };
}

function planItems(items: ReturnType<typeof buildMatrixLayoutItems>) {
  return items.filter((item): item is MatrixPlanLayoutItem => item.kind === "plan");
}

function clusterItems(items: ReturnType<typeof buildMatrixLayoutItems>) {
  return items.filter(
    (item): item is MatrixClusterLayoutItem => item.kind === "cluster",
  );
}

describe("buildMatrixLayoutItems", () => {
  test("keeps two nearby plans visible by assigning different coordinates", () => {
    const items = buildMatrixLayoutItems(
      [
        plan({ id: "alpha", title: "Alpha" }),
        plan({ id: "beta", title: "Beta" }),
      ],
      now,
    );

    const plans = planItems(items);

    expect(plans).toHaveLength(2);
    expect(clusterItems(items)).toHaveLength(0);
    expect(plans[0].x).not.toBe(plans[1].x);
    expect(plans[0].y).not.toBe(plans[1].y);
    expect(plans.every((item) => item.quadrant === "important-urgent")).toBe(true);
    expect(plans.every((item) => item.x > 0 && item.y > 0)).toBe(true);
  });

  test("clusters three nearby plans in the same quadrant", () => {
    const items = buildMatrixLayoutItems(
      [
        plan({ id: "alpha", title: "Alpha" }),
        plan({ id: "beta", title: "Beta" }),
        plan({ id: "gamma", title: "Gamma" }),
      ],
      now,
    );

    const clusters = clusterItems(items);

    expect(planItems(items)).toHaveLength(0);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].quadrant).toBe("important-urgent");
    expect(clusters[0].plans.map((item) => item.id)).toEqual([
      "alpha",
      "beta",
      "gamma",
    ]);
  });

  test("keeps far same-quadrant plans as individual items", () => {
    const items = buildMatrixLayoutItems(
      [
        plan({ id: "soon", title: "Soon", endAt: "2026-06-05T11:00:00.000Z" }),
        plan({ id: "later", title: "Later", endAt: "2026-06-07T10:00:00.000Z" }),
      ],
      now,
    );

    const plans = planItems(items);

    expect(plans).toHaveLength(2);
    expect(clusterItems(items)).toHaveLength(0);
    expect(plans.map((item) => item.plan.id)).toEqual(["soon", "later"]);
  });

  test("keeps not urgent plans on the left side after layout clamping", () => {
    const items = buildMatrixLayoutItems(
      [
        plan({
          id: "later",
          title: "Later",
          endAt: "2026-06-12T10:00:00.000Z",
        }),
      ],
      now,
    );

    const plans = planItems(items);

    expect(plans).toHaveLength(1);
    expect(plans[0].quadrant).toBe("important-not-urgent");
    expect(plans[0].x).toBeLessThan(0);
    expect(plans[0].y).toBeGreaterThan(0);
  });

  test("does not cluster nearby plans across quadrant boundaries", () => {
    const items = buildMatrixLayoutItems(
      [
        plan({ id: "important-a", title: "Important A", importanceScore: 8 }),
        plan({ id: "important-b", title: "Important B", importanceScore: 8 }),
        plan({ id: "minor-a", title: "Minor A", importanceScore: 2 }),
        plan({ id: "minor-b", title: "Minor B", importanceScore: 2 }),
      ],
      now,
    );

    const plans = planItems(items);

    expect(plans).toHaveLength(4);
    expect(clusterItems(items)).toHaveLength(0);
    expect(
      plans.filter((item) => item.quadrant === "important-urgent"),
    ).toHaveLength(2);
    expect(
      plans.filter((item) => item.quadrant === "not-important-urgent"),
    ).toHaveLength(2);
  });
});
