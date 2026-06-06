import { format, startOfDay, startOfWeek, subDays } from "date-fns";
import { importantScoreThreshold } from "./importance";
import {
  defaultMatrixRules,
  deriveEffectiveStatus,
  type MatrixQuadrant,
  type Plan,
} from "./plan";

export type ReviewPeriodId = "this_week" | "last_7_days" | "last_30_days";

export interface ReviewPeriodRange {
  id: ReviewPeriodId;
  label: string;
  startAt: Date;
  endAt: Date;
  startKey: string;
}

export interface ReviewMetrics {
  createdCount: number;
  completedCount: number;
  completionRate: number;
  expiredCount: number;
  completedImportantCount: number;
  expiredImportantCount: number;
}

export interface ReviewQuadrantStats {
  quadrant: MatrixQuadrant;
  title: string;
  total: number;
  completed: number;
  expired: number;
  unfinished: number;
}

export interface ReviewStats {
  period: ReviewPeriodRange;
  metrics: ReviewMetrics;
  quadrants: Record<MatrixQuadrant, ReviewQuadrantStats>;
  quadrantSummaries: ReviewQuadrantStats[];
  completedPlans: Plan[];
  expiredPlans: Plan[];
  importantUnscheduledPlans: Plan[];
}

const periodLabels: Record<ReviewPeriodId, string> = {
  this_week: "本周",
  last_7_days: "近 7 天",
  last_30_days: "近 30 天",
};

const quadrantTitles: Record<MatrixQuadrant, string> = {
  "important-urgent": "重要 / 紧急",
  "important-not-urgent": "重要 / 不紧急",
  "not-important-urgent": "不重要 / 紧急",
  "not-important-not-urgent": "不重要 / 不紧急",
};

const quadrantOrder: MatrixQuadrant[] = [
  "important-urgent",
  "important-not-urgent",
  "not-important-urgent",
  "not-important-not-urgent",
];

export function getReviewPeriodRange(
  id: ReviewPeriodId,
  now: Date,
): ReviewPeriodRange {
  const startAt =
    id === "this_week"
      ? startOfWeek(now, { weekStartsOn: 1 })
      : startOfDay(subDays(now, id === "last_7_days" ? 6 : 29));

  return {
    id,
    label: periodLabels[id],
    startAt,
    endAt: now,
    startKey: format(startAt, "yyyy-MM-dd"),
  };
}

export function buildReviewStats(
  plans: Plan[],
  now: Date,
  periodId: ReviewPeriodId,
): ReviewStats {
  const period = getReviewPeriodRange(periodId, now);
  const createdPlans = plans.filter((plan) => isInPeriod(plan.createdAt, period));
  const completedPlans = plans
    .filter((plan) => plan.completedAt && isInPeriod(plan.completedAt, period))
    .sort((a, b) => compareIsoDesc(a.completedAt, b.completedAt));
  const completedCreatedPlans = createdPlans.filter(
    (plan) => plan.storedStatus === "completed" && plan.completedAt,
  );
  const expiredPlans = plans
    .filter((plan) => deriveEffectiveStatus(plan, now) === "expired")
    .sort((a, b) => compareReferenceAsc(a, b));
  const importantUnscheduledPlans = plans
    .filter((plan) => {
      const status = deriveEffectiveStatus(plan, now);

      return (
        status !== "completed" &&
        status !== "archived" &&
        status !== "expired" &&
        !plan.startAt &&
        !plan.endAt &&
        isImportant(plan)
      );
    })
    .sort((a, b) => {
      const importanceDelta = b.importanceScore - a.importanceScore;

      return importanceDelta || compareIsoDesc(a.updatedAt, b.updatedAt);
    });
  const quadrants = createEmptyQuadrants();

  for (const plan of plans) {
    if (plan.storedStatus === "archived") {
      continue;
    }

    const quadrant = getCurrentReviewQuadrant(plan, now);

    if (!quadrant) {
      continue;
    }

    const status = deriveEffectiveStatus(plan, now);
    const summary = quadrants[quadrant];
    summary.total += 1;

    if (status === "completed") {
      summary.completed += 1;
    } else if (status === "expired") {
      summary.expired += 1;
    } else {
      summary.unfinished += 1;
    }
  }

  return {
    period,
    metrics: {
      createdCount: createdPlans.length,
      completedCount: completedPlans.length,
      completionRate:
        createdPlans.length === 0
          ? 0
          : completedCreatedPlans.length / createdPlans.length,
      expiredCount: expiredPlans.length,
      completedImportantCount: completedPlans.filter(isImportant).length,
      expiredImportantCount: expiredPlans.filter(isImportant).length,
    },
    quadrants,
    quadrantSummaries: quadrantOrder.map((quadrant) => quadrants[quadrant]),
    completedPlans,
    expiredPlans,
    importantUnscheduledPlans,
  };
}

function createEmptyQuadrants(): Record<MatrixQuadrant, ReviewQuadrantStats> {
  return Object.fromEntries(
    quadrantOrder.map((quadrant) => [
      quadrant,
      {
        quadrant,
        title: quadrantTitles[quadrant],
        total: 0,
        completed: 0,
        expired: 0,
        unfinished: 0,
      },
    ]),
  ) as Record<MatrixQuadrant, ReviewQuadrantStats>;
}

function getCurrentReviewQuadrant(
  plan: Plan,
  now: Date,
): MatrixQuadrant | null {
  const referenceAt = plan.endAt ?? plan.startAt;

  if (!referenceAt) {
    return null;
  }

  const referenceTime = new Date(referenceAt).getTime();
  const urgentWindowMs = defaultMatrixRules.urgentWindowHours * 60 * 60 * 1000;
  const urgent = referenceTime - now.getTime() <= urgentWindowMs;
  const important = isImportant(plan);

  if (important && urgent) {
    return "important-urgent";
  }

  if (important) {
    return "important-not-urgent";
  }

  if (urgent) {
    return "not-important-urgent";
  }

  return "not-important-not-urgent";
}

function isImportant(plan: Plan): boolean {
  return plan.importanceScore >= importantScoreThreshold;
}

function isInPeriod(value: string | null, period: ReviewPeriodRange): boolean {
  if (!value) {
    return false;
  }

  const time = new Date(value).getTime();
  return time >= period.startAt.getTime() && time <= period.endAt.getTime();
}

function compareIsoDesc(a: string | null, b: string | null): number {
  return new Date(b ?? 0).getTime() - new Date(a ?? 0).getTime();
}

function compareReferenceAsc(a: Plan, b: Plan): number {
  const aReference = a.endAt ?? a.startAt ?? a.updatedAt;
  const bReference = b.endAt ?? b.startAt ?? b.updatedAt;

  return new Date(aReference).getTime() - new Date(bReference).getTime();
}
