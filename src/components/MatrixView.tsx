import {
  Children,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
} from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Layers3,
  Pencil,
  RotateCcw,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { completePlan } from "@/data/plans";
import {
  buildMatrixLayoutItems,
  type MatrixClusterLayoutItem,
  type MatrixPlanLayoutItem,
} from "@/domain/matrixLayout";
import {
  defaultMatrixViewport,
  getMatrixLayoutRulesForScale,
  getMatrixViewportCssLength,
  getMatrixViewportCssPoint,
  getMatrixViewportCssPx,
  panMatrixViewport,
  resetMatrixViewport,
  zoomMatrixViewportAt,
  zoomMatrixViewportByWheel,
  type MatrixViewport,
} from "@/domain/matrixViewport";
import { getPlanMatrixPlacement, type Plan } from "@/domain/plan";
import { formatPlanTime, formatTimePressure } from "@/lib/dates";
import { useUiStore } from "@/state/ui";

interface MatrixViewProps {
  plans: Plan[];
  now: Date;
}

// One normalized matrix unit spans 42% of the canvas (see `matrixPosition`).
const MATRIX_UNIT_FRACTION = 0.42;
// Footprint (px) used to keep dots and their short labels from colliding.
// Much smaller than a card, so dots stay close to their true position.
const MATRIX_DOT_FOOTPRINT_WIDTH = 96;
const MATRIX_DOT_FOOTPRINT_HEIGHT = 30;

export function MatrixView({ plans, now }: MatrixViewProps) {
  const openEditDialog = useUiStore((state) => state.openEditDialog);
  const queryClient = useQueryClient();
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    lastX: number;
    lastY: number;
  } | null>(null);
  const [viewport, setViewport] =
    useState<MatrixViewport>(defaultMatrixViewport);
  const [isPanning, setIsPanning] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
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
  const matrixLayoutRules = useMemo(() => {
    const baseRules = getMatrixLayoutRulesForScale(viewport.scale);
    // The scatter view renders every plan as its own dot, so disable the
    // folding clusters entirely.
    const noClusterRules = {
      ...baseRules,
      clusterMinSize: Number.MAX_SAFE_INTEGER,
    };
    const spanX = MATRIX_UNIT_FRACTION * canvasSize.width * viewport.scale;
    const spanY = MATRIX_UNIT_FRACTION * canvasSize.height * viewport.scale;

    if (spanX <= 0 || spanY <= 0) {
      return noClusterRules;
    }

    return {
      ...noClusterRules,
      cardHalfWidth: MATRIX_DOT_FOOTPRINT_WIDTH / 2 / spanX,
      cardHalfHeight: MATRIX_DOT_FOOTPRINT_HEIGHT / 2 / spanY,
    };
  }, [canvasSize.height, canvasSize.width, viewport.scale]);
  const matrixLayoutItems = useMemo(
    () => buildMatrixLayoutItems(plans, now, undefined, matrixLayoutRules),
    [matrixLayoutRules, now, plans],
  );
  const scaleLabel = `${Math.round(viewport.scale * 100)}%`;

  useEffect(() => {
    const canvasElement = canvasRef.current;

    if (!canvasElement) {
      return;
    }

    const matrixCanvas = canvasElement;

    function handleWheel(event: WheelEvent) {
      if (
        event.target instanceof Element &&
        event.target.closest("[data-matrix-wheel-lock='true']")
      ) {
        return;
      }

      event.preventDefault();
      const rect = matrixCanvas.getBoundingClientRect();
      const screenPoint = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
      setViewport((current) =>
        zoomMatrixViewportByWheel(current, screenPoint, event.deltaY),
      );
    }

    matrixCanvas.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      matrixCanvas.removeEventListener("wheel", handleWheel);
    };
  }, []);

  useEffect(() => {
    const canvasElement = canvasRef.current;

    if (!canvasElement) {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;

      if (rect) {
        setCanvasSize({ width: rect.width, height: rect.height });
      }
    });

    observer.observe(canvasElement);

    return () => observer.disconnect();
  }, []);

  function getCanvasCenter() {
    const rect = canvasRef.current?.getBoundingClientRect();

    return {
      x: (rect?.width ?? 0) / 2,
      y: (rect?.height ?? 0) / 2,
    };
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (
      event.button !== 0 ||
      (event.target as HTMLElement).closest("[data-matrix-interactive='true']")
    ) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      lastX: event.clientX,
      lastY: event.clientY,
    };
    setIsPanning(true);
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;

    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    const delta = {
      x: event.clientX - drag.lastX,
      y: event.clientY - drag.lastY,
    };
    drag.lastX = event.clientX;
    drag.lastY = event.clientY;
    setViewport((current) => panMatrixViewport(current, delta));
  }

  function finishPointerDrag(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;

    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    dragRef.current = null;
    setIsPanning(false);
  }

  function zoomByStep(multiplier: number) {
    const screenPoint = getCanvasCenter();
    setViewport((current) =>
      zoomMatrixViewportAt(current, screenPoint, current.scale * multiplier),
    );
  }

  return (
    <div className="grid min-h-0 grid-cols-[1fr_320px] gap-4">
      <Card className="min-h-0 overflow-hidden">
        <CardHeader className="flex flex-row items-start justify-between border-b">
          <div>
            <CardTitle>艾森豪威尔矩阵</CardTitle>
            <p className="text-sm text-muted-foreground">
              越靠近中心，时间压力越高；圆点越大越重要。
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
              <MatrixLegendItem className="bg-rose-500" label="重要·紧急" />
              <MatrixLegendItem className="bg-amber-500" label="重要·不紧急" />
              <MatrixLegendItem className="bg-sky-500" label="不重要·紧急" />
              <MatrixLegendItem className="bg-slate-400" label="不重要·不紧急" />
            </div>
          </div>
          <Badge variant="secondary">{matrixPlans.length} 个计划</Badge>
        </CardHeader>
        <CardContent className="p-0">
          <div
            ref={canvasRef}
            className={`relative h-[calc(100vh-210px)] min-h-[520px] touch-none overflow-hidden overscroll-contain bg-background ${
              isPanning ? "cursor-grabbing" : "cursor-grab"
            }`}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={finishPointerDrag}
            onPointerCancel={finishPointerDrag}
          >
            <div
              data-matrix-interactive="true"
              className="absolute left-1/2 top-3 z-40 flex -translate-x-1/2 items-center gap-1 rounded-lg border bg-background/95 p-1 shadow-sm backdrop-blur"
            >
              <Button
                size="icon-sm"
                variant="ghost"
                title="缩小矩阵画布"
                onClick={() => zoomByStep(0.86)}
              >
                <ZoomOut />
              </Button>
              <Badge
                variant="secondary"
                className="h-7 min-w-14 justify-center tabular-nums"
              >
                {scaleLabel}
              </Badge>
              <Button
                size="icon-sm"
                variant="ghost"
                title="放大矩阵画布"
                onClick={() => zoomByStep(1.16)}
              >
                <ZoomIn />
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                title="重置矩阵视图"
                onClick={() => setViewport(resetMatrixViewport())}
              >
                <RotateCcw />
              </Button>
            </div>

            <div className="absolute inset-0">
              <MatrixAxes viewport={viewport} />

              <QuadrantLabel title="重要 / 不紧急" corner="tl" />
              <QuadrantLabel title="重要 / 紧急" corner="tr" />
              <QuadrantLabel title="不重要 / 不紧急" corner="bl" />
              <QuadrantLabel title="不重要 / 紧急" corner="br" />

              {matrixLayoutItems.map((item) =>
                item.kind === "plan" ? (
                  <MatrixDot
                    key={item.id}
                    item={item}
                    now={now}
                    viewport={viewport}
                    onClick={openEditDialog}
                  />
                ) : (
                  <MatrixClusterDot
                    key={item.id}
                    item={item}
                    viewport={viewport}
                    onClick={openEditDialog}
                  />
                ),
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid min-h-0 grid-rows-[1fr_1fr] gap-4">
        <SidePanel
          title="已过期计划"
          icon={<AlertTriangle className="size-4 text-rose-500" />}
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

const quadrantDotClass: Record<MatrixPlanLayoutItem["quadrant"], string> = {
  "important-urgent": "bg-rose-500",
  "important-not-urgent": "bg-amber-500",
  "not-important-urgent": "bg-sky-500",
  "not-important-not-urgent": "bg-slate-400",
};

// Map importance (1–10) to a dot diameter in px.
function dotDiameter(importanceScore: number): number {
  const score = Math.min(Math.max(importanceScore, 1), 10);
  return Math.round(12 + (score - 1) * 1.6);
}

function MatrixLegendItem({
  className,
  label,
}: {
  className: string;
  label: string;
}) {
  return (
    <span className="flex items-center gap-1">
      <span className={`size-2.5 rounded-full ${className}`} />
      {label}
    </span>
  );
}

function MatrixDot({
  item,
  now,
  viewport,
  onClick,
}: {
  item: MatrixPlanLayoutItem;
  now: Date;
  viewport: MatrixViewport;
  onClick: (plan: Plan) => void;
}) {
  const { plan } = item;
  const size = dotDiameter(plan.importanceScore);
  const position = matrixPosition(item.x, item.y, viewport);
  // Right-hand (urgent) dots grow their label leftward so it never runs off
  // the canvas edge; left-hand dots grow rightward. Either way the dot itself
  // stays centred on the point.
  const labelOnLeft = item.x > 0.3;
  const halfSize = size / 2;
  const transform = labelOnLeft
    ? `translate(calc(-100% + ${halfSize}px), -50%)`
    : `translate(${-halfSize}px, -50%)`;
  const tooltipVerticalClass = item.y > 0 ? "top-full mt-1.5" : "bottom-full mb-1.5";

  return (
    <button
      type="button"
      data-matrix-interactive="true"
      className={`group absolute z-10 flex items-center gap-1.5 hover:z-50 focus-visible:z-50 focus-visible:outline-none ${
        labelOnLeft ? "flex-row-reverse" : "flex-row"
      }`}
      style={{ left: position.left, top: position.top, transform }}
      onClick={() => onClick(plan)}
      title={plan.title}
    >
      <span
        className={`block shrink-0 rounded-full shadow-sm ring-2 ring-background transition group-hover:scale-110 ${
          quadrantDotClass[item.quadrant]
        }`}
        style={{ width: size, height: size }}
      />
      <span className="max-w-[100px] truncate text-[11px] font-medium text-foreground/80">
        {plan.title}
      </span>

      <span
        className={`pointer-events-none absolute left-1/2 z-50 hidden w-44 -translate-x-1/2 flex-col gap-0.5 rounded-md border bg-popover px-2 py-1.5 text-left shadow-lg group-hover:flex ${tooltipVerticalClass}`}
      >
        <span className="flex items-center justify-between gap-2">
          <span className="line-clamp-2 text-xs font-medium text-popover-foreground">
            {plan.title}
          </span>
          <Badge variant="outline" className="shrink-0 px-1 py-0 text-[10px]">
            {plan.importanceScore}
          </Badge>
        </span>
        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <Clock3 className="size-3" />
          {formatTimePressure(plan.endAt ?? plan.startAt, now)}
        </span>
      </span>
    </button>
  );
}

// Defensive fallback: clusters are disabled in the scatter view, but if one is
// ever produced it renders as a single labelled dot opening the top plan.
function MatrixClusterDot({
  item,
  viewport,
  onClick,
}: {
  item: MatrixClusterLayoutItem;
  viewport: MatrixViewport;
  onClick: (plan: Plan) => void;
}) {
  const strongestPlan = item.plans.reduce((strongest, plan) =>
    plan.importanceScore > strongest.importanceScore ? plan : strongest,
  );

  return (
    <button
      type="button"
      data-matrix-interactive="true"
      className="group absolute z-10 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 hover:z-50 focus-visible:z-50 focus-visible:outline-none"
      style={matrixPosition(item.x, item.y, viewport)}
      onClick={() => onClick(strongestPlan)}
      title={item.plans.map((plan) => plan.title).join("、")}
    >
      <span
        className={`flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white shadow-sm ring-2 ring-background ${
          quadrantDotClass[item.quadrant]
        }`}
      >
        {item.plans.length}
      </span>
      <span className="flex items-center gap-1 text-[11px] font-medium text-foreground/80">
        <Layers3 className="size-3" />
        {item.plans.length} 项
      </span>
    </button>
  );
}

function MatrixAxes({ viewport }: { viewport: MatrixViewport }) {
  const horizontal = getMatrixViewportCssPoint(viewport, {
    xPercent: 0,
    yPercent: 50,
  });
  const vertical = getMatrixViewportCssPoint(viewport, {
    xPercent: 50,
    yPercent: 0,
  });
  const center = getMatrixViewportCssPoint(viewport, {
    xPercent: 50,
    yPercent: 50,
  });
  const fullLength = getMatrixViewportCssLength(viewport, 100);
  const centerSize = getMatrixViewportCssPx(viewport, 112);

  return (
    <>
      <div
        className="absolute z-0 h-px bg-border"
        style={{ ...horizontal, width: fullLength }}
      />
      <div
        className="absolute z-0 w-px bg-border"
        style={{ ...vertical, height: fullLength }}
      />
      <div
        className="absolute z-0 -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-foreground/20 bg-muted/50"
        style={{ ...center, width: centerSize, height: centerSize }}
      />
    </>
  );
}

function matrixPosition(x: number, y: number, viewport: MatrixViewport) {
  return getMatrixViewportCssPoint(viewport, {
    xPercent: 50 + x * 42,
    yPercent: 50 - y * 42,
  });
}

const quadrantLabelCornerClass: Record<"tl" | "tr" | "bl" | "br", string> = {
  tl: "left-3 top-3",
  tr: "right-3 top-3",
  bl: "left-3 bottom-3",
  br: "right-3 bottom-3",
};

function QuadrantLabel({
  title,
  corner,
}: {
  title: string;
  corner: "tl" | "tr" | "bl" | "br";
}) {
  return (
    <div
      className={`pointer-events-none absolute z-30 rounded-md bg-muted/90 px-2 py-1 text-xs text-muted-foreground shadow-sm backdrop-blur-sm ${quadrantLabelCornerClass[corner]}`}
    >
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
        <p className="text-xs text-rose-600">
          {formatTimePressure(plan.endAt, new Date())}
        </p>
      ) : null}
    </div>
  );
}
