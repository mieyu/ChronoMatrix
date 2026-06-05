import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  CheckCircle2,
  Grid2X2,
  List,
  Plus,
  RefreshCcw,
  SunMedium,
  TimerReset,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarView } from "@/components/CalendarView";
import { ListView } from "@/components/ListView";
import { MatrixView } from "@/components/MatrixView";
import { PlanDialog } from "@/components/PlanDialog";
import { TodayView } from "@/components/TodayView";
import { listPlans } from "@/data/plans";
import { appShellMinSizeClass } from "@/domain/appLayout";
import {
  deriveEffectiveStatus,
  type EffectivePlanStatus,
  type Plan,
} from "@/domain/plan";
import { useUiStore, type AppView } from "@/state/ui";

const viewLabels: Record<AppView, string> = {
  today: "今日",
  matrix: "矩阵",
  calendar: "日历",
  list: "列表",
};

function App() {
  const view = useUiStore((state) => state.view);
  const setView = useUiStore((state) => state.setView);
  const openCreateDialog = useUiStore((state) => state.openCreateDialog);
  const dialogOpen = useUiStore((state) => state.dialogOpen);
  const editingPlan = useUiStore((state) => state.editingPlan);
  const [now, setNow] = useState(() => new Date());
  const plansQuery = useQuery({
    queryKey: ["plans"],
    queryFn: listPlans,
  });

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 60_000);
    const refreshOnFocus = () => setNow(new Date());
    window.addEventListener("focus", refreshOnFocus);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshOnFocus);
    };
  }, []);

  const plans = plansQuery.data ?? [];
  const stats = useMemo(() => getStats(plans, now), [plans, now]);

  return (
    <main
      className={`flex h-screen ${appShellMinSizeClass} flex-col bg-[#f7f7f4] text-foreground`}
    >
      <header className="flex h-16 shrink-0 items-center justify-between border-b bg-background px-5">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <TimerReset className="size-5" />
          </div>
          <div>
            <h1 className="text-base font-semibold leading-none">
              时矩 ChronoMatrix
            </h1>
            <p className="mt-1 text-xs text-muted-foreground">
              本地优先的矩阵计划管理
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Tabs
            value={view}
            onValueChange={(value) => setView(value as AppView)}
          >
            <TabsList>
              <TabsTrigger value="today">
                <SunMedium />
                {viewLabels.today}
              </TabsTrigger>
              <TabsTrigger value="matrix">
                <Grid2X2 />
                {viewLabels.matrix}
              </TabsTrigger>
              <TabsTrigger value="calendar">
                <CalendarDays />
                {viewLabels.calendar}
              </TabsTrigger>
              <TabsTrigger value="list">
                <List />
                {viewLabels.list}
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <Button variant="outline" onClick={() => plansQuery.refetch()}>
            <RefreshCcw />
            刷新
          </Button>
          <Button onClick={openCreateDialog}>
            <Plus />
            新增计划
          </Button>
        </div>
      </header>

      <section className="grid grid-cols-4 gap-3 border-b bg-background/80 px-5 py-3">
        <Stat label="全部" value={plans.length} />
        <Stat label="进行中" value={stats.in_progress} />
        <Stat label="已过期" value={stats.expired} tone="danger" />
        <Stat label="已完成" value={stats.completed} icon={<CheckCircle2 />} />
      </section>

      <section className="min-h-0 flex-1 p-4">
        {plansQuery.isLoading ? (
          <div className="grid h-full place-items-center text-sm text-muted-foreground">
            正在读取本地计划...
          </div>
        ) : plansQuery.isError ? (
          <div className="grid h-full place-items-center text-sm text-destructive">
            读取计划失败：{String(plansQuery.error)}
          </div>
        ) : (
          <>
            {view === "today" ? <TodayView plans={plans} now={now} /> : null}
            {view === "matrix" ? <MatrixView plans={plans} now={now} /> : null}
            {view === "calendar" ? (
              <CalendarView plans={plans} now={now} />
            ) : null}
            {view === "list" ? <ListView plans={plans} now={now} /> : null}
          </>
        )}
      </section>

      <PlanDialog plan={editingPlan} open={dialogOpen} />
    </main>
  );
}

function Stat({
  label,
  value,
  tone = "default",
  icon,
}: {
  label: string;
  value: number;
  tone?: "default" | "danger";
  icon?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border bg-card px-3 py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <Badge variant={tone === "danger" ? "destructive" : "secondary"}>
        {icon}
        {value}
      </Badge>
    </div>
  );
}

function getStats(plans: Plan[], now: Date) {
  const initial: Record<EffectivePlanStatus, number> = {
    not_started: 0,
    in_progress: 0,
    completed: 0,
    expired: 0,
    archived: 0,
  };

  return plans.reduce((counts, plan) => {
    const status = deriveEffectiveStatus(plan, now);
    counts[status] += 1;
    return counts;
  }, initial);
}

export default App;
