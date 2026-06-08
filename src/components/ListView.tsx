import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Pencil,
  RotateCcw,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { completePlan, restoreArchivedPlan } from "@/data/plans";
import { deriveEffectiveStatus, type EffectivePlanStatus, type Plan } from "@/domain/plan";
import { formatPlanTime } from "@/lib/dates";
import { useUiStore } from "@/state/ui";

interface ListViewProps {
  plans: Plan[];
  now: Date;
}

export function ListView({ plans, now }: ListViewProps) {
  const openEditDialog = useUiStore((state) => state.openEditDialog);
  const queryClient = useQueryClient();
  const completeMutation = useMutation({
    mutationFn: completePlan,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["plans"] }),
  });
  const restoreMutation = useMutation({
    mutationFn: restoreArchivedPlan,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["plans"] }),
  });
  const [completedExpanded, setCompletedExpanded] = useState(false);

  const { activePlans, completedPlans } = useMemo(() => {
    const active: Plan[] = [];
    const completed: Plan[] = [];

    for (const plan of plans) {
      if (deriveEffectiveStatus(plan, now) === "completed") {
        completed.push(plan);
      } else {
        active.push(plan);
      }
    }

    active.sort((a, b) => {
      const aStatus = deriveEffectiveStatus(a, now);
      const bStatus = deriveEffectiveStatus(b, now);

      if (aStatus === "expired" && bStatus !== "expired") {
        return -1;
      }

      if (bStatus === "expired" && aStatus !== "expired") {
        return 1;
      }

      return getReferenceTime(a) - getReferenceTime(b);
    });

    completed.sort((a, b) => getCompletionTime(b) - getCompletionTime(a));

    return { activePlans: active, completedPlans: completed };
  }, [plans, now]);

  const hasNoPlans = activePlans.length === 0 && completedPlans.length === 0;

  return (
    <Card className="min-h-0">
      <CardHeader className="flex flex-row items-center justify-between border-b">
        <div>
          <CardTitle>计划列表</CardTitle>
          <p className="text-sm text-muted-foreground">
            按过期优先和时间顺序展示全部计划。
          </p>
        </div>
        <Badge variant="secondary">{plans.length} 个计划</Badge>
      </CardHeader>
      <CardContent className="p-0">
        <div className="grid max-h-[calc(100vh-210px)] overflow-auto">
          <div className="grid grid-cols-[1fr_110px_150px_150px_120px] border-b bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground">
            <span>标题</span>
            <span>重要度</span>
            <span>状态</span>
            <span>截止</span>
            <span className="text-right">操作</span>
          </div>
          {hasNoPlans ? (
            <p className="py-16 text-center text-sm text-muted-foreground">
              还没有计划。
            </p>
          ) : (
            <>
              {activePlans.map((plan) => (
                <PlanRow
                  key={plan.id}
                  plan={plan}
                  status={deriveEffectiveStatus(plan, now)}
                  onComplete={() => completeMutation.mutate(plan.id)}
                  onRestore={() => restoreMutation.mutate(plan.id)}
                  onEdit={() => openEditDialog(plan)}
                />
              ))}

              {completedPlans.length > 0 ? (
                <>
                  <button
                    type="button"
                    className="flex items-center gap-2 border-b bg-muted/30 px-4 py-2.5 text-left text-sm font-medium text-muted-foreground transition hover:bg-muted/60"
                    onClick={() => setCompletedExpanded((value) => !value)}
                    aria-expanded={completedExpanded}
                  >
                    {completedExpanded ? (
                      <ChevronDown className="size-4" />
                    ) : (
                      <ChevronRight className="size-4" />
                    )}
                    <CheckCircle2 className="size-4 text-emerald-600" />
                    已完成
                    <span className="tabular-nums">({completedPlans.length})</span>
                  </button>

                  {completedExpanded
                    ? completedPlans.map((plan) => (
                        <PlanRow
                          key={plan.id}
                          plan={plan}
                          status={deriveEffectiveStatus(plan, now)}
                          onComplete={() => completeMutation.mutate(plan.id)}
                          onRestore={() => restoreMutation.mutate(plan.id)}
                          onEdit={() => openEditDialog(plan)}
                        />
                      ))
                    : null}
                </>
              ) : null}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function getReferenceTime(plan: Plan): number {
  const reference = plan.endAt ?? plan.startAt ?? plan.updatedAt;
  return new Date(reference).getTime();
}

function getCompletionTime(plan: Plan): number {
  const reference = plan.completedAt ?? plan.updatedAt;
  return new Date(reference).getTime();
}

function PlanRow({
  plan,
  status,
  onComplete,
  onRestore,
  onEdit,
}: {
  plan: Plan;
  status: EffectivePlanStatus;
  onComplete: () => void;
  onRestore: () => void;
  onEdit: () => void;
}) {
  return (
    <div className="grid grid-cols-[1fr_110px_150px_150px_120px] items-center border-b px-4 py-3 text-sm">
      <div className="min-w-0">
        <p className="truncate font-medium">{plan.title}</p>
        <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
          {plan.description || "无描述"}
        </p>
      </div>
      <span className="tabular-nums">{plan.importanceScore}</span>
      <StatusBadge status={status} />
      <span className="text-muted-foreground">{formatPlanTime(plan.endAt)}</span>
      <div className="flex justify-end gap-1">
        {status !== "completed" && status !== "archived" ? (
          <Button
            size="icon-sm"
            variant="ghost"
            title="标记完成"
            onClick={onComplete}
          >
            <CheckCircle2 />
          </Button>
        ) : null}
        {status === "archived" ? (
          <Button
            size="icon-sm"
            variant="ghost"
            title="恢复归档"
            onClick={onRestore}
          >
            <RotateCcw />
          </Button>
        ) : null}
        <Button size="icon-sm" variant="ghost" title="编辑" onClick={onEdit}>
          <Pencil />
        </Button>
      </div>
    </div>
  );
}
