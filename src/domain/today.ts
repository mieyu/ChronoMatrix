import { isSameDay } from "date-fns";
import { importantScoreThreshold } from "./importance";
import { deriveEffectiveStatus, type Plan } from "./plan";

export type TodaySectionId =
  | "expired"
  | "due_today"
  | "starts_today"
  | "important_unscheduled";

export interface TodaySection {
  id: TodaySectionId;
  title: string;
  description: string;
  emptyLabel: string;
  plans: Plan[];
}

const sectionMeta: Omit<TodaySection, "plans">[] = [
  {
    id: "expired",
    title: "已过期",
    description: "需要处理或重新安排的计划",
    emptyLabel: "没有过期计划",
  },
  {
    id: "due_today",
    title: "今天截止",
    description: "今天必须交付或结束",
    emptyLabel: "今天没有截止计划",
  },
  {
    id: "starts_today",
    title: "今天开始",
    description: "今天进入执行窗口",
    emptyLabel: "今天没有新开始的计划",
  },
  {
    id: "important_unscheduled",
    title: "重要未排期",
    description: "值得今天顺手安排时间",
    emptyLabel: "没有重要未排期计划",
  },
];

export function buildTodaySections(
  plans: Plan[],
  now = new Date(),
): TodaySection[] {
  const groups: Record<TodaySectionId, Plan[]> = {
    expired: [],
    due_today: [],
    starts_today: [],
    important_unscheduled: [],
  };

  for (const plan of plans) {
    const section = getTodaySectionId(plan, now);

    if (section) {
      groups[section].push(plan);
    }
  }

  groups.expired.sort((a, b) => getTime(a.endAt) - getTime(b.endAt));
  groups.due_today.sort((a, b) => getTime(a.endAt) - getTime(b.endAt));
  groups.starts_today.sort((a, b) => getTime(a.startAt) - getTime(b.startAt));
  groups.important_unscheduled.sort(
    (a, b) =>
      b.importanceScore - a.importanceScore ||
      getTime(b.updatedAt) - getTime(a.updatedAt),
  );

  return sectionMeta.map((section) => ({
    ...section,
    plans: groups[section.id],
  }));
}

export function getTodayPlanCount(sections: TodaySection[]): number {
  return sections.reduce((total, section) => total + section.plans.length, 0);
}

function getTodaySectionId(plan: Plan, now: Date): TodaySectionId | null {
  const effectiveStatus = deriveEffectiveStatus(plan, now);

  if (effectiveStatus === "completed" || effectiveStatus === "archived") {
    return null;
  }

  if (effectiveStatus === "expired") {
    return "expired";
  }

  if (plan.endAt && isSameDay(new Date(plan.endAt), now)) {
    return "due_today";
  }

  if (plan.startAt && isSameDay(new Date(plan.startAt), now)) {
    return "starts_today";
  }

  if (!plan.startAt && !plan.endAt && plan.importanceScore >= importantScoreThreshold) {
    return "important_unscheduled";
  }

  return null;
}

function getTime(iso: string | null): number {
  return iso ? new Date(iso).getTime() : Number.POSITIVE_INFINITY;
}
