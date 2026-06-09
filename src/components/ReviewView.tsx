import { useMemo, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  CalendarPlus,
  CheckCircle2,
  ClipboardList,
  Pencil,
  Target,
  TrendingUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  buildReviewStats,
  type ReviewPeriodId,
  type ReviewQuadrantStats,
} from "@/domain/reviewStats";
import {
  deriveEffectiveStatus,
  type MatrixRules,
  type Plan,
} from "@/domain/plan";
import { formatPlanTime } from "@/lib/dates";
import { useUiStore } from "@/state/ui";

interface ReviewViewProps {
  plans: Plan[];
  now: Date;
  matrixRules: MatrixRules;
}

const periodLabels: Record<ReviewPeriodId, string> = {
  this_week: "本周",
  last_7_days: "近 7 天",
  last_30_days: "近 30 天",
};

export function ReviewView({ plans, now, matrixRules }: ReviewViewProps) {
  const openEditDialog = useUiStore((state) => state.openEditDialog);
  const [period, setPeriod] = useState<ReviewPeriodId>("this_week");
  const stats = useMemo(
    () => buildReviewStats(plans, now, period, matrixRules),
    [matrixRules, now, period, plans],
  );
  const completionRateLabel = `${Math.round(stats.metrics.completionRate * 100)}%`;

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_auto_minmax(0,1fr)] gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between border-b py-4">
          <div>
            <CardTitle>正式计划复盘</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              仅统计正式计划，不包含每日临时记录。
            </p>
          </div>
          <Tabs
            value={period}
            onValueChange={(value) => setPeriod(value as ReviewPeriodId)}
          >
            <TabsList>
              {Object.entries(periodLabels).map(([value, label]) => (
                <TabsTrigger key={value} value={value}>
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent className="grid grid-cols-6 gap-3 p-4">
          <MetricCard
            icon={<CalendarPlus />}
            label="新增计划"
            value={stats.metrics.createdCount}
          />
          <MetricCard
            icon={<CheckCircle2 />}
            label="完成计划"
            value={stats.metrics.completedCount}
          />
          <MetricCard
            icon={<TrendingUp />}
            label="完成率"
            value={completionRateLabel}
          />
          <MetricCard
            icon={<AlertTriangle />}
            label="当前过期"
            tone="danger"
            value={stats.metrics.expiredCount}
          />
          <MetricCard
            icon={<Target />}
            label="重要完成"
            value={stats.metrics.completedImportantCount}
          />
          <MetricCard
            icon={<AlertTriangle />}
            label="重要过期"
            tone="danger"
            value={stats.metrics.expiredImportantCount}
          />
        </CardContent>
      </Card>

      <section className="grid grid-cols-4 gap-3">
        {stats.quadrantSummaries.map((quadrant) => (
          <QuadrantSummaryCard key={quadrant.quadrant} quadrant={quadrant} />
        ))}
      </section>

      <section className="grid min-h-0 grid-cols-3 gap-4">
        <PlanSection
          title={`${stats.period.label}完成`}
          icon={<CheckCircle2 className="size-4 text-emerald-600" />}
          empty="这个周期还没有完成的正式计划"
          plans={stats.completedPlans}
          now={now}
          meta={(plan) => formatPlanTime(plan.completedAt)}
          onEdit={openEditDialog}
        />
        <PlanSection
          title="当前过期"
          icon={<AlertTriangle className="size-4 text-rose-500" />}
          empty="暂无过期正式计划"
          plans={stats.expiredPlans}
          now={now}
          danger
          meta={(plan) => formatPlanTime(plan.endAt)}
          onEdit={openEditDialog}
        />
        <PlanSection
          title="重要未排期"
          icon={<ClipboardList className="size-4" />}
          empty="没有重要未排期计划"
          plans={stats.importantUnscheduledPlans}
          now={now}
          meta={() => "无开始时间和结束时间"}
          onEdit={openEditDialog}
        />
      </section>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  tone = "default",
}: {
  icon: ReactNode;
  label: string;
  value: number | string;
  tone?: "default" | "danger";
}) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div
        className={`mb-3 flex size-8 items-center justify-center rounded-md ${
          tone === "danger"
            ? "bg-rose-50 text-rose-600"
            : "bg-slate-50 text-slate-600"
        }`}
      >
        {icon}
      </div>
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      <div className="mt-1 text-sm text-muted-foreground">{label}</div>
    </div>
  );
}

function QuadrantSummaryCard({
  quadrant,
}: {
  quadrant: ReviewQuadrantStats;
}) {
  return (
    <Card>
      <CardHeader className="border-b py-3">
        <CardTitle className="text-sm">{quadrant.title}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 p-3">
        <div className="flex items-end justify-between">
          <span className="text-sm text-muted-foreground">总数</span>
          <span className="text-2xl font-semibold tabular-nums">
            {quadrant.total}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <QuadrantCount label="完成" value={quadrant.completed} />
          <QuadrantCount label="过期" value={quadrant.expired} danger />
          <QuadrantCount label="未完成" value={quadrant.unfinished} />
        </div>
      </CardContent>
    </Card>
  );
}

function QuadrantCount({
  label,
  value,
  danger = false,
}: {
  label: string;
  value: number;
  danger?: boolean;
}) {
  return (
    <div
      className={`rounded-md border px-2 py-1.5 ${
        danger ? "bg-rose-50 text-rose-700" : "bg-muted/30"
      }`}
    >
      <div className="font-medium tabular-nums">{value}</div>
      <div className="mt-0.5 text-muted-foreground">{label}</div>
    </div>
  );
}

function PlanSection({
  title,
  icon,
  empty,
  plans,
  now,
  danger = false,
  meta,
  onEdit,
}: {
  title: string;
  icon: ReactNode;
  empty: string;
  plans: Plan[];
  now: Date;
  danger?: boolean;
  meta: (plan: Plan) => string;
  onEdit: (plan: Plan) => void;
}) {
  return (
    <Card className="min-h-0 overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between border-b py-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          {icon}
          {title}
        </CardTitle>
        <Badge variant="secondary">{plans.length}</Badge>
      </CardHeader>
      <CardContent className="max-h-[calc(100vh-520px)] min-h-48 overflow-auto p-3">
        {plans.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {empty}
          </p>
        ) : (
          <div className="grid gap-2">
            {plans.map((plan) => (
              <button
                key={plan.id}
                type="button"
                className={`rounded-lg border bg-card p-3 text-left text-sm shadow-sm transition hover:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 ${
                  danger ? "border-rose-100 bg-rose-50/60" : ""
                }`}
                onClick={() => onEdit(plan)}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="line-clamp-2 font-medium">{plan.title}</span>
                  <div className="flex shrink-0 items-center gap-1">
                    <Badge variant="outline">{plan.importanceScore}</Badge>
                    <span
                      className="flex size-7 items-center justify-center rounded-md text-muted-foreground"
                      title="编辑计划"
                    >
                      <Pencil className="size-4" />
                    </span>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>{meta(plan)}</span>
                  <span>{getStatusLabel(plan, now)}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function getStatusLabel(plan: Plan, now: Date): string {
  const status = deriveEffectiveStatus(plan, now);

  if (status === "completed") {
    return "已完成";
  }

  if (status === "expired") {
    return "已过期";
  }

  if (status === "archived") {
    return "已归档";
  }

  if (status === "in_progress") {
    return "进行中";
  }

  return "未开始";
}
