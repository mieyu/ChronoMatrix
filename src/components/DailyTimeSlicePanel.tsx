import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createDailyTimeSlice,
  deleteDailyTimeSlice,
  listDailyTimeSlices,
  updateDailyTimeSliceTitle,
} from "@/data/dailyTimeSlices";
import {
  buildDailyTimeSliceOverview,
  dayMinuteCount,
  formatMinuteOfDay,
  getCurrentTimeScrollTop,
  getTimeSliceBlockLayout,
  getTimelineMinuteFromRatio,
  type DailyTimeSlice,
  type DailyTimeSliceOverviewSegment,
} from "@/domain/dailyTimeSlices";

interface DailyTimeSlicePanelProps {
  now: Date;
  selectedDate: string;
  todayDate: string;
}

const timelineHeightPx = 2304;
const hourMarkers = Array.from({ length: 25 }, (_, hour) => hour);
const overviewSegmentClasses = [
  "bg-sky-200 text-sky-950 ring-sky-100",
  "bg-emerald-200 text-emerald-950 ring-emerald-100",
  "bg-violet-200 text-violet-950 ring-violet-100",
  "bg-amber-200 text-amber-950 ring-amber-100",
  "bg-rose-200 text-rose-950 ring-rose-100",
  "bg-cyan-200 text-cyan-950 ring-cyan-100",
];

export function DailyTimeSlicePanel({
  now,
  selectedDate,
  todayDate,
}: DailyTimeSlicePanelProps) {
  const queryClient = useQueryClient();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const [pendingMinute, setPendingMinute] = useState<number | null>(null);
  const [activeSegmentId, setActiveSegmentId] = useState<string | null>(null);
  const slicesQuery = useQuery({
    queryKey: ["daily-time-slices", selectedDate],
    queryFn: () => listDailyTimeSlices(selectedDate),
  });
  const createMutation = useMutation({
    mutationFn: ({
      firstMinute,
      secondMinute,
    }: {
      firstMinute: number;
      secondMinute: number;
    }) =>
      createDailyTimeSlice({
        date: selectedDate,
        firstMinute,
        secondMinute,
        title: "",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["daily-time-slices", selectedDate],
      });
      queryClient.invalidateQueries({ queryKey: ["daily-time-slice-dates"] });
    },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      updateDailyTimeSliceTitle(id, title),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["daily-time-slices", selectedDate],
      });
      queryClient.invalidateQueries({ queryKey: ["daily-time-slice-dates"] });
    },
  });
  const deleteMutation = useMutation({
    mutationFn: deleteDailyTimeSlice,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["daily-time-slices", selectedDate],
      });
    },
  });

  useEffect(() => {
    setPendingMinute(null);
  }, [selectedDate]);

  useLayoutEffect(() => {
    if (selectedDate !== todayDate || !scrollAreaRef.current) {
      return;
    }

    const currentMinute = now.getHours() * 60 + now.getMinutes();
    const scrollToCurrentTime = () => {
      const scrollArea = scrollAreaRef.current;

      if (!scrollArea) {
        return;
      }

      scrollArea.scrollTop = getCurrentTimeScrollTop({
        minute: currentMinute,
        containerHeight: scrollArea.clientHeight,
        timelineHeight: timelineHeightPx,
      });
    };
    const frame = window.requestAnimationFrame(scrollToCurrentTime);
    const timeout = window.setTimeout(scrollToCurrentTime, 50);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
    };
  }, [selectedDate, todayDate]);

  const slices = slicesQuery.data ?? [];
  const title =
    selectedDate === todayDate ? "今天的时间切片" : `${selectedDate} 时间切片`;
  const currentMinute = now.getHours() * 60 + now.getMinutes();
  const overview = buildDailyTimeSliceOverview(slices);

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_auto_1fr] gap-3 p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium">{title}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            点时间线一次选开始，再点一次选结束；时间自动记录。
          </p>
        </div>
        {pendingMinute === null ? (
          <span className="text-xs text-muted-foreground">未选择时间</span>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPendingMinute(null)}
          >
            清除 {formatMinuteOfDay(pendingMinute)}
          </Button>
        )}
      </div>

      <DailyTimeSliceOverviewBar
        activeSegmentId={activeSegmentId}
        overview={overview}
        onActiveSegmentChange={setActiveSegmentId}
      />

      <div
        ref={scrollAreaRef}
        className="min-h-0 overflow-auto rounded-lg border bg-background"
      >
        <div
          ref={timelineRef}
          className="relative cursor-crosshair"
          style={{ height: timelineHeightPx }}
          onClick={(event) => {
            if (
              event.target instanceof HTMLElement &&
              event.target.closest("[data-time-slice-editor]")
            ) {
              return;
            }

            const rect = event.currentTarget.getBoundingClientRect();
            const minute = getTimelineMinuteFromRatio(
              (event.clientY - rect.top) / rect.height,
            );

            if (pendingMinute === null) {
              setPendingMinute(minute);
              return;
            }

            createMutation.mutate({
              firstMinute: pendingMinute,
              secondMinute: minute,
            });
            setPendingMinute(null);
          }}
        >
          {hourMarkers.map((hour) => (
            <div
              key={hour}
              className="absolute left-0 right-0 border-t border-border/70"
              style={{ top: `${(hour / 24) * 100}%` }}
            >
              <span className="absolute left-3 top-1 text-[11px] tabular-nums text-muted-foreground">
                {formatMinuteOfDay(hour * 60)}
              </span>
            </div>
          ))}

          {selectedDate === todayDate ? (
            <div
              className="pointer-events-none absolute left-20 right-4 z-10 border-t-2 border-rose-200"
              style={{ top: `${(currentMinute / dayMinuteCount) * 100}%` }}
            >
              <span className="absolute -left-16 -top-3 rounded bg-rose-50 px-1.5 py-0.5 text-[11px] tabular-nums text-rose-700 ring-1 ring-rose-100">
                现在 {formatMinuteOfDay(currentMinute)}
              </span>
            </div>
          ) : null}

          {pendingMinute !== null ? (
            <div
              className="pointer-events-none absolute left-20 right-4 z-10 border-t-2 border-sky-300"
              style={{ top: `${(pendingMinute / dayMinuteCount) * 100}%` }}
            >
              <span className="absolute -left-16 -top-3 rounded bg-sky-50 px-1.5 py-0.5 text-[11px] tabular-nums text-sky-700 ring-1 ring-sky-100">
                {formatMinuteOfDay(pendingMinute)}
              </span>
            </div>
          ) : null}

          {slices.map((slice) => (
            <TimeSliceBlock
              key={slice.id}
              slice={slice}
              onDelete={() => deleteMutation.mutate(slice.id)}
              onSelect={() => setActiveSegmentId(slice.id)}
              onTitleSave={(title) =>
                updateMutation.mutate({ id: slice.id, title })
              }
            />
          ))}

          {slicesQuery.isLoading ? (
            <p className="absolute inset-x-20 top-10 rounded-md bg-muted/80 px-3 py-2 text-center text-sm text-muted-foreground">
              正在读取时间切片
            </p>
          ) : null}
          {!slicesQuery.isLoading && slices.length === 0 && pendingMinute === null ? (
            <p className="absolute inset-x-20 top-10 rounded-md border border-dashed bg-muted/40 px-3 py-8 text-center text-sm text-muted-foreground">
              点击时间线开始规划今天的时间段
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function DailyTimeSliceOverviewBar({
  activeSegmentId,
  overview,
  onActiveSegmentChange,
}: {
  activeSegmentId: string | null;
  overview: ReturnType<typeof buildDailyTimeSliceOverview>;
  onActiveSegmentChange: (id: string | null) => void;
}) {
  const activeSegment =
    overview.segments.find((segment) => segment.id === activeSegmentId) ?? null;

  return (
    <div
      data-time-slice-overview
      className="rounded-lg border bg-background/80 px-3 py-2.5"
    >
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="font-medium text-muted-foreground">当天结构总览</span>
        <span className="truncate tabular-nums text-foreground">
          {activeSegment
            ? `${formatMinuteOfDay(activeSegment.startMinute)}-${formatMinuteOfDay(activeSegment.endMinute)} ${activeSegment.title}`
            : overview.segments.length > 0
              ? "悬停或点击色块查看时间段"
              : "完成时间切片后生成总览"}
        </span>
      </div>
      <div className="mt-2.5" onMouseLeave={() => onActiveSegmentChange(null)}>
        <div className="relative h-8">
          <div className="absolute inset-x-0 top-3 h-1.5 rounded-full bg-slate-200/60" />
          {overview.segments.map((segment, index) => (
            <OverviewSegmentButton
              key={segment.id}
              active={segment.id === activeSegment?.id}
              colorClass={
                overviewSegmentClasses[index % overviewSegmentClasses.length]
              }
              segment={segment}
              onActive={() => onActiveSegmentChange(segment.id)}
            />
          ))}

          {overview.ticks.map((tick) => (
            <div
              key={tick}
              className="absolute top-1.5 h-5 -translate-x-1/2"
              style={{ left: `${(tick / dayMinuteCount) * 100}%` }}
            >
              <div className="mx-auto h-5 w-px bg-slate-300/60" />
            </div>
          ))}
        </div>
        <div
          data-overview-tick-labels
          className="mt-0.5 grid grid-cols-5 px-0.5 text-[9px] leading-none tabular-nums text-muted-foreground/45"
        >
          {overview.ticks.map((tick, index) => (
            <span
              key={tick}
              className={
                index === 0
                  ? "text-left"
                  : index === overview.ticks.length - 1
                    ? "text-right"
                    : "text-center"
              }
            >
              {formatMinuteOfDay(tick)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function OverviewSegmentButton({
  active,
  colorClass,
  segment,
  onActive,
}: {
  active: boolean;
  colorClass: string;
  segment: DailyTimeSliceOverviewSegment;
  onActive: () => void;
}) {
  return (
    <button
      type="button"
      className={`absolute top-1 z-10 h-6 rounded-full px-2 text-[11px] font-medium ring-1 transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${colorClass} ${
        active ? "shadow-sm brightness-105" : ""
      }`}
      style={{
        left: `${segment.leftPercent}%`,
        minWidth: segment.widthPercent < 1.5 ? "0.45rem" : undefined,
        width: `${segment.widthPercent}%`,
      }}
      title={`${formatMinuteOfDay(segment.startMinute)}-${formatMinuteOfDay(segment.endMinute)} ${segment.title}`}
      onClick={onActive}
      onFocus={onActive}
      onMouseEnter={onActive}
    >
      {segment.showLabel ? (
        <span className="block truncate">{segment.title}</span>
      ) : null}
    </button>
  );
}

function TimeSliceBlock({
  slice,
  onDelete,
  onSelect,
  onTitleSave,
}: {
  slice: DailyTimeSlice;
  onDelete: () => void;
  onSelect: () => void;
  onTitleSave: (title: string) => void;
}) {
  const [title, setTitle] = useState(slice.title);

  useEffect(() => {
    setTitle(slice.title);
  }, [slice.title]);

  const layout = getTimeSliceBlockLayout(slice);

  return (
    <div
      data-time-slice-editor
      className={`absolute left-20 right-4 z-20 overflow-hidden rounded-md border border-sky-100 bg-sky-50/90 text-xs text-sky-950 shadow-sm ${
        layout.compact ? "p-1" : "p-2"
      }`}
      style={{
        top: `${layout.topPercent}%`,
        height: `${layout.heightPercent}%`,
      }}
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
      }}
    >
      {layout.compact ? (
        <div className="grid h-full grid-cols-[auto_1fr_auto] items-center gap-1">
          <span className="shrink-0 tabular-nums text-sky-700">
            {formatMinuteOfDay(slice.startMinute)}-{formatMinuteOfDay(slice.endMinute)}
          </span>
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onBlur={() => onTitleSave(title)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.currentTarget.blur();
              }
            }}
            placeholder="这段做什么"
            className="h-5 border-0 bg-background/70 px-1 text-xs shadow-none focus-visible:ring-1"
          />
          <Button
            variant="ghost"
            size="icon-xs"
            title="删除时间段"
            onClick={onDelete}
          >
            <Trash2 />
          </Button>
        </div>
      ) : (
        <>
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="shrink-0 tabular-nums text-sky-700">
              {formatMinuteOfDay(slice.startMinute)}-{formatMinuteOfDay(slice.endMinute)}
            </span>
            <Button
              variant="ghost"
              size="icon-xs"
              title="删除时间段"
              onClick={onDelete}
            >
              <Trash2 />
            </Button>
          </div>
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onBlur={() => onTitleSave(title)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.currentTarget.blur();
              }
            }}
            placeholder="这段做什么"
            className="h-7 border-sky-100 bg-background/80 text-xs"
          />
        </>
      )}
    </div>
  );
}
