import { describe, expect, test } from "vitest";
import { buildMatrixLayoutItems } from "./matrixLayout";
import {
  defaultMatrixViewport,
  getMatrixLayoutRulesForScale,
  panMatrixViewport,
  resetMatrixViewport,
  zoomMatrixViewportAt,
  zoomMatrixViewportByWheel,
  type MatrixViewport,
} from "./matrixViewport";
import type { MatrixClusterLayoutItem, MatrixPlanLayoutItem } from "./matrixLayout";
import type { Plan } from "./plan";

const now = new Date("2026-06-05T10:00:00.000Z");

function plan(overrides: Partial<Plan> = {}): Plan {
  return {
    id: "plan-1",
    title: "Draft launch plan",
    description: "",
    importanceScore: 70,
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

function canvasPointAt(
  viewport: MatrixViewport,
  screenPoint: { x: number; y: number },
) {
  return {
    x: (screenPoint.x - viewport.offsetX) / viewport.scale,
    y: (screenPoint.y - viewport.offsetY) / viewport.scale,
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

describe("matrixViewport", () => {
  test("zooms around the cursor instead of the canvas origin", () => {
    const cursor = { x: 240, y: 160 };
    const before = canvasPointAt(defaultMatrixViewport, cursor);

    const next = zoomMatrixViewportAt(defaultMatrixViewport, cursor, 2);
    const after = canvasPointAt(next, cursor);

    expect(next).toEqual({ scale: 2, offsetX: -240, offsetY: -160 });
    expect(after).toEqual(before);
  });

  test("preserves the cursor anchor when zooming from an already panned viewport", () => {
    const viewport: MatrixViewport = { scale: 1.4, offsetX: -80, offsetY: 40 };
    const cursor = { x: 320, y: 220 };
    const before = canvasPointAt(viewport, cursor);

    const next = zoomMatrixViewportAt(viewport, cursor, 2.1);
    const after = canvasPointAt(next, cursor);

    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
  });

  test("clamps wheel zoom between 0.6x and 3x", () => {
    const zoomedOut = zoomMatrixViewportByWheel(
      { scale: 0.62, offsetX: 0, offsetY: 0 },
      { x: 100, y: 100 },
      500,
    );
    const zoomedIn = zoomMatrixViewportByWheel(
      { scale: 2.95, offsetX: 0, offsetY: 0 },
      { x: 100, y: 100 },
      -500,
    );

    expect(zoomedOut.scale).toBe(0.6);
    expect(zoomedIn.scale).toBe(3);
  });

  test("pans in screen pixels without changing scale", () => {
    const next = panMatrixViewport(
      { scale: 1.8, offsetX: -12, offsetY: 25 },
      { x: 30, y: -10 },
    );

    expect(next).toEqual({ scale: 1.8, offsetX: 18, offsetY: 15 });
  });

  test("resets to the default viewport", () => {
    expect(resetMatrixViewport()).toEqual(defaultMatrixViewport);
  });

  test("derives stricter aggregation rules when zoomed in and looser rules when zoomed out", () => {
    const zoomedOut = getMatrixLayoutRulesForScale(0.6);
    const defaultRules = getMatrixLayoutRulesForScale(1);
    const zoomedIn = getMatrixLayoutRulesForScale(2.2);

    expect(zoomedOut.clusterRadius).toBeGreaterThan(defaultRules.clusterRadius);
    expect(zoomedOut.clusterMinSize).toBeLessThan(defaultRules.clusterMinSize);
    expect(zoomedIn.clusterRadius).toBeLessThan(defaultRules.clusterRadius);
    expect(zoomedIn.clusterMinSize).toBeGreaterThan(defaultRules.clusterMinSize);
  });

  test("scale-aware aggregation clusters sooner when zoomed out and splits apart when zoomed in", () => {
    const nearbyPlans = [
      plan({ id: "alpha", title: "Alpha" }),
      plan({ id: "beta", title: "Beta" }),
      plan({ id: "gamma", title: "Gamma" }),
    ];

    const zoomedOutItems = buildMatrixLayoutItems(
      nearbyPlans.slice(0, 2),
      now,
      undefined,
      getMatrixLayoutRulesForScale(0.6),
    );
    const zoomedInItems = buildMatrixLayoutItems(
      nearbyPlans,
      now,
      undefined,
      getMatrixLayoutRulesForScale(2.2),
    );

    expect(clusterItems(zoomedOutItems)).toHaveLength(1);
    expect(planItems(zoomedOutItems)).toHaveLength(0);
    expect(clusterItems(zoomedInItems)).toHaveLength(0);
    expect(planItems(zoomedInItems)).toHaveLength(3);
  });
});
