import {
  Children,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FocusEvent,
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
  const matrixLayoutRules = useMemo(
    () => getMatrixLayoutRulesForScale(viewport.scale),
    [viewport.scale],
  );
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

              <QuadrantLabel
                title="重要 / 不紧急"
                viewport={viewport}
                xPercent={2}
                yPercent={2}
              />
              <QuadrantLabel
                anchorX="right"
                title="重要 / 紧急"
                viewport={viewport}
                xPercent={98}
                yPercent={2}
              />
              <QuadrantLabel
                anchorY="bottom"
                title="不重要 / 不紧急"
                viewport={viewport}
                xPercent={2}
                yPercent={98}
              />
              <QuadrantLabel
                anchorX="right"
                anchorY="bottom"
                title="不重要 / 紧急"
                viewport={viewport}
                xPercent={98}
                yPercent={98}
              />

              {matrixLayoutItems.map((item) =>
                item.kind === "plan" ? (
                  <MatrixPlanCard
                    key={item.id}
                    item={item}
                    now={now}
                    viewport={viewport}
                    onClick={openEditDialog}
                  />
                ) : (
                  <MatrixClusterCard
                    key={item.id}
                    item={item}
                    now={now}
                    viewport={viewport}
                    onPlanClick={openEditDialog}
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

function MatrixPlanCard({
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

  return (
    <button
      type="button"
      data-matrix-interactive="true"
      className="absolute z-10 w-44 -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-card p-2 text-left shadow-sm transition hover:z-50 hover:border-ring hover:shadow-md focus-visible:z-50 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      style={matrixPosition(item.x, item.y, viewport)}
      onClick={() => onClick(plan)}
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
}

function MatrixClusterCard({
  item,
  now,
  viewport,
  onPlanClick,
}: {
  item: MatrixClusterLayoutItem;
  now: Date;
  viewport: MatrixViewport;
  onPlanClick: (plan: Plan) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const strongestPlan = item.plans.reduce((strongest, plan) =>
    plan.importanceScore > strongest.importanceScore ? plan : strongest,
  );
  const previewTitle = item.plans
    .slice(0, 2)
    .map((plan) => plan.title)
    .join(" / ");
  const panelVerticalClass = item.quadrant.startsWith("important")
    ? "top-[calc(100%+0.5rem)]"
    : "bottom-[calc(100%+0.5rem)]";

  function handleBlur(event: FocusEvent<HTMLDivElement>) {
    const nextTarget = event.relatedTarget;

    if (!nextTarget || !event.currentTarget.contains(nextTarget as Node)) {
      setExpanded(false);
    }
  }

  return (
    <div
      data-matrix-interactive="true"
      className="absolute z-20 -translate-x-1/2 -translate-y-1/2 transition hover:z-50 focus-within:z-50"
      style={matrixPosition(item.x, item.y, viewport)}
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      onFocusCapture={() => setExpanded(true)}
      onBlurCapture={handleBlur}
    >
      <button
        type="button"
        className="w-48 rounded-lg border border-dashed bg-card p-2 text-left shadow-sm transition hover:border-ring hover:shadow-md focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        onClick={() => setExpanded((current) => !current)}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-sm font-medium">
            <Layers3 className="size-4" />
            {item.plans.length} 个计划
          </span>
          <Badge variant="outline" className="shrink-0">
            {strongestPlan.importanceScore}
          </Badge>
        </div>
        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
          {previewTitle}
        </p>
      </button>

      {expanded ? (
        <div
          data-matrix-wheel-lock="true"
          className={`absolute left-1/2 z-50 w-64 -translate-x-1/2 overscroll-contain rounded-lg border bg-popover p-2 text-popover-foreground shadow-lg ${panelVerticalClass}`}
        >
          <div className="grid max-h-64 gap-1 overflow-auto">
            {item.plans.map((plan) => (
              <button
                key={plan.id}
                type="button"
                className="rounded-md p-2 text-left transition hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                onClick={() => onPlanClick(plan)}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="line-clamp-2 text-sm font-medium">
                    {plan.title}
                  </span>
                  <Badge variant="outline" className="shrink-0">
                    {plan.importanceScore}
                  </Badge>
                </div>
                <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock3 className="size-3" />
                  {formatTimePressure(plan.endAt ?? plan.startAt, now)}
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
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

function QuadrantLabel({
  title,
  viewport,
  xPercent,
  yPercent,
  anchorX = "left",
  anchorY = "top",
}: {
  title: string;
  viewport: MatrixViewport;
  xPercent: number;
  yPercent: number;
  anchorX?: "left" | "right";
  anchorY?: "top" | "bottom";
}) {
  const translateX = anchorX === "right" ? "-translate-x-full" : "";
  const translateY = anchorY === "bottom" ? "-translate-y-full" : "";

  return (
    <div
      className={`absolute z-20 rounded-md bg-muted px-2 py-1 text-xs ${translateX} ${translateY}`}
      style={getMatrixViewportCssPoint(viewport, { xPercent, yPercent })}
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
        <p className="text-xs text-destructive">
          {formatTimePressure(plan.endAt, new Date())}
        </p>
      ) : null}
    </div>
  );
}
