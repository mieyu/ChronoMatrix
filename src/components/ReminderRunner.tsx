import { useEffect, useRef } from "react";
import { markReminderKeysSent, listSentReminderKeys } from "@/data/reminders";
import {
  buildPlanReminderCandidates,
  type PlanReminderCandidate,
  type PlanReminderRules,
} from "@/domain/reminders";
import type { Plan } from "@/domain/plan";
import { formatPlanTime } from "@/lib/dates";

interface ReminderRunnerProps {
  plans: Plan[];
  now: Date;
  rules: PlanReminderRules;
}

const maxNotificationsPerPass = 3;

export function ReminderRunner({ plans, now, rules }: ReminderRunnerProps) {
  const inFlightRef = useRef(false);

  useEffect(() => {
    if (!isTauriRuntime() || inFlightRef.current) {
      return;
    }

    const candidates = buildPlanReminderCandidates(
      plans,
      now,
      listSentReminderKeys(),
      rules,
    ).slice(0, maxNotificationsPerPass);

    if (candidates.length === 0) {
      return;
    }

    inFlightRef.current = true;
    void sendReminderNotifications(candidates).finally(() => {
      inFlightRef.current = false;
    });
  }, [now, plans, rules]);

  return null;
}

async function sendReminderNotifications(
  candidates: PlanReminderCandidate[],
): Promise<void> {
  try {
    const {
      isPermissionGranted,
      requestPermission,
      sendNotification,
    } = await import("@tauri-apps/plugin-notification");
    let permissionGranted = await isPermissionGranted();

    if (!permissionGranted) {
      const permission = await requestPermission();
      permissionGranted = permission === "granted";
    }

    if (!permissionGranted) {
      return;
    }

    const sentKeys: string[] = [];

    for (const candidate of candidates) {
      sendNotification({
        title: getNotificationTitle(candidate),
        body: getNotificationBody(candidate),
      });
      sentKeys.push(candidate.key);
    }

    markReminderKeysSent(sentKeys);
  } catch (error) {
    console.warn("Failed to send plan reminders", error);
  }
}

function getNotificationTitle(candidate: PlanReminderCandidate): string {
  return candidate.kind === "expired" ? "计划已过期" : "计划即将截止";
}

function getNotificationBody(candidate: PlanReminderCandidate): string {
  const deadline = formatPlanTime(candidate.dueAt);

  return candidate.kind === "expired"
    ? `${candidate.plan.title} 已超过截止时间 ${deadline}`
    : `${candidate.plan.title} 将在 ${deadline} 截止`;
}

function isTauriRuntime(): boolean {
  return (
    typeof window !== "undefined" &&
    "__TAURI_INTERNALS__" in (window as Window & { __TAURI_INTERNALS__?: unknown })
  );
}
