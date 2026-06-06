import { beforeEach, describe, expect, test, vi } from "vitest";
import { createPlan, listPlans, restoreArchivedPlan } from "./plans";

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

describe("plans data", () => {
  test("restores an archived plan back to not started", async () => {
    const archived = await createPlan({
      title: "旧计划",
      description: "已经归档",
      importanceScore: 7,
      startAt: null,
      endAt: null,
      storedStatus: "archived",
      categoryId: null,
    });

    vi.setSystemTime(new Date("2026-06-06T09:30:00.000Z"));
    await restoreArchivedPlan(archived.id);

    const restored = (await listPlans()).find((plan) => plan.id === archived.id);

    expect(restored).toMatchObject({
      storedStatus: "not_started",
      archivedAt: null,
      updatedAt: "2026-06-06T09:30:00.000Z",
    });
  });
});
