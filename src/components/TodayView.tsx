import { useMemo, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Pencil,
  Sparkles,
} from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { completePlan } from "@/data/plans";
import {
  buildTodaySections,
  getTodayPlanCount,
  type TodaySection,
  type TodaySectionId,
} from "@/domain/today";
import type { Plan } from "@/domain/plan";
import { formatPlanTime } from "@/lib/dates";
import { useUiStore } from "@/state/ui";

interface TodayViewProps {
  plans: Plan[];
  now: Date;
}

const sectionIcons: Record<TodaySectionId, ReactNode> = {
  expired: <AlertTriangle className="size-4 text-rose-500" />,
  due_today: <CalendarClock className="size-4" />,
  starts_today: <Sparkles className="size-4" />,
  important_unscheduled: <CalendarClock className="size-4" />,
};

export function TodayView({ plans, now }: TodayViewProps) {
  const openEditDialog = useUiStore((state) => state.openEditDialog);
  const queryClient = useQueryClient();
  const completeMutation = useMutation({
    mutationFn: completePlan,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["plans"] }),
  });
  const sections = useMemo(() => buildTodaySections(plans, now), [plans, now]);
  const total = getTodayPlanCount(sections);

  return (
    <div className="grid min-h-0 grid-rows-[auto_1fr] gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between border-b py-4">
          <div>
            <CardTitle>今日计划</CardTitle>
            <p className="text-sm text-muted-foreground">
              {format(now, "yyyy-MM-dd")} · 先处理今天最需要看见的计划。
            </p>
          </div>
          <Badge variant={total > 0 ? "default" : "secondary"}>
            {total} 个今日关注
          </Badge>
        </CardHeader>
      </Card>

      <div className="grid min-h-0 grid-cols-2 gap-4">
        {sections.map((section) => (
          <TodaySectionCard
            key={section.id}
            section={section}
            onComplete={(plan) => completeMutation.mutate(plan.id)}
            onEdit={openEditDialog}
          />
        ))}
      </div>
    </div>
  );
}

function TodaySectionCard({
  section,
  onComplete,
  onEdit,
}: {
  section: TodaySection;
  onComplete: (plan: Plan) => void;
  onEdit: (plan: Plan) => void;
}) {
  return (
    <Card className="min-h-0 overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between border-b py-3">
        <div className="min-w-0">
          <CardTitle className="flex items-center gap-2 text-sm">
            {sectionIcons[section.id]}
            {section.title}
          </CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            {section.description}
          </p>
        </div>
        <Badge
          variant="outline"
          className={
            section.id === "expired"
              ? "border-rose-100 bg-rose-50 text-rose-700"
              : "border-slate-200 bg-slate-50 text-slate-600"
          }
        >
          {section.plans.length}
        </Badge>
      </CardHeader>
      <CardContent className="max-h-[calc((100vh-290px)/2)] min-h-48 overflow-auto p-0">
        {section.plans.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-muted-foreground">
            {section.emptyLabel}
          </p>
        ) : (
          <div className="grid">
            {section.plans.map((plan) => (
              <TodayPlanRow
                key={plan.id}
                plan={plan}
                sectionId={section.id}
                onComplete={onComplete}
                onEdit={onEdit}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TodayPlanRow({
  plan,
  sectionId,
  onComplete,
  onEdit,
}: {
  plan: Plan;
  sectionId: TodaySectionId;
  onComplete: (plan: Plan) => void;
  onEdit: (plan: Plan) => void;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-3 border-b px-4 py-3 text-sm last:border-b-0">
      <button
        type="button"
        className="min-w-0 text-left"
        onClick={() => onEdit(plan)}
      >
        <div className="flex items-center gap-2">
          <p className="truncate font-medium">{plan.title}</p>
          <Badge variant="outline" className="shrink-0">
            {plan.importanceScore}/10
          </Badge>
        </div>
        <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
          {plan.description || "无描述"}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          {getSectionTimeLabel(plan, sectionId)}
        </p>
      </button>
      <div className="flex gap-1">
        <Button
          size="icon-sm"
          variant="ghost"
          title="标记完成"
          onClick={() => onComplete(plan)}
        >
          <CheckCircle2 />
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          title="编辑"
          onClick={() => onEdit(plan)}
        >
          <Pencil />
        </Button>
      </div>
    </div>
  );
}

function getSectionTimeLabel(plan: Plan, sectionId: TodaySectionId): string {
  if (sectionId === "starts_today") {
    return `开始 ${formatPlanTime(plan.startAt)}`;
  }

  if (sectionId === "important_unscheduled") {
    return "未排期";
  }

  return `截止 ${formatPlanTime(plan.endAt)}`;
}
