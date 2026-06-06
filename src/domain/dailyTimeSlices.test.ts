import { describe, expect, test } from "vitest";
import {
  createDailyTimeSliceFromSelection,
  buildDailyTimeSliceOverview,
  formatMinuteOfDay,
  getCurrentTimeScrollTop,
  getTimeSliceBlockLayout,
  getTimelineMinuteFromRatio,
  sortDailyTimeSlices,
  type DailyTimeSlice,
} from "./dailyTimeSlices";

describe("daily time slices domain", () => {
  test("maps a timeline click ratio to a 15 minute minute-of-day value", () => {
    expect(getTimelineMinuteFromRatio(0)).toBe(0);
    expect(getTimelineMinuteFromRatio(0.5)).toBe(720);
    expect(getTimelineMinuteFromRatio(0.999)).toBe(1425);
    expect(getTimelineMinuteFromRatio(-1)).toBe(0);
    expect(getTimelineMinuteFromRatio(2)).toBe(1425);
  });

  test("formats minute-of-day values as clock labels", () => {
    expect(formatMinuteOfDay(0)).toBe("00:00");
    expect(formatMinuteOfDay(9 * 60 + 30)).toBe("09:30");
    expect(formatMinuteOfDay(24 * 60)).toBe("24:00");
  });

  test("creates a slice from two clicked minutes without requiring manual time input", () => {
    expect(
      createDailyTimeSliceFromSelection({
        date: "2026-06-06",
        firstMinute: 14 * 60 + 45,
        secondMinute: 9 * 60 + 30,
        title: "写报告",
        nowIso: "2026-06-06T01:00:00.000Z",
      }),
    ).toMatchObject({
      date: "2026-06-06",
      title: "写报告",
      startMinute: 570,
      endMinute: 885,
      createdAt: "2026-06-06T01:00:00.000Z",
      updatedAt: "2026-06-06T01:00:00.000Z",
    });
  });

  test("enforces a 15 minute minimum duration when both clicks land on the same slot", () => {
    const slice = createDailyTimeSliceFromSelection({
      date: "2026-06-06",
      firstMinute: 23 * 60 + 45,
      secondMinute: 23 * 60 + 45,
      title: "",
      nowIso: "2026-06-06T01:00:00.000Z",
    });

    expect(slice.startMinute).toBe(1425);
    expect(slice.endMinute).toBe(1440);
  });

  test("sorts daily slices by start time", () => {
    const slices: DailyTimeSlice[] = [
      slice("late", 18 * 60, 19 * 60),
      slice("early", 9 * 60, 10 * 60),
      slice("middle", 13 * 60, 14 * 60),
    ];

    expect(sortDailyTimeSlices(slices).map((item) => item.id)).toEqual([
      "early",
      "middle",
      "late",
    ]);
  });

  test("marks short slices as compact while preserving their true time height", () => {
    expect(
      getTimeSliceBlockLayout(slice("short", 6 * 60 + 45, 7 * 60 + 15)),
    ).toEqual({
      topPercent: 28.125,
      heightPercent: 2.083333333333333,
      compact: true,
    });
    expect(
      getTimeSliceBlockLayout(slice("long", 8 * 60, 9 * 60 + 30)).compact,
    ).toBe(false);
  });

  test("centers the current time in a scrollable timeline when possible", () => {
    expect(
      getCurrentTimeScrollTop({
        minute: 12 * 60,
        containerHeight: 600,
        timelineHeight: 2400,
      }),
    ).toBe(900);
    expect(
      getCurrentTimeScrollTop({
        minute: 30,
        containerHeight: 600,
        timelineHeight: 2400,
      }),
    ).toBe(0);
    expect(
      getCurrentTimeScrollTop({
        minute: 23 * 60 + 45,
        containerHeight: 600,
        timelineHeight: 2400,
      }),
    ).toBe(1800);
  });

  test("builds a calm horizontal overview from the selected slices", () => {
    const overview = buildDailyTimeSliceOverview([
      slice("sleep", 0, 13 * 60, "睡觉"),
      slice("meal", 13 * 60, 14 * 60, "吃饭"),
      slice("study", 14 * 60, 17 * 60, "学习"),
      slice("play", 17 * 60, 24 * 60, "玩"),
    ]);

    expect(overview.ticks).toEqual([0, 360, 720, 1080, 1440]);
    expect(overview.segments).toEqual([
      {
        id: "sleep",
        title: "睡觉",
        startMinute: 0,
        endMinute: 780,
        durationMinutes: 780,
        leftPercent: 0,
        widthPercent: 54.166666666666664,
        showLabel: true,
      },
      {
        id: "meal",
        title: "吃饭",
        startMinute: 780,
        endMinute: 840,
        durationMinutes: 60,
        leftPercent: 54.166666666666664,
        widthPercent: 4.166666666666666,
        showLabel: false,
      },
      {
        id: "study",
        title: "学习",
        startMinute: 840,
        endMinute: 1020,
        durationMinutes: 180,
        leftPercent: 58.333333333333336,
        widthPercent: 12.5,
        showLabel: true,
      },
      {
        id: "play",
        title: "玩",
        startMinute: 1020,
        endMinute: 1440,
        durationMinutes: 420,
        leftPercent: 70.83333333333334,
        widthPercent: 29.166666666666668,
        showLabel: true,
      },
    ]);
  });
});

function slice(
  id: string,
  startMinute: number,
  endMinute: number,
  title = id,
): DailyTimeSlice {
  return {
    id,
    date: "2026-06-06",
    title,
    startMinute,
    endMinute,
    createdAt: "2026-06-06T00:00:00.000Z",
    updatedAt: "2026-06-06T00:00:00.000Z",
  };
}
