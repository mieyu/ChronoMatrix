import { Badge } from "@/components/ui/badge";
import type { EffectivePlanStatus } from "@/domain/plan";
import { cn } from "@/lib/utils";

export const planStatusLabels: Record<EffectivePlanStatus, string> = {
  not_started: "未开始",
  in_progress: "进行中",
  completed: "已完成",
  expired: "已过期",
  archived: "已归档",
};

const planStatusClasses: Record<EffectivePlanStatus, string> = {
  not_started: "border-slate-200 bg-slate-50 text-slate-600",
  in_progress: "border-sky-100 bg-sky-50 text-sky-700",
  completed: "border-emerald-100 bg-emerald-50 text-emerald-700",
  expired: "border-rose-100 bg-rose-50 text-rose-700",
  archived: "border-zinc-200 bg-zinc-50 text-zinc-500",
};

export function StatusBadge({
  status,
  className,
}: {
  status: EffectivePlanStatus;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn("w-fit font-medium", planStatusClasses[status], className)}
    >
      {planStatusLabels[status]}
    </Badge>
  );
}
