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
  Pencil,
  Sparkles,
} from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  getDailyNotebookEntry,
  listDailyNotebookEntries,
  saveDailyNotebookEntry,
} from "@/data/dailyNotebook";
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
  const completeMutation = useMutation({
    mutationFn: completePlan,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["plans"] }),
  });
  const historyQuery = useQuery({
    queryKey: ["daily-notebooks"],
    queryFn: listDailyNotebookEntries,
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
    <div className="grid min-h-0 grid-cols-[minmax(0,1.45fr)_minmax(360px,0.85fr)] gap-4">
      <DailyNotebookPanel
        body={notebookBody}
        entry={notebookQuery.data}
        history={historyQuery.data ?? []}
        isHistoryLoading={historyQuery.isLoading}
        isSaving={saveNotebookMutation.isPending}
        selectedDate={selectedDate}
        todayDate={todayDate}
        onBodyChange={setNotebookBody}
        onBodyBlur={flushNotebook}
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

function DailyNotebookPanel({
  body,
  entry,
  history,
  isHistoryLoading,
  isSaving,
  selectedDate,
  todayDate,
  onBodyChange,
  onBodyBlur,
  onSelectDate,
}: {
  body: string;
  entry?: DailyNotebookEntry;
  history: DailyNotebookEntry[];
  isHistoryLoading: boolean;
  isSaving: boolean;
  selectedDate: string;
  todayDate: string;
  onBodyChange: (body: string) => void;
  onBodyBlur: () => void;
  onSelectDate: (date: string) => void;
}) {
  const historyWithToday = useMemo(() => {
    if (history.some((item) => item.date === todayDate)) {
      return history;
    }

    return [
      {
        date: todayDate,
        body: "",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      ...history,
    ];
  }, [history, todayDate]);
  const saveLabel = isSaving
    ? "保存中"
    : entry && body === entry.body
      ? "已保存"
      : "待保存";

  return (
    <Card className="min-h-0 overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between border-b py-4">
        <div>
          <CardTitle>每日记录本</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            {selectedDate === todayDate ? "今天" : selectedDate}
          </p>
        </div>
        <Badge
          variant="outline"
          className="border-slate-200 bg-slate-50 text-slate-600"
        >
          {saveLabel}
        </Badge>
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
            ) : historyWithToday.length === 0 ? (
              <p className="px-2 py-6 text-center text-xs text-muted-foreground">
                暂无历史记录
              </p>
            ) : (
              <div className="grid gap-1">
                {historyWithToday.map((item) => (
                  <button
                    key={item.date}
                    type="button"
                    className={`rounded-md px-2 py-2 text-left text-xs transition hover:bg-background ${
                      item.date === selectedDate
                        ? "bg-background text-foreground ring-1 ring-foreground/10"
                        : "text-muted-foreground"
                    }`}
                    onClick={() => onSelectDate(item.date)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{item.date}</span>
                      {item.date === todayDate ? (
                        <Badge
                          variant="outline"
                          className="border-sky-100 bg-sky-50 px-1.5 py-0 text-[10px] text-sky-700"
                        >
                          今日
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-1 line-clamp-1">
                      {item.body.trim().split("\n")[0] || "空白记录"}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </aside>
        <div className="min-h-0 p-3">
          <Textarea
            value={body}
            onChange={(event) => onBodyChange(event.target.value)}
            onBlur={onBodyBlur}
            placeholder="今天的零碎事项、想法、临时安排..."
            className="h-full min-h-[calc(100vh-250px)] resize-none border-0 bg-transparent p-2 text-sm leading-6 shadow-none focus-visible:ring-0"
          />
        </div>
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
    <Card className="min-h-0 overflow-hidden">
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
