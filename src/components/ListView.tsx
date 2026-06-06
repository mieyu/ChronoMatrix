import { useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { completePlan } from "@/data/plans";
import { deriveEffectiveStatus, type Plan } from "@/domain/plan";
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

  const sortedPlans = useMemo(
    () =>
      [...plans].sort((a, b) => {
        const aStatus = deriveEffectiveStatus(a, now);
        const bStatus = deriveEffectiveStatus(b, now);

        if (aStatus === "expired" && bStatus !== "expired") {
          return -1;
        }

        if (bStatus === "expired" && aStatus !== "expired") {
          return 1;
        }

        return getReferenceTime(a) - getReferenceTime(b);
      }),
    [plans, now],
  );

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
          {sortedPlans.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">
              还没有计划。
            </p>
          ) : (
            sortedPlans.map((plan) => {
              const status = deriveEffectiveStatus(plan, now);

              return (
                <div
                  key={plan.id}
                  className="grid grid-cols-[1fr_110px_150px_150px_120px] items-center border-b px-4 py-3 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{plan.title}</p>
                    <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                      {plan.description || "无描述"}
                    </p>
                  </div>
                  <span className="tabular-nums">{plan.importanceScore}/10</span>
                  <StatusBadge status={status} />
                  <span className="text-muted-foreground">
                    {formatPlanTime(plan.endAt)}
                  </span>
                  <div className="flex justify-end gap-1">
                    {status !== "completed" && status !== "archived" ? (
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        title="标记完成"
                        onClick={() => completeMutation.mutate(plan.id)}
                      >
                        <CheckCircle2 />
                      </Button>
                    ) : null}
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      title="编辑"
                      onClick={() => openEditDialog(plan)}
                    >
                      <Pencil />
                    </Button>
                  </div>
                </div>
              );
            })
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
