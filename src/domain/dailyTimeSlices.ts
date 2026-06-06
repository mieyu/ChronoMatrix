export const timeSliceStepMinutes = 15;
export const dayMinuteCount = 24 * 60;
const compactSliceThresholdMinutes = 45;
const overviewLabelThresholdMinutes = 90;
const overviewTicks = [0, 6 * 60, 12 * 60, 18 * 60, dayMinuteCount];

export interface DailyTimeSlice {
  id: string;
  date: string;
  title: string;
  startMinute: number;
  endMinute: number;
  createdAt: string;
  updatedAt: string;
}

export interface DailyTimeSliceOverviewSegment {
  id: string;
  title: string;
  startMinute: number;
  endMinute: number;
  durationMinutes: number;
  leftPercent: number;
  widthPercent: number;
  showLabel: boolean;
}

export interface DailyTimeSliceOverview {
  ticks: number[];
  segments: DailyTimeSliceOverviewSegment[];
}

export function getTimelineMinuteFromRatio(ratio: number): number {
  const clampedRatio = Math.min(Math.max(ratio, 0), 1);
  const rawMinute = clampedRatio * dayMinuteCount;
  const steppedMinute =
    Math.floor(rawMinute / timeSliceStepMinutes) * timeSliceStepMinutes;

  return Math.min(steppedMinute, dayMinuteCount - timeSliceStepMinutes);
}

export function formatMinuteOfDay(minute: number): string {
  const clampedMinute = Math.min(Math.max(minute, 0), dayMinuteCount);
  const hours = Math.floor(clampedMinute / 60);
  const minutes = clampedMinute % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function createDailyTimeSliceFromSelection({
  date,
  firstMinute,
  secondMinute,
  title,
  nowIso = new Date().toISOString(),
}: {
  date: string;
  firstMinute: number;
  secondMinute: number;
  title: string;
  nowIso?: string;
}): DailyTimeSlice {
  const startMinute = clampMinute(Math.min(firstMinute, secondMinute));
  const rawEndMinute = clampMinute(Math.max(firstMinute, secondMinute));
  const endMinute =
    rawEndMinute === startMinute
      ? Math.min(startMinute + timeSliceStepMinutes, dayMinuteCount)
      : rawEndMinute;

  return {
    id: crypto.randomUUID(),
    date,
    title: title.trim(),
    startMinute,
    endMinute,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

export function sortDailyTimeSlices(
  slices: DailyTimeSlice[],
): DailyTimeSlice[] {
  return [...slices].sort(
    (a, b) =>
      a.startMinute - b.startMinute ||
      a.endMinute - b.endMinute ||
      a.createdAt.localeCompare(b.createdAt),
  );
}

export function buildDailyTimeSliceOverview(
  slices: DailyTimeSlice[],
): DailyTimeSliceOverview {
  const sortedSlices = sortDailyTimeSlices(slices);
  const segments = sortedSlices.map((slice) => {
    const durationMinutes = Math.max(slice.endMinute - slice.startMinute, 0);

    return {
      id: slice.id,
      title: slice.title.trim() || "未命名",
      startMinute: slice.startMinute,
      endMinute: slice.endMinute,
      durationMinutes,
      leftPercent: (slice.startMinute / dayMinuteCount) * 100,
      widthPercent: (durationMinutes / dayMinuteCount) * 100,
      showLabel: durationMinutes >= overviewLabelThresholdMinutes,
    };
  });

  return {
    ticks: overviewTicks,
    segments,
  };
}

export function getTimeSliceBlockLayout(slice: DailyTimeSlice): {
  topPercent: number;
  heightPercent: number;
  compact: boolean;
} {
  const durationMinutes = Math.max(slice.endMinute - slice.startMinute, 0);

  return {
    topPercent: (slice.startMinute / dayMinuteCount) * 100,
    heightPercent: (durationMinutes / dayMinuteCount) * 100,
    compact: durationMinutes < compactSliceThresholdMinutes,
  };
}

export function getCurrentTimeScrollTop({
  minute,
  containerHeight,
  timelineHeight,
}: {
  minute: number;
  containerHeight: number;
  timelineHeight: number;
}): number {
  const targetTop = (clampMinute(minute) / dayMinuteCount) * timelineHeight;
  const centeredTop = targetTop - containerHeight / 2;
  const maxScrollTop = Math.max(timelineHeight - containerHeight, 0);

  return Math.min(Math.max(centeredTop, 0), maxScrollTop);
}

function clampMinute(minute: number): number {
  return Math.min(Math.max(minute, 0), dayMinuteCount);
}
