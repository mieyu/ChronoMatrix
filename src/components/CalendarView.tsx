import { useState, type CSSProperties, type ReactNode } from "react";
import { format, isSameMonth, isToday } from "date-fns";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Flag,
  Play,
  RotateCcw,
  TimerOff,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getCalendarDays,
  getCalendarEntriesForDay,
  getCalendarHeaderLabel,
  getCalendarSpansForWeek,
  getCalendarWeekDisplay,
  getUnscheduledPlans,
  shiftCalendarAnchor,
  type CalendarEntry,
  type CalendarMarkerKind,
  type CalendarMode,
  type CalendarSpan,
} from "@/domain/calendar";
import type { Plan } from "@/domain/plan";
import { formatPlanTime } from "@/lib/dates";
import { useUiStore } from "@/state/ui";

interface CalendarViewProps {
  plans: Plan[];
  now: Date;
}

const markerLabels: Record<CalendarMarkerKind, string> = {
  start: "开始",
  end: "截止",
};

const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function CalendarView({ plans, now }: CalendarViewProps) {
  const openEditDialog = useUiStore((state) => state.openEditDialog);
  const [mode, setMode] = useState<CalendarMode>("week");
  const [calendarAnchor, setCalendarAnchor] = useState(now);
  const days = getCalendarDays(mode, calendarAnchor);
  const weeks = chunkIntoWeeks(days);
  const unscheduledPlans = getUnscheduledPlans(plans);
  const periodLabel = getCalendarHeaderLabel(mode, calendarAnchor);

  function showWeek(weekStart: Date) {
    setCalendarAnchor(weekStart);
    setMode("week");
  }

  return (
    <div className="grid min-h-0 grid-cols-[1fr_300px] gap-4">
      <Card className="min-h-0 overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between border-b">
          <div>
            <CardTitle>{mode === "week" ? "周历视图" : "月历视图"}</CardTitle>
            <p className="text-sm text-muted-foreground">
              有开始和结束时间的计划显示为横跨日期的长条。
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <Button
                size="icon-sm"
                variant="outline"
                title={mode === "week" ? "上一周" : "上个月"}
                onClick={() =>
                  setCalendarAnchor((anchor) =>
                    shiftCalendarAnchor(mode, anchor, "previous"),
                  )
                }
              >
                <ChevronLeft />
              </Button>
              <Badge
                variant="secondary"
                className="h-7 min-w-32 justify-center tabular-nums"
              >
                {periodLabel}
              </Badge>
              <Button
                size="icon-sm"
                variant="outline"
                title={mode === "week" ? "下一周" : "下个月"}
                onClick={() =>
                  setCalendarAnchor((anchor) =>
                    shiftCalendarAnchor(mode, anchor, "next"),
                  )
                }
              >
                <ChevronRight />
              </Button>
              <Button
                size="sm"
                variant="outline"
                title="回到今天"
                onClick={() => setCalendarAnchor(now)}
              >
                <RotateCcw />
                今天
              </Button>
            </div>
            <Tabs
              value={mode}
              onValueChange={(value) => setMode(value as CalendarMode)}
            >
              <TabsList>
                <TabsTrigger value="week">
                  <CalendarDays />
                  周
                </TabsTrigger>
                <TabsTrigger value="month">
                  <CalendarDays />
                  月
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent className="grid h-[calc(100vh-210px)] min-h-[520px] grid-rows-[32px_1fr] p-0">
          <div className="grid grid-cols-7 border-b bg-muted/30">
            {weekdays.map((weekday) => (
              <div
                key={weekday}
                className="px-3 py-2 text-xs font-medium text-muted-foreground"
              >
                {weekday}
              </div>
            ))}
          </div>

          <div
            className={
              mode === "week"
                ? "min-h-0 overflow-y-auto overscroll-contain"
                : "grid min-h-0 overflow-hidden"
            }
            style={
              mode === "month"
                ? {
                    gridTemplateRows: `repeat(${weeks.length}, minmax(0, 1fr))`,
                  }
                : undefined
            }
          >
            {weeks.map((week) => (
              <CalendarWeekRow
                key={week[0]?.toISOString()}
                week={week}
                anchor={calendarAnchor}
                mode={mode}
                plans={plans}
                onOpenPlan={openEditDialog}
                onShowWeek={showWeek}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="min-h-0">
        <CardHeader className="border-b py-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <TimerOff className="size-4" />
            未排期
          </CardTitle>
        </CardHeader>
        <CardContent className="max-h-[calc(100vh-210px)] overflow-auto p-3">
          {unscheduledPlans.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              没有未排期计划
            </p>
          ) : (
            <div className="grid gap-2">
              {unscheduledPlans.map((plan) => (
                <button
                  key={plan.id}
                  type="button"
                  className="rounded-lg border bg-card p-3 text-left text-sm shadow-sm transition hover:border-ring"
                  onClick={() => openEditDialog(plan)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="line-clamp-2 font-medium">{plan.title}</span>
                    <Badge variant="outline">{plan.importanceScore}</Badge>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    没有开始时间和结束时间
                  </p>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function CalendarWeekRow({
  week,
  anchor,
  mode,
  plans,
  onOpenPlan,
  onShowWeek,
}: {
  week: Date[];
  anchor: Date;
  mode: CalendarMode;
  plans: Plan[];
  onOpenPlan: (plan: Plan) => void;
  onShowWeek: (weekStart: Date) => void;
}) {
  const spans = getCalendarSpansForWeek(plans, week);
  const display = getCalendarWeekDisplay(mode, spans.length);
  const visibleSpans = spans.slice(0, display.visibleSpanCount);

  return (
    <div
      className={`relative grid grid-cols-7 border-b last:border-b-0 ${
        mode === "week" ? "overflow-visible" : "min-h-0 overflow-hidden"
      }`}
      style={mode === "week" ? { minHeight: display.minRowHeight } : undefined}
    >
      {week.map((day) => (
        <CalendarDayCell
          key={day.toISOString()}
          day={day}
          anchor={anchor}
          mode={mode}
          pointOffset={display.pointOffset}
          entries={getCalendarEntriesForDay(plans, day)}
          onOpenPlan={onOpenPlan}
        />
      ))}

      {visibleSpans.map((span, index) => (
        <CalendarSpanBar
          key={`${span.plan.id}-${week[0]?.toISOString()}`}
          span={span}
          lane={index}
          mode={mode}
          onClick={() => onOpenPlan(span.plan)}
        />
      ))}

      {display.hiddenSpanCount > 0 && mode === "month" ? (
        <CalendarHiddenSpansButton
          count={display.hiddenSpanCount}
          lane={display.visibleSpanCount}
          onClick={() => onShowWeek(week[0] ?? anchor)}
        />
      ) : null}
    </div>
  );
}

function CalendarDayCell({
  day,
  anchor,
  mode,
  pointOffset,
  entries,
  onOpenPlan,
}: {
  day: Date;
  anchor: Date;
  mode: CalendarMode;
  pointOffset: number;
  entries: CalendarEntry[];
  onOpenPlan: (plan: Plan) => void;
}) {
  const outsideMonth = mode === "month" && !isSameMonth(day, anchor);

  return (
    <section
      className={`min-h-0 min-w-0 border-r p-2 last:border-r-0 ${
        outsideMonth ? "bg-muted/20 text-muted-foreground" : "bg-background"
      } ${mode === "week" ? "overflow-visible" : "overflow-hidden"}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className={`flex size-7 items-center justify-center rounded-md text-sm font-semibold tabular-nums ${
            isToday(day)
              ? "bg-primary text-primary-foreground"
              : "text-foreground"
          }`}
        >
          {format(day, mode === "week" ? "MM-dd" : "d")}
        </span>
        {mode === "week" ? (
          <span className="text-xs text-muted-foreground">{format(day, "EEE")}</span>
        ) : null}
      </div>

      <div
        className={`grid content-start gap-1 ${
          mode === "week" ? "overflow-visible" : "overflow-hidden"
        }`}
        style={{ paddingTop: pointOffset }}
      >
        {entries.map((entry) => (
          <CalendarPointCard
            key={`${day.toISOString()}-${entry.plan.id}`}
            entry={entry}
            compact={mode === "month"}
            onClick={() => onOpenPlan(entry.plan)}
          />
        ))}
      </div>
    </section>
  );
}

function CalendarHiddenSpansButton({
  count,
  lane,
  onClick,
}: {
  count: number;
  lane: number;
  onClick: () => void;
}) {
  const style: CSSProperties = {
    left: "6px",
    right: "6px",
    top: 42 + lane * 24,
  };

  return (
    <button
      type="button"
      className="absolute z-10 flex h-6 items-center justify-center rounded-md border border-dashed bg-muted/80 px-2 text-xs font-medium text-muted-foreground transition hover:border-ring hover:bg-muted hover:text-foreground"
      style={style}
      onClick={onClick}
      title="切到这一周查看全部任务条"
    >
      +{count} 更多，切到周视图
    </button>
  );
}

function CalendarSpanBar({
  span,
  lane,
  mode,
  onClick,
}: {
  span: CalendarSpan;
  lane: number;
  mode: CalendarMode;
  onClick: () => void;
}) {
  const top = mode === "month" ? 42 + lane * 24 : 46 + lane * 30;
  const colorClass =
    span.plan.importanceScore >= 60
      ? "border-emerald-300 bg-emerald-50 text-emerald-950 hover:bg-emerald-100"
      : "border-sky-200 bg-sky-50 text-sky-950 hover:bg-sky-100";
  const style: CSSProperties = {
    left: `calc(${(span.startIndex / 7) * 100}% + 6px)`,
    width: `calc(${((span.endIndex - span.startIndex + 1) / 7) * 100}% - 12px)`,
    top,
  };

  return (
    <button
      type="button"
      className={`absolute z-10 flex h-6 items-center gap-2 overflow-hidden border px-2 text-left text-xs font-medium shadow-sm transition ${colorClass} ${
        span.isStartVisible ? "rounded-l-md" : "rounded-l-none border-l-0"
      } ${span.isEndVisible ? "rounded-r-md" : "rounded-r-none border-r-0"}`}
      style={style}
      onClick={onClick}
      title={`${span.plan.title} ${formatPlanTime(span.startAt)} - ${formatPlanTime(span.endAt)}`}
    >
      <span className="truncate">{span.plan.title}</span>
      {mode === "week" ? (
        <span className="ml-auto shrink-0 text-[11px] opacity-70">
          {formatPlanTime(span.startAt)} - {formatPlanTime(span.endAt)}
        </span>
      ) : null}
    </button>
  );
}

function CalendarPointCard({
  entry,
  compact,
  onClick,
}: {
  entry: CalendarEntry;
  compact: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="rounded-md border bg-card px-2 py-1 text-left text-xs shadow-sm transition hover:border-ring"
      onClick={onClick}
    >
      <div className="flex items-center gap-1">
        <span className="truncate font-medium">{entry.plan.title}</span>
        {!compact ? (
          <Badge variant="outline" className="ml-auto shrink-0">
            {entry.plan.importanceScore}
          </Badge>
        ) : null}
      </div>
      <div className="mt-1 grid gap-1">
        {entry.markers.map((marker) => (
          <CalendarLine
            key={`${entry.plan.id}-${marker.kind}`}
            icon={marker.kind === "start" ? <Play /> : <Flag />}
            label={markerLabels[marker.kind]}
            value={formatPlanTime(marker.at)}
          />
        ))}
      </div>
    </button>
  );
}

function CalendarLine({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <p className="flex items-center gap-1 text-muted-foreground">
      <span className="[&_svg]:size-3">{icon}</span>
      <span>{label}</span>
      <span className="ml-auto tabular-nums">{value}</span>
    </p>
  );
}

function chunkIntoWeeks(days: Date[]): Date[][] {
  const weeks: Date[][] = [];

  for (let index = 0; index < days.length; index += 7) {
    weeks.push(days.slice(index, index + 7));
  }

  return weeks;
}
