import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Clock3,
  NotebookPen,
  Pencil,
  Sparkles,
} from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { DailyTimeSlicePanel } from "@/components/DailyTimeSlicePanel";
import {
  getDailyNotebookEntry,
  listDailyNotebookEntries,
  saveDailyNotebookEntry,
} from "@/data/dailyNotebook";
import { listDailyTimeSliceDates } from "@/data/dailyTimeSlices";
import { completePlan } from "@/data/plans";
import {
  getDailyNotebookDateKey,
  type DailyNotebookEntry,
} from "@/domain/dailyNotebook";
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

type DailyMode = "notebook" | "time_slices";

const sectionIcons: Record<TodaySectionId, ReactNode> = {
  expired: <AlertTriangle className="size-4 text-rose-500" />,
  due_today: <CalendarClock className="size-4" />,
  starts_today: <Sparkles className="size-4" />,
  important_unscheduled: <CalendarClock className="size-4" />,
};

export function TodayView({ plans, now }: TodayViewProps) {
  const openEditDialog = useUiStore((state) => state.openEditDialog);
  const queryClient = useQueryClient();
  const todayDate = useMemo(() => getDailyNotebookDateKey(now), [now]);
  const [selectedDate, setSelectedDate] = useState(todayDate);
  const [notebookBody, setNotebookBody] = useState("");
  const [dailyMode, setDailyMode] = useState<DailyMode>("notebook");
  const completeMutation = useMutation({
    mutationFn: completePlan,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["plans"] }),
  });
  const historyQuery = useQuery({
    queryKey: ["daily-notebooks"],
    queryFn: listDailyNotebookEntries,
  });
  const timeSliceDatesQuery = useQuery({
    queryKey: ["daily-time-slice-dates"],
    queryFn: listDailyTimeSliceDates,
  });
  const notebookQuery = useQuery({
    queryKey: ["daily-notebook", selectedDate],
    queryFn: () => getDailyNotebookEntry(selectedDate),
  });
  const saveNotebookMutation = useMutation({
    mutationFn: ({ date, body }: { date: string; body: string }) =>
      saveDailyNotebookEntry(date, body),
    onSuccess: (entry) => {
      queryClient.setQueryData(["daily-notebook", entry.date], entry);
      queryClient.invalidateQueries({ queryKey: ["daily-notebooks"] });
    },
  });
  const sections = useMemo(() => buildTodaySections(plans, now), [plans, now]);
  const total = getTodayPlanCount(sections);
  const historyDates = useMemo(
    () =>
      Array.from(
        new Set([
          todayDate,
          ...(historyQuery.data ?? []).map((entry) => entry.date),
          ...(timeSliceDatesQuery.data ?? []),
        ]),
      ).sort((a, b) => b.localeCompare(a)),
    [historyQuery.data, timeSliceDatesQuery.data, todayDate],
  );
  const flushNotebook = useCallback(() => {
    if (!notebookQuery.data || notebookBody === notebookQuery.data.body) {
      return;
    }

    saveNotebookMutation.mutate({
      date: selectedDate,
      body: notebookBody,
    });
  }, [notebookBody, notebookQuery.data, saveNotebookMutation, selectedDate]);
  const selectNotebookDate = useCallback(
    (date: string) => {
      flushNotebook();
      setSelectedDate(date);
    },
    [flushNotebook],
  );

  useEffect(() => {
    setSelectedDate(todayDate);
  }, [todayDate]);

  useEffect(() => {
    setNotebookBody(notebookQuery.data?.body ?? "");
  }, [notebookQuery.data?.body, notebookQuery.data?.date]);

  useEffect(() => {
    if (!notebookQuery.data || notebookBody === notebookQuery.data.body) {
      return;
    }

    const timeout = window.setTimeout(() => {
      saveNotebookMutation.mutate({
        date: selectedDate,
        body: notebookBody,
      });
    }, 500);

    return () => window.clearTimeout(timeout);
  }, [notebookBody, notebookQuery.data, saveNotebookMutation, selectedDate]);

  return (
    <div className="grid h-full min-h-0 grid-cols-[minmax(0,1.45fr)_minmax(360px,0.85fr)] gap-4">
      <DailyWorkspacePanel
        body={notebookBody}
        dailyMode={dailyMode}
        entry={notebookQuery.data}
        historyDates={historyDates}
        isHistoryLoading={historyQuery.isLoading || timeSliceDatesQuery.isLoading}
        isSaving={saveNotebookMutation.isPending}
        now={now}
        selectedDate={selectedDate}
        todayDate={todayDate}
        onBodyChange={setNotebookBody}
        onBodyBlur={flushNotebook}
        onModeChange={setDailyMode}
        onSelectDate={selectNotebookDate}
      />

      <TodayAttentionPanel
        now={now}
        sections={sections}
        total={total}
        onComplete={(plan) => completeMutation.mutate(plan.id)}
        onEdit={openEditDialog}
      />
    </div>
  );
}

function DailyWorkspacePanel({
  body,
  dailyMode,
  entry,
  historyDates,
  isHistoryLoading,
  isSaving,
  now,
  selectedDate,
  todayDate,
  onBodyChange,
  onBodyBlur,
  onModeChange,
  onSelectDate,
}: {
  body: string;
  dailyMode: DailyMode;
  entry?: DailyNotebookEntry;
  historyDates: string[];
  isHistoryLoading: boolean;
  isSaving: boolean;
  now: Date;
  selectedDate: string;
  todayDate: string;
  onBodyChange: (body: string) => void;
  onBodyBlur: () => void;
  onModeChange: (mode: DailyMode) => void;
  onSelectDate: (date: string) => void;
}) {
  const saveLabel = isSaving
    ? "保存中"
    : entry && body === entry.body
      ? "已保存"
      : "待保存";

  return (
    <Card className="h-full min-h-0 overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between border-b py-4">
        <div>
          <CardTitle>每日记录</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            {selectedDate === todayDate ? "今天" : selectedDate}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border bg-muted/30 p-0.5">
            <Button
              variant={dailyMode === "notebook" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => onModeChange("notebook")}
            >
              <NotebookPen />
              记录本
            </Button>
            <Button
              variant={dailyMode === "time_slices" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => onModeChange("time_slices")}
            >
              <Clock3 />
              时间切片
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid min-h-0 flex-1 grid-cols-[190px_1fr] gap-0 p-0">
        <aside className="min-h-0 border-r bg-muted/20">
          <div className="border-b px-3 py-2 text-xs font-medium text-muted-foreground">
            历史
          </div>
          <div className="max-h-[calc(100vh-250px)] overflow-auto p-2">
            {isHistoryLoading ? (
              <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                读取中
              </p>
            ) : historyDates.length === 0 ? (
              <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                暂无历史记录
              </p>
            ) : (
              <div className="grid gap-1">
                {historyDates.map((date) => (
                  <button
                    key={date}
                    type="button"
                    className={`rounded-md px-2 py-2 text-left text-xs transition hover:bg-background ${
                      date === selectedDate
                        ? "bg-background text-foreground ring-1 ring-foreground/10"
                        : "text-muted-foreground"
                    }`}
                    onClick={() => onSelectDate(date)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{date}</span>
                      {date === todayDate ? (
                        <Badge
                          variant="outline"
                          className="border-sky-100 bg-sky-50 px-1.5 py-0 text-[10px] text-sky-700"
                        >
                          今日
                        </Badge>
                      ) : null}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </aside>
        {dailyMode === "notebook" ? (
          <div className="relative min-h-0 p-3">
            <span className="absolute right-4 top-3 text-xs text-muted-foreground">
              {saveLabel}
            </span>
            <Textarea
              value={body}
              onChange={(event) => onBodyChange(event.target.value)}
              onBlur={onBodyBlur}
              placeholder="今天的零碎事项、想法、临时安排..."
              className="h-full min-h-[calc(100vh-250px)] resize-none border-0 bg-transparent p-2 pt-7 text-sm leading-6 shadow-none focus-visible:ring-0"
            />
          </div>
        ) : (
          <DailyTimeSlicePanel
            now={now}
            selectedDate={selectedDate}
            todayDate={todayDate}
          />
        )}
      </CardContent>
    </Card>
  );
}

function TodayAttentionPanel({
  now,
  sections,
  total,
  onComplete,
  onEdit,
}: {
  now: Date;
  sections: TodaySection[];
  total: number;
  onComplete: (plan: Plan) => void;
  onEdit: (plan: Plan) => void;
}) {
  return (
    <Card className="h-full min-h-0 overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between border-b py-4">
        <div>
          <CardTitle>今日计划提醒</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            {format(now, "yyyy-MM-dd")}
          </p>
        </div>
        <Badge
          variant="outline"
          className={
            total > 0
              ? "border-sky-100 bg-sky-50 text-sky-700"
              : "border-slate-200 bg-slate-50 text-slate-600"
          }
        >
          {total}
        </Badge>
      </CardHeader>
      <CardContent className="max-h-[calc(100vh-210px)] overflow-auto p-0">
        {sections.map((section) => (
          <TodaySectionGroup
            key={section.id}
            section={section}
            onComplete={onComplete}
            onEdit={onEdit}
          />
        ))}
      </CardContent>
    </Card>
  );
}

function TodaySectionGroup({
  section,
  onComplete,
  onEdit,
}: {
  section: TodaySection;
  onComplete: (plan: Plan) => void;
  onEdit: (plan: Plan) => void;
}) {
  return (
    <section className="border-b last:border-b-0">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-sm font-medium">
            {sectionIcons[section.id]}
            {section.title}
          </h3>
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
      </div>
      <div>
        {section.plans.length === 0 ? (
          <p className="px-4 pb-4 text-sm text-muted-foreground">
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
      </div>
    </section>
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
            {plan.importanceScore}
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
