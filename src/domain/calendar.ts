import {
  addDays,
  differenceInCalendarDays,
  endOfMonth,
  endOfWeek,
  isSameDay,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import type { Plan } from "./plan";

export type CalendarMode = "week" | "month";
export type CalendarMarkerKind = "start" | "end";

export interface CalendarMarker {
  kind: CalendarMarkerKind;
  at: string;
}

export interface CalendarEntry {
  plan: Plan;
  markers: CalendarMarker[];
}

export interface CalendarSpan {
  plan: Plan;
  startAt: string;
  endAt: string;
  startIndex: number;
  endIndex: number;
  isStartVisible: boolean;
  isEndVisible: boolean;
}

export function getCalendarDays(mode: CalendarMode, anchor: Date): Date[] {
  const start =
    mode === "week"
      ? startOfWeek(anchor, { weekStartsOn: 1 })
      : startOfWeek(startOfMonth(anchor), { weekStartsOn: 1 });
  const end =
    mode === "week"
      ? endOfWeek(anchor, { weekStartsOn: 1 })
      : endOfWeek(endOfMonth(anchor), { weekStartsOn: 1 });
  const days: Date[] = [];

  for (let day = startOfDay(start); day <= end; day = addDays(day, 1)) {
    days.push(day);
  }

  return days;
}

export function getCalendarEntriesForDay(
  plans: Plan[],
  day: Date,
): CalendarEntry[] {
  return plans
    .filter((plan) => !hasCompleteRange(plan))
    .map((plan) => ({
      plan,
      markers: getMarkersForDay(plan, day),
    }))
    .filter((entry) => entry.markers.length > 0)
    .sort((a, b) => firstMarkerTime(a) - firstMarkerTime(b));
}

export function getCalendarSpansForWeek(
  plans: Plan[],
  weekDays: Date[],
): CalendarSpan[] {
  const weekStart = startOfDay(weekDays[0] ?? new Date());
  const weekEnd = startOfDay(weekDays[6] ?? weekStart);

  return plans
    .filter(hasCompleteRange)
    .flatMap((plan) => {
      const startAt = plan.startAt!;
      const endAt = plan.endAt!;
      const rangeStart = startOfDay(new Date(startAt));
      const rangeEnd = startOfDay(new Date(endAt));

      if (rangeStart > weekEnd || rangeEnd < weekStart) {
        return [];
      }

      const visibleStart = maxDate(rangeStart, weekStart);
      const visibleEnd = minDate(rangeEnd, weekEnd);

      return [
        {
          plan,
          startAt,
          endAt,
          startIndex: differenceInCalendarDays(visibleStart, weekStart),
          endIndex: differenceInCalendarDays(visibleEnd, weekStart),
          isStartVisible: isSameDay(rangeStart, visibleStart),
          isEndVisible: isSameDay(rangeEnd, visibleEnd),
        },
      ];
    })
    .sort((a, b) => {
      const startDiff =
        new Date(a.startAt).getTime() - new Date(b.startAt).getTime();

      if (startDiff !== 0) {
        return startDiff;
      }

      return b.endIndex - b.startIndex - (a.endIndex - a.startIndex);
    });
}

export function getUnscheduledPlans(plans: Plan[]): Plan[] {
  return plans.filter((plan) => !plan.startAt && !plan.endAt);
}

function getMarkersForDay(plan: Plan, day: Date): CalendarMarker[] {
  const markers: CalendarMarker[] = [];

  if (plan.startAt && isSameDay(new Date(plan.startAt), day)) {
    markers.push({ kind: "start", at: plan.startAt });
  }

  if (plan.endAt && isSameDay(new Date(plan.endAt), day)) {
    markers.push({ kind: "end", at: plan.endAt });
  }

  return markers;
}

function firstMarkerTime(entry: CalendarEntry): number {
  return new Date(entry.markers[0]?.at ?? entry.plan.updatedAt).getTime();
}

function hasCompleteRange(plan: Plan): plan is Plan & {
  startAt: string;
  endAt: string;
} {
  return Boolean(
    plan.startAt &&
      plan.endAt &&
      new Date(plan.startAt).getTime() <= new Date(plan.endAt).getTime(),
  );
}

function maxDate(a: Date, b: Date): Date {
  return a > b ? a : b;
}

function minDate(a: Date, b: Date): Date {
  return a < b ? a : b;
}
