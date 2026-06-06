import { differenceInMilliseconds } from "date-fns";
import { importantScoreThreshold } from "./importance";

export type StoredPlanStatus =
  | "not_started"
  | "in_progress"
  | "completed"
  | "archived";

export type EffectivePlanStatus = StoredPlanStatus | "expired";

export type MatrixQuadrant =
  | "important-urgent"
  | "important-not-urgent"
  | "not-important-urgent"
  | "not-important-not-urgent";

export interface Plan {
  id: string;
  title: string;
  description: string;
  importanceScore: number;
  startAt: string | null;
  endAt: string | null;
  storedStatus: StoredPlanStatus;
  categoryId: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  archivedAt: string | null;
}

export interface MatrixRules {
  urgentWindowHours: number;
  pressureHorizonDays: number;
  importantThreshold: number;
}

export type PlanMatrixPlacement =
  | {
      bucket: "matrix";
      effectiveStatus: EffectivePlanStatus;
      quadrant: MatrixQuadrant;
      x: number;
      y: number;
      radius: number;
      pressure: number;
    }
  | {
      bucket: "unscheduled" | "expired" | "completed" | "archived";
      effectiveStatus: EffectivePlanStatus;
    };

export const defaultMatrixRules: MatrixRules = {
  urgentWindowHours: 72,
  pressureHorizonDays: 14,
  importantThreshold: importantScoreThreshold,
};

export function deriveEffectiveStatus(
  plan: Plan,
  now: Date = new Date(),
): EffectivePlanStatus {
  if (plan.storedStatus === "completed") {
    return "completed";
  }

  if (plan.storedStatus === "archived") {
    return "archived";
  }

  if (plan.endAt && new Date(plan.endAt).getTime() < now.getTime()) {
    return "expired";
  }

  if (plan.startAt && new Date(plan.startAt).getTime() <= now.getTime()) {
    return "in_progress";
  }

  return plan.storedStatus;
}

export function getPlanMatrixPlacement(
  plan: Plan,
  now: Date = new Date(),
  rules: MatrixRules = defaultMatrixRules,
): PlanMatrixPlacement {
  const effectiveStatus = deriveEffectiveStatus(plan, now);

  if (effectiveStatus === "completed") {
    return { bucket: "completed", effectiveStatus };
  }

  if (effectiveStatus === "archived") {
    return { bucket: "archived", effectiveStatus };
  }

  if (effectiveStatus === "expired") {
    return { bucket: "expired", effectiveStatus };
  }

  const referenceAt = plan.endAt ?? plan.startAt;

  if (!referenceAt) {
    return { bucket: "unscheduled", effectiveStatus };
  }

  const timeLeftMs = differenceInMilliseconds(new Date(referenceAt), now);
  const urgentWindowMs = rules.urgentWindowHours * 60 * 60 * 1000;
  const pressureHorizonMs = rules.pressureHorizonDays * 24 * 60 * 60 * 1000;
  const important = plan.importanceScore >= rules.importantThreshold;
  const urgent = timeLeftMs <= urgentWindowMs;
  const pressure = 1 - clamp(timeLeftMs / pressureHorizonMs, 0, 1);
  const radius = lerp(0.86, 0.18, pressure);
  const quadrant = getQuadrant(important, urgent);

  return {
    bucket: "matrix",
    effectiveStatus,
    quadrant,
    x: (urgent ? 1 : -1) * radius,
    y: (important ? 1 : -1) * radius,
    radius,
    pressure,
  };
}

function getQuadrant(important: boolean, urgent: boolean): MatrixQuadrant {
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

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function lerp(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
}
