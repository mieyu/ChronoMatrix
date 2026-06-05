import { Children, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Clock3, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { completePlan } from "@/data/plans";
import { getPlanMatrixPlacement, type Plan } from "@/domain/plan";
import { formatPlanTime, formatTimePressure } from "@/lib/dates";
import { useUiStore } from "@/state/ui";

interface MatrixViewProps {
  plans: Plan[];
  now: Date;
}

export function MatrixView({ plans, now }: MatrixViewProps) {
  const openEditDialog = useUiStore((state) => state.openEditDialog);
  const queryClient = useQueryClient();
  const completeMutation = useMutation({
    mutationFn: completePlan,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["plans"] }),
  });

  const placements = plans.map((plan) => ({
    plan,
    placement: getPlanMatrixPlacement(plan, now),
  }));
  const matrixPlans = placements.filter(({ placement }) => placement.bucket === "matrix");
  const expiredPlans = placements.filter(({ placement }) => placement.bucket === "expired");
  const unscheduledPlans = placements.filter(
    ({ placement }) => placement.bucket === "unscheduled",
  );

  return (
    <div className="grid min-h-0 grid-cols-[1fr_320px] gap-4">
      <Card className="min-h-0 overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between border-b">
          <div>
            <CardTitle>艾森豪威尔矩阵</CardTitle>
            <p className="text-sm text-muted-foreground">
              越靠近中心，时间压力越高。
            </p>
          </div>
          <Badge variant="secondary">{matrixPlans.length} 个计划</Badge>
        </CardHeader>
        <CardContent className="p-0">
          <div className="relative h-[calc(100vh-210px)] min-h-[520px] overflow-hidden bg-background">
            <div className="absolute inset-x-0 top-1/2 z-0 h-px bg-border" />
            <div className="absolute inset-y-0 left-1/2 z-0 w-px bg-border" />
            <div className="absolute left-1/2 top-1/2 z-0 size-28 -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-foreground/20 bg-muted/50" />

            <QuadrantLabel className="left-4 top-4" title="重要 / 不紧急" />
            <QuadrantLabel className="right-4 top-4" title="重要 / 紧急" />
            <QuadrantLabel className="bottom-4 left-4" title="不重要 / 不紧急" />
            <QuadrantLabel className="bottom-4 right-4" title="不重要 / 紧急" />

            {matrixPlans.map(({ plan, placement }) => {
              if (placement.bucket !== "matrix") {
                return null;
              }

              return (
                <button
                  key={plan.id}
                  type="button"
                  className="absolute z-10 w-44 -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-card p-2 text-left shadow-sm transition hover:z-50 hover:border-ring hover:shadow-md focus-visible:z-50 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  style={{
                    left: `${50 + placement.x * 42}%`,
                    top: `${50 - placement.y * 42}%`,
                  }}
                  onClick={() => openEditDialog(plan)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="line-clamp-2 text-sm font-medium leading-snug">
                      {plan.title}
                    </span>
                    <Badge variant="outline" className="shrink-0">
                      {plan.importanceScore}
                    </Badge>
                  </div>
                  <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock3 className="size-3" />
                    {formatTimePressure(plan.endAt ?? plan.startAt, now)}
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid min-h-0 grid-rows-[1fr_1fr] gap-4">
        <SidePanel
          title="已过期计划"
          icon={<AlertTriangle className="size-4 text-destructive" />}
          empty="暂无过期计划"
        >
          {expiredPlans.map(({ plan }) => (
            <PlanListItem key={plan.id} plan={plan} danger>
              <Button
                size="icon-sm"
                variant="ghost"
                title="标记完成"
                onClick={() => completeMutation.mutate(plan.id)}
              >
                <CheckCircle2 />
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                title="编辑或延长时间"
                onClick={() => openEditDialog(plan)}
              >
                <Pencil />
              </Button>
            </PlanListItem>
          ))}
        </SidePanel>

        <SidePanel title="未排期" empty="没有未排期计划">
          {unscheduledPlans.map(({ plan }) => (
            <PlanListItem key={plan.id} plan={plan}>
              <Button
                size="icon-sm"
                variant="ghost"
                title="编辑"
                onClick={() => openEditDialog(plan)}
              >
                <Pencil />
              </Button>
            </PlanListItem>
          ))}
        </SidePanel>
      </div>
    </div>
  );
}

function QuadrantLabel({
  title,
  className,
}: {
  title: string;
  className: string;
}) {
  return (
    <div className={`absolute z-20 rounded-md bg-muted px-2 py-1 text-xs ${className}`}>
      {title}
    </div>
  );
}

function SidePanel({
  title,
  icon,
  empty,
  children,
}: {
  title: string;
  icon?: ReactNode;
  empty: string;
  children: ReactNode;
}) {
  const hasChildren = Children.count(children) > 0;

  return (
    <Card className="min-h-0">
      <CardHeader className="border-b py-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="min-h-0 p-0">
        <ScrollArea className="h-[calc((100vh-230px)/2)] min-h-56">
          <div className="p-3">
            {hasChildren ? (
              <div className="grid gap-2">{children}</div>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {empty}
              </p>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function PlanListItem({
  plan,
  danger = false,
  children,
}: {
  plan: Plan;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{plan.title}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            截止：{formatPlanTime(plan.endAt)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">{children}</div>
      </div>
      {danger ? <Separator className="my-2" /> : null}
      {danger ? (
        <p className="text-xs text-destructive">
          {formatTimePressure(plan.endAt, new Date())}
        </p>
      ) : null}
    </div>
  );
}
