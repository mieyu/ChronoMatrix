# Today View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Today tab that groups existing plans into actionable daily sections.

**Architecture:** Keep Today grouping rules in `src/domain/today.ts` and render them through a dedicated `TodayView` component. Reuse existing plan editing, completion mutation, and React Query invalidation paths without changing persistence.

**Tech Stack:** React, TypeScript, date-fns, Vitest, TanStack Query, Zustand, existing shadcn/ui components, lucide-react icons.

---

## File Structure

- Create `src/domain/today.ts`: Today section ids, labels, grouping rules, ordering rules, and count helpers.
- Create `src/domain/today.test.ts`: unit tests for section priority, exclusions, and ordering.
- Create `src/components/TodayView.tsx`: Today tab UI with four sections and plan row actions.
- Modify `src/state/ui.ts`: add `today` to `AppView`.
- Modify `src/App.tsx`: add the Today tab trigger and render `TodayView`.

### Task 1: Today Domain Tests

**Files:**
- Create: `src/domain/today.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/domain/today.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import { buildTodaySections } from "./today";
import type { Plan } from "./plan";

const now = new Date(2026, 5, 6, 10, 30);

function plan(overrides: Partial<Plan> = {}): Plan {
  return {
    id: "plan-1",
    title: "Draft launch plan",
    description: "",
    importanceScore: 70,
    startAt: null,
    endAt: null,
    storedStatus: "not_started",
    categoryId: null,
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
    completedAt: null,
    archivedAt: null,
    ...overrides,
  };
}

function sectionIds(plans: Plan[]) {
  return Object.fromEntries(
    buildTodaySections(plans, now).map((section) => [
      section.id,
      section.plans.map((item) => item.id),
    ]),
  );
}

describe("buildTodaySections", () => {
  test("puts expired unfinished plans only in the expired section", () => {
    const expired = plan({
      id: "expired",
      startAt: "2026-06-05T09:00:00.000Z",
      endAt: "2026-06-05T18:00:00.000Z",
    });

    expect(sectionIds([expired])).toEqual({
      expired: ["expired"],
      due_today: [],
      starts_today: [],
      important_unscheduled: [],
    });
  });

  test("puts plans ending today in the due today section", () => {
    const dueToday = plan({
      id: "due-today",
      endAt: "2026-06-06T18:00:00.000Z",
    });

    expect(sectionIds([dueToday]).due_today).toEqual(["due-today"]);
  });

  test("puts plans starting today in starts today when not due today", () => {
    const startsToday = plan({
      id: "starts-today",
      startAt: "2026-06-06T09:00:00.000Z",
      endAt: "2026-06-08T18:00:00.000Z",
    });

    expect(sectionIds([startsToday]).starts_today).toEqual(["starts-today"]);
  });

  test("puts important unscheduled plans in the important unscheduled section", () => {
    const important = plan({
      id: "important",
      importanceScore: 85,
    });

    expect(sectionIds([important]).important_unscheduled).toEqual(["important"]);
  });

  test("excludes completed and archived plans", () => {
    const completed = plan({
      id: "completed",
      storedStatus: "completed",
      endAt: "2026-06-06T18:00:00.000Z",
    });
    const archived = plan({
      id: "archived",
      storedStatus: "archived",
      endAt: "2026-06-06T18:00:00.000Z",
    });

    expect(sectionIds([completed, archived])).toEqual({
      expired: [],
      due_today: [],
      starts_today: [],
      important_unscheduled: [],
    });
  });

  test("uses the highest priority section when a plan qualifies for multiple sections", () => {
    const dueAndStartsToday = plan({
      id: "due-and-starts",
      startAt: "2026-06-06T09:00:00.000Z",
      endAt: "2026-06-06T18:00:00.000Z",
    });

    expect(sectionIds([dueAndStartsToday])).toEqual({
      expired: [],
      due_today: ["due-and-starts"],
      starts_today: [],
      important_unscheduled: [],
    });
  });

  test("sorts each section by its rule", () => {
    const sections = sectionIds([
      plan({
        id: "expired-newer",
        endAt: "2026-06-05T18:00:00.000Z",
      }),
      plan({
        id: "expired-older",
        endAt: "2026-06-04T18:00:00.000Z",
      }),
      plan({
        id: "due-later",
        endAt: "2026-06-06T20:00:00.000Z",
      }),
      plan({
        id: "due-sooner",
        endAt: "2026-06-06T12:00:00.000Z",
      }),
      plan({
        id: "starts-later",
        startAt: "2026-06-06T14:00:00.000Z",
        endAt: "2026-06-08T18:00:00.000Z",
      }),
      plan({
        id: "starts-sooner",
        startAt: "2026-06-06T08:00:00.000Z",
        endAt: "2026-06-08T18:00:00.000Z",
      }),
      plan({
        id: "important-lower",
        importanceScore: 70,
        updatedAt: "2026-06-05T10:00:00.000Z",
      }),
      plan({
        id: "important-higher",
        importanceScore: 90,
        updatedAt: "2026-06-04T10:00:00.000Z",
      }),
    ]);

    expect(sections.expired).toEqual(["expired-older", "expired-newer"]);
    expect(sections.due_today).toEqual(["due-sooner", "due-later"]);
    expect(sections.starts_today).toEqual(["starts-sooner", "starts-later"]);
    expect(sections.important_unscheduled).toEqual([
      "important-higher",
      "important-lower",
    ]);
  });
});
```

- [ ] **Step 2: Run the red test**

Run:

```bash
npm test -- src/domain/today.test.ts
```

Expected: FAIL because `src/domain/today.ts` does not exist.

### Task 2: Today Domain Helper

**Files:**
- Create: `src/domain/today.ts`
- Test: `src/domain/today.test.ts`

- [ ] **Step 1: Implement Today grouping**

Create `src/domain/today.ts`:

```ts
import { isSameDay } from "date-fns";
import { deriveEffectiveStatus, type Plan } from "./plan";

export type TodaySectionId =
  | "expired"
  | "due_today"
  | "starts_today"
  | "important_unscheduled";

export interface TodaySection {
  id: TodaySectionId;
  title: string;
  description: string;
  emptyLabel: string;
  plans: Plan[];
}

const importantThreshold = 60;

const sectionMeta: Omit<TodaySection, "plans">[] = [
  {
    id: "expired",
    title: "已过期",
    description: "需要处理或重新安排的计划",
    emptyLabel: "没有过期计划",
  },
  {
    id: "due_today",
    title: "今天截止",
    description: "今天必须交付或结束",
    emptyLabel: "今天没有截止计划",
  },
  {
    id: "starts_today",
    title: "今天开始",
    description: "今天进入执行窗口",
    emptyLabel: "今天没有新开始的计划",
  },
  {
    id: "important_unscheduled",
    title: "重要未排期",
    description: "值得今天顺手安排时间",
    emptyLabel: "没有重要未排期计划",
  },
];

export function buildTodaySections(
  plans: Plan[],
  now = new Date(),
): TodaySection[] {
  const groups: Record<TodaySectionId, Plan[]> = {
    expired: [],
    due_today: [],
    starts_today: [],
    important_unscheduled: [],
  };

  for (const plan of plans) {
    const section = getTodaySectionId(plan, now);

    if (section) {
      groups[section].push(plan);
    }
  }

  groups.expired.sort((a, b) => getTime(a.endAt) - getTime(b.endAt));
  groups.due_today.sort((a, b) => getTime(a.endAt) - getTime(b.endAt));
  groups.starts_today.sort((a, b) => getTime(a.startAt) - getTime(b.startAt));
  groups.important_unscheduled.sort(
    (a, b) =>
      b.importanceScore - a.importanceScore ||
      getTime(b.updatedAt) - getTime(a.updatedAt),
  );

  return sectionMeta.map((section) => ({
    ...section,
    plans: groups[section.id],
  }));
}

export function getTodayPlanCount(sections: TodaySection[]): number {
  return sections.reduce((total, section) => total + section.plans.length, 0);
}

function getTodaySectionId(plan: Plan, now: Date): TodaySectionId | null {
  const effectiveStatus = deriveEffectiveStatus(plan, now);

  if (effectiveStatus === "completed" || effectiveStatus === "archived") {
    return null;
  }

  if (effectiveStatus === "expired") {
    return "expired";
  }

  if (plan.endAt && isSameDay(new Date(plan.endAt), now)) {
    return "due_today";
  }

  if (plan.startAt && isSameDay(new Date(plan.startAt), now)) {
    return "starts_today";
  }

  if (!plan.startAt && !plan.endAt && plan.importanceScore >= importantThreshold) {
    return "important_unscheduled";
  }

  return null;
}

function getTime(iso: string | null): number {
  return iso ? new Date(iso).getTime() : Number.POSITIVE_INFINITY;
}
```

- [ ] **Step 2: Run helper tests**

Run:

```bash
npm test -- src/domain/today.test.ts
```

Expected: PASS.

- [ ] **Step 3: Commit Today domain helper**

Run:

```bash
git add src/domain/today.ts src/domain/today.test.ts
git commit -m "Add today view grouping rules"
```

Expected: commit succeeds.

### Task 3: Today View UI

**Files:**
- Create: `src/components/TodayView.tsx`
- Test: `src/domain/today.test.ts`

- [ ] **Step 1: Create the Today view component**

Create `src/components/TodayView.tsx`:

```tsx
import { useMemo, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CalendarClock, CheckCircle2, Pencil, Sparkles } from "lucide-react";
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
  expired: <AlertTriangle className="size-4 text-destructive" />,
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
        <Badge variant={section.id === "expired" ? "destructive" : "secondary"}>
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
```

- [ ] **Step 2: Run build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 3: Commit Today view component**

Run:

```bash
git add src/components/TodayView.tsx
git commit -m "Add today view component"
```

Expected: commit succeeds.

### Task 4: App Tab Wiring

**Files:**
- Modify: `src/state/ui.ts`
- Modify: `src/App.tsx`
- Test: `src/domain/today.test.ts`

- [ ] **Step 1: Add `today` to `AppView`**

In `src/state/ui.ts`, change:

```ts
export type AppView = "matrix" | "calendar" | "list";
```

to:

```ts
export type AppView = "today" | "matrix" | "calendar" | "list";
```

Keep the default:

```ts
  view: "matrix",
```

- [ ] **Step 2: Import `TodayView` and icon**

In `src/App.tsx`, add `SunMedium` to the lucide import and add:

```ts
import { TodayView } from "@/components/TodayView";
```

- [ ] **Step 3: Add view label**

In `src/App.tsx`, update `viewLabels`:

```ts
const viewLabels: Record<AppView, string> = {
  today: "今日",
  matrix: "矩阵",
  calendar: "日历",
  list: "列表",
};
```

- [ ] **Step 4: Add Today tab trigger**

In the header `TabsList`, add this trigger before Matrix:

```tsx
              <TabsTrigger value="today">
                <SunMedium />
                {viewLabels.today}
              </TabsTrigger>
```

- [ ] **Step 5: Render Today view**

In the main content conditional block, add:

```tsx
            {view === "today" ? <TodayView plans={plans} now={now} /> : null}
```

before the Matrix conditional.

- [ ] **Step 6: Run full tests and build**

Run:

```bash
npm test
npm run build
```

Expected: PASS for both commands.

- [ ] **Step 7: Commit app wiring**

Run:

```bash
git add src/state/ui.ts src/App.tsx
git commit -m "Add today tab to app shell"
```

Expected: commit succeeds.

### Task 5: Visual Verification

**Files:**
- No source edits expected.

- [ ] **Step 1: Start Vite dev server**

Run:

```bash
npm run dev -- --host 127.0.0.1
```

Expected: Vite serves `http://127.0.0.1:1420/`.

- [ ] **Step 2: Open browser and verify Today tab**

Use a browser or headless Chrome CDP to verify:

- `今日` tab is visible.
- Clicking `今日` renders the `今日计划` heading.
- The four section headings are visible: `已过期`, `今天截止`, `今天开始`, `重要未排期`.
- Existing tabs still exist: `矩阵`, `日历`, `列表`.

- [ ] **Step 3: Stop dev server**

Stop the Vite process with Ctrl-C.

### Task 6: Final Verification

**Files:**
- No source edits expected.

- [ ] **Step 1: Run final full tests**

Run:

```bash
npm test
```

Expected: all test files pass.

- [ ] **Step 2: Run final production build**

Run:

```bash
npm run build
```

Expected: TypeScript and Vite build pass.

- [ ] **Step 3: Check git status**

Run:

```bash
git status --short
```

Expected: clean working tree.

## Self-Review

- Spec coverage: the plan adds the Today tab, four sections, edit and complete actions, local-date grouping, exclusion rules, and tests.
- Placeholder scan: no placeholder markers or vague implementation steps remain.
- Type consistency: `TodaySectionId`, `TodaySection`, `buildTodaySections`, and `getTodayPlanCount` are defined in the domain task before React imports them.
