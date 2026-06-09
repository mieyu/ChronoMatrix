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
import {
  getPlanQuadrant,
  type MatrixQuadrant,
  type MatrixRules,
  type Plan,
} from "@/domain/plan";
import { formatPlanTime } from "@/lib/dates";
import { useUiStore } from "@/state/ui";

interface CalendarViewProps {
  plans: Plan[];
  now: Date;
  matrixRules: MatrixRules;
}

const markerLabels: Record<CalendarMarkerKind, string> = {
  start: "开始",
  end: "截止",
};

// Calendar bars/chips reuse the matrix quadrant palette (red/amber/sky/slate).
const quadrantBarClass: Record<MatrixQuadrant, string> = {
  "important-urgent":
    "border-rose-300 bg-rose-50 text-rose-950 hover:bg-rose-100",
  "important-not-urgent":
    "border-amber-300 bg-amber-50 text-amber-950 hover:bg-amber-100",
  "not-important-urgent":
    "border-sky-300 bg-sky-50 text-sky-950 hover:bg-sky-100",
  "not-important-not-urgent":
    "border-slate-300 bg-slate-50 text-slate-800 hover:bg-slate-100",
};

const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function CalendarView({ plans, now, matrixRules }: CalendarViewProps) {
  const openEditDialog = useUiStore((state) => state.openEditDialog);
  const [mode, setMode] = useState<CalendarMode>("week");
  const [calendarAnchor, setCalendarAnchor] = useState(now);
  const days = getCalendarDays(mode, calendarAnchor);
  const weeks = chunkIntoWeeks(days);
  // 已完成计划不在日历中展示。
  const calendarPlans = plans.filter(
    (plan) => plan.storedStatus !== "completed",
  );
  const unscheduledPlans = getUnscheduledPlans(calendarPlans);
  const periodLabel = getCalendarHeaderLabel(mode, calendarAnchor);

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
                : "grid min-h-0 auto-rows-min overflow-y-auto overscroll-contain"
            }
          >
            {weeks.map((week) => (
              <CalendarWeekRow
                key={week[0]?.toISOString()}
                week={week}
                anchor={calendarAnchor}
                mode={mode}
                plans={calendarPlans}
                now={now}
                matrixRules={matrixRules}
                onOpenPlan={openEditDialog}
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
  now,
  matrixRules,
  onOpenPlan,
}: {
  week: Date[];
  anchor: Date;
  mode: CalendarMode;
  plans: Plan[];
  now: Date;
  matrixRules: MatrixRules;
  onOpenPlan: (plan: Plan) => void;
}) {
  const spans = getCalendarSpansForWeek(plans, week);
  const display = getCalendarWeekDisplay(mode, spans.length);
  const visibleSpans = spans.slice(0, display.visibleSpanCount);

  return (
    <div
      className={`relative grid grid-cols-7 border-b last:border-b-0 ${
        mode === "week" ? "overflow-visible" : "min-h-0 overflow-hidden"
      }`}
      style={
        mode === "week"
          ? { minHeight: display.minRowHeight }
          : { minHeight: Math.max(112, display.pointOffset + 12) }
      }
    >
      {week.map((day) => (
        <CalendarDayCell
          key={day.toISOString()}
          day={day}
          anchor={anchor}
          mode={mode}
          now={now}
          matrixRules={matrixRules}
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
          now={now}
          matrixRules={matrixRules}
          onClick={() => onOpenPlan(span.plan)}
        />
      ))}
    </div>
  );
}

function CalendarDayCell({
  day,
  anchor,
  mode,
  now,
  matrixRules,
  pointOffset,
  entries,
  onOpenPlan,
}: {
  day: Date;
  anchor: Date;
  mode: CalendarMode;
  now: Date;
  matrixRules: MatrixRules;
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
          className={`flex h-7 items-center justify-center rounded-md text-sm font-semibold tabular-nums whitespace-nowrap ${
            mode === "week" ? "w-auto px-1.5" : "size-7"
          } ${
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
            now={now}
            matrixRules={matrixRules}
            onClick={() => onOpenPlan(entry.plan)}
          />
        ))}
      </div>
    </section>
  );
}

function CalendarSpanBar({
  span,
  lane,
  mode,
  now,
  matrixRules,
  onClick,
}: {
  span: CalendarSpan;
  lane: number;
  mode: CalendarMode;
  now: Date;
  matrixRules: MatrixRules;
  onClick: () => void;
}) {
  const top = mode === "month" ? 42 + lane * 24 : 46 + lane * 30;
  const colorClass =
    quadrantBarClass[getPlanQuadrant(span.plan, now, matrixRules)];
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
  now,
  matrixRules,
  onClick,
}: {
  entry: CalendarEntry;
  compact: boolean;
  now: Date;
  matrixRules: MatrixRules;
  onClick: () => void;
}) {
  if (compact) {
    return (
      <button
        type="button"
        className={`flex w-full items-center gap-1 overflow-hidden rounded-md border px-2 py-1 text-left text-xs shadow-sm transition hover:border-ring ${
          quadrantBarClass[getPlanQuadrant(entry.plan, now, matrixRules)]
        }`}
        onClick={onClick}
        title={entry.plan.title}
      >
        <span className="truncate font-medium">{entry.plan.title}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      className="rounded-md border bg-card px-2 py-1 text-left text-xs shadow-sm transition hover:border-ring"
      onClick={onClick}
    >
      <div className="flex items-center gap-1">
        <span className="truncate font-medium">{entry.plan.title}</span>
        <Badge variant="outline" className="ml-auto shrink-0">
          {entry.plan.importanceScore}
        </Badge>
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
