import { addDays, format, isAfter, startOfDay, startOfWeek } from "date-fns";

const dateTimeLocalFormat = "yyyy-MM-dd'T'HH:mm";

export type DateShortcutId =
  | "now"
  | "today-morning"
  | "tomorrow-morning"
  | "today-evening"
  | "tomorrow-evening"
  | "this-friday-evening"
  | "next-monday-evening";

export interface DateShortcutDefinition {
  id: DateShortcutId;
  label: string;
}

export interface DateShortcutOption extends DateShortcutDefinition {
  value: string;
}

export const startDateShortcuts: DateShortcutDefinition[] = [
  { id: "now", label: "现在" },
  { id: "today-morning", label: "今天 09:00" },
  { id: "tomorrow-morning", label: "明天 09:00" },
];

export const endDateShortcuts: DateShortcutDefinition[] = [
  { id: "today-evening", label: "今天 18:00" },
  { id: "tomorrow-evening", label: "明天 18:00" },
  { id: "this-friday-evening", label: "本周五 18:00" },
  { id: "next-monday-evening", label: "下周一 18:00" },
];

export function buildDateShortcutOptions(
  shortcuts: DateShortcutDefinition[],
  now = new Date(),
): DateShortcutOption[] {
  return shortcuts.map((shortcut) => ({
    ...shortcut,
    value: resolveDateShortcutValue(shortcut.id, now),
  }));
}

export function resolveDateShortcutValue(
  id: DateShortcutId,
  now = new Date(),
): string {
  switch (id) {
    case "now":
      return format(now, dateTimeLocalFormat);
    case "today-morning":
      return format(atLocalTime(now, 9), dateTimeLocalFormat);
    case "tomorrow-morning":
      return format(atLocalTime(addDays(now, 1), 9), dateTimeLocalFormat);
    case "today-evening":
      return format(atLocalTime(now, 18), dateTimeLocalFormat);
    case "tomorrow-evening":
      return format(atLocalTime(addDays(now, 1), 18), dateTimeLocalFormat);
    case "this-friday-evening":
      return format(atLocalTime(getUpcomingFriday(now), 18), dateTimeLocalFormat);
    case "next-monday-evening":
      return format(atLocalTime(getNextMonday(now), 18), dateTimeLocalFormat);
  }
}

function atLocalTime(date: Date, hour: number): Date {
  const localDate = new Date(date);
  localDate.setHours(hour, 0, 0, 0);
  return localDate;
}

function getUpcomingFriday(now: Date): Date {
  const monday = startOfWeek(now, { weekStartsOn: 1 });
  const friday = addDays(monday, 4);

  return isAfter(startOfDay(now), startOfDay(friday))
    ? addDays(friday, 7)
    : friday;
}

function getNextMonday(now: Date): Date {
  return addDays(startOfWeek(now, { weekStartsOn: 1 }), 7);
}
