import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  createDailyTimeSlice,
  deleteDailyTimeSlice,
  listDailyTimeSliceDates,
  listDailyTimeSlices,
  updateDailyTimeSliceTitle,
} from "./dailyTimeSlices";

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

describe("daily time slices data", () => {
  test("creates and lists slices for one day sorted by start time", async () => {
    await createDailyTimeSlice({
      date: "2026-06-06",
      firstMinute: 14 * 60,
      secondMinute: 15 * 60,
      title: "下午处理邮件",
    });
    await createDailyTimeSlice({
      date: "2026-06-06",
      firstMinute: 9 * 60,
      secondMinute: 10 * 60,
      title: "上午写报告",
    });
    await createDailyTimeSlice({
      date: "2026-06-07",
      firstMinute: 8 * 60,
      secondMinute: 9 * 60,
      title: "明天的安排",
    });

    const slices = await listDailyTimeSlices("2026-06-06");

    expect(slices.map((slice) => slice.title)).toEqual([
      "上午写报告",
      "下午处理邮件",
    ]);
  });

  test("updates a slice title without changing its selected time range", async () => {
    const created = await createDailyTimeSlice({
      date: "2026-06-06",
      firstMinute: 9 * 60,
      secondMinute: 10 * 60,
      title: "",
    });

    const updated = await updateDailyTimeSliceTitle(created.id, "站会和同步");

    expect(updated).toMatchObject({
      id: created.id,
      title: "站会和同步",
      startMinute: 9 * 60,
      endMinute: 10 * 60,
    });
  });

  test("deletes one slice", async () => {
    const first = await createDailyTimeSlice({
      date: "2026-06-06",
      firstMinute: 9 * 60,
      secondMinute: 10 * 60,
      title: "保留",
    });
    const second = await createDailyTimeSlice({
      date: "2026-06-06",
      firstMinute: 10 * 60,
      secondMinute: 11 * 60,
      title: "删除",
    });

    await deleteDailyTimeSlice(second.id);

    await expect(
      listDailyTimeSlices("2026-06-06").then((slices) =>
        slices.map((slice) => slice.id),
      ),
    ).resolves.toEqual([first.id]);
  });

  test("lists slice dates newest first", async () => {
    await createDailyTimeSlice({
      date: "2026-06-04",
      firstMinute: 9 * 60,
      secondMinute: 10 * 60,
      title: "older",
    });
    await createDailyTimeSlice({
      date: "2026-06-06",
      firstMinute: 9 * 60,
      secondMinute: 10 * 60,
      title: "today",
    });
    await createDailyTimeSlice({
      date: "2026-06-05",
      firstMinute: 9 * 60,
      secondMinute: 10 * 60,
      title: "yesterday",
    });

    await expect(listDailyTimeSliceDates()).resolves.toEqual([
      "2026-06-06",
      "2026-06-05",
      "2026-06-04",
    ]);
  });
});
