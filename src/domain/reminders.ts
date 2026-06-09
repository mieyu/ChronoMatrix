import { deriveEffectiveStatus, type Plan } from "./plan";

export type PlanReminderKind = "due_soon" | "expired";

export interface PlanReminderCandidate {
  key: string;
  kind: PlanReminderKind;
  plan: Plan;
  dueAt: string;
}

export interface PlanReminderRules {
  enabled?: boolean;
  dueSoonMinutes: number;
}

const defaultRules: PlanReminderRules = {
  enabled: true,
  dueSoonMinutes: 30,
};

export function buildPlanReminderCandidates(
  plans: Plan[],
  now: Date,
  sentKeys: ReadonlySet<string>,
  rules: PlanReminderRules = defaultRules,
): PlanReminderCandidate[] {
  if (rules.enabled === false) {
    return [];
  }

  return plans
    .flatMap((plan) => getPlanReminderCandidate(plan, now, sentKeys, rules))
    .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
}

export function getPlanReminderKey(
  plan: Plan,
  kind: PlanReminderKind,
): string {
  return `${plan.id}:${kind}:${plan.endAt ?? "no-end"}`;
}

function getPlanReminderCandidate(
  plan: Plan,
  now: Date,
  sentKeys: ReadonlySet<string>,
  rules: PlanReminderRules,
): PlanReminderCandidate[] {
  if (!plan.endAt) {
    return [];
  }

  const status = deriveEffectiveStatus(plan, now);

  if (status === "completed" || status === "archived") {
    return [];
  }

  const dueAt = new Date(plan.endAt);
  const dueSoonWindowMs = rules.dueSoonMinutes * 60 * 1000;
  const timeUntilDueMs = dueAt.getTime() - now.getTime();
  const dueSoon =
    rules.dueSoonMinutes > 0 &&
    timeUntilDueMs >= 0 &&
    timeUntilDueMs <= dueSoonWindowMs;
  const kind =
    status === "expired"
      ? "expired"
      : dueSoon
        ? "due_soon"
        : null;

  if (!kind) {
    return [];
  }

  const key = getPlanReminderKey(plan, kind);

  if (sentKeys.has(key)) {
    return [];
  }

  return [
    {
      key,
      kind,
      plan,
      dueAt: plan.endAt,
    },
  ];
}
