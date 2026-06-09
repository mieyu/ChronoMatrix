# Settings Dialog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a settings dialog that lets users adjust ChronoMatrix behavior for default view, matrix rules, reminders, and local/system appearance mode.

**Architecture:** Keep settings defaults and validation in pure domain helpers, persist user settings in Zustand stores, then pass settings-derived rules into existing views and runners. The UI is a toolbar gear button plus a modal dialog using the existing shadcn/Radix primitives.

**Tech Stack:** React 19, TypeScript, Zustand, Vitest, Tailwind CSS, shadcn/ui, lucide-react, date-fns.

---

### File Structure

- Create `src/domain/settings.ts`: pure settings defaults, validation, and rule conversion.
- Create `src/domain/settings.test.ts`: unit tests for defaults, validation, and conversion.
- Modify `src/domain/today.ts`: accept an optional important threshold for important-unscheduled classification.
- Modify `src/domain/today.test.ts`: cover custom important threshold behavior.
- Modify `src/domain/reviewStats.ts`: accept optional matrix rules for quadrant and important-plan calculations.
- Modify `src/domain/reviewStats.test.ts`: cover settings-backed important threshold and urgent window behavior.
- Modify `src/domain/reminders.ts`: support `enabled` and configurable due-soon lead time.
- Modify `src/domain/reminders.test.ts`: cover reminder disablement and `0` minute due-soon behavior.
- Create `src/state/settings.ts`: persisted settings store for default view, matrix, and reminder settings.
- Modify `src/state/ui.ts`: add settings dialog open/close state.
- Create `src/components/SettingsDialog.tsx`: modal settings UI grouped into common, matrix, reminders, and appearance sections.
- Modify `src/App.tsx`: add gear button, mount settings dialog, initialize default view, pass settings rules into views/runners.
- Modify `src/components/MatrixView.tsx`: accept `matrixRules` prop and use it for placement/layout.
- Modify `src/components/CalendarView.tsx`: accept `matrixRules` prop and use it for quadrant colors.
- Modify `src/components/TodayView.tsx`: accept `importantThreshold` prop and pass it into domain helpers.
- Modify `src/components/ReviewView.tsx`: accept `matrixRules` prop and pass it into review stats.
- Modify `src/components/ReminderRunner.tsx`: accept `reminderRules` prop.
- Modify `docs/PRODUCT.md`: document settings behavior.
- Modify `docs/QA.md`: add settings verification cases.

---

### Task 1: Settings Domain

**Files:**
- Create: `src/domain/settings.test.ts`
- Create: `src/domain/settings.ts`

- [ ] **Step 1: Write failing settings domain tests**

Create `src/domain/settings.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import {
  defaultAppSettings,
  getMatrixRulesFromSettings,
  getReminderRulesFromSettings,
  normalizeAppSettings,
  type AppSettings,
} from "./settings";

describe("app settings", () => {
  test("defaults preserve current product behavior", () => {
    expect(defaultAppSettings).toEqual({
      defaultView: "matrix",
      importantThreshold: 6,
      urgentWindowHours: 72,
      remindersEnabled: true,
      reminderLeadMinutes: 30,
    });
  });

  test("normalizes invalid persisted settings", () => {
    const settings = normalizeAppSettings({
      defaultView: "unknown",
      importantThreshold: 99,
      urgentWindowHours: -2,
      remindersEnabled: "yes",
      reminderLeadMinutes: 2000,
    });

    expect(settings).toEqual({
      defaultView: "matrix",
      importantThreshold: 10,
      urgentWindowHours: 1,
      remindersEnabled: true,
      reminderLeadMinutes: 1440,
    });
  });

  test("derives matrix rules from settings", () => {
    const settings: AppSettings = {
      ...defaultAppSettings,
      importantThreshold: 8,
      urgentWindowHours: 24,
    };

    expect(getMatrixRulesFromSettings(settings)).toEqual({
      urgentWindowHours: 24,
      pressureHorizonDays: 14,
      importantThreshold: 8,
    });
  });

  test("derives reminder rules from settings", () => {
    const settings: AppSettings = {
      ...defaultAppSettings,
      remindersEnabled: false,
      reminderLeadMinutes: 15,
    };

    expect(getReminderRulesFromSettings(settings)).toEqual({
      enabled: false,
      dueSoonMinutes: 15,
    });
  });
});
```

- [ ] **Step 2: Run red test**

Run:

```bash
npm test -- src/domain/settings.test.ts
```

Expected: FAIL because `src/domain/settings.ts` does not exist.

- [ ] **Step 3: Implement settings domain helpers**

Create `src/domain/settings.ts`:

```ts
import { importantScoreThreshold, maxImportanceScore, minImportanceScore } from "./importance";
import { defaultMatrixRules, type MatrixRules } from "./plan";
import type { PlanReminderRules } from "./reminders";

export type SettingsView = "today" | "matrix" | "calendar" | "list" | "review";

export interface AppSettings {
  defaultView: SettingsView;
  importantThreshold: number;
  urgentWindowHours: number;
  remindersEnabled: boolean;
  reminderLeadMinutes: number;
}

export const defaultAppSettings: AppSettings = {
  defaultView: "matrix",
  importantThreshold: importantScoreThreshold,
  urgentWindowHours: defaultMatrixRules.urgentWindowHours,
  remindersEnabled: true,
  reminderLeadMinutes: 30,
};

const appViews: SettingsView[] = ["today", "matrix", "calendar", "list", "review"];

export function normalizeAppSettings(value: unknown): AppSettings {
  const input = isRecord(value) ? value : {};

  return {
    defaultView: normalizeView(input.defaultView),
    importantThreshold: clampInteger(
      input.importantThreshold,
      minImportanceScore,
      maxImportanceScore,
      defaultAppSettings.importantThreshold,
    ),
    urgentWindowHours: clampInteger(
      input.urgentWindowHours,
      1,
      336,
      defaultAppSettings.urgentWindowHours,
    ),
    remindersEnabled:
      typeof input.remindersEnabled === "boolean"
        ? input.remindersEnabled
        : defaultAppSettings.remindersEnabled,
    reminderLeadMinutes: clampInteger(
      input.reminderLeadMinutes,
      0,
      1440,
      defaultAppSettings.reminderLeadMinutes,
    ),
  };
}

export function getMatrixRulesFromSettings(settings: AppSettings): MatrixRules {
  const normalized = normalizeAppSettings(settings);

  return {
    urgentWindowHours: normalized.urgentWindowHours,
    pressureHorizonDays: defaultMatrixRules.pressureHorizonDays,
    importantThreshold: normalized.importantThreshold,
  };
}

export function getReminderRulesFromSettings(
  settings: AppSettings,
): PlanReminderRules {
  const normalized = normalizeAppSettings(settings);

  return {
    enabled: normalized.remindersEnabled,
    dueSoonMinutes: normalized.reminderLeadMinutes,
  };
}

function normalizeView(value: unknown): SettingsView {
  return typeof value === "string" && appViews.includes(value as SettingsView)
    ? (value as SettingsView)
    : defaultAppSettings.defaultView;
}

function clampInteger(
  value: unknown,
  min: number,
  max: number,
  fallback: number,
): number {
  const numeric = typeof value === "number" ? value : fallback;

  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  return Math.min(Math.max(Math.round(numeric), min), max);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
```

- [ ] **Step 4: Run green test**

Run:

```bash
npm test -- src/domain/settings.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit settings domain**

Run:

```bash
git add src/domain/settings.ts src/domain/settings.test.ts
git commit -m "feat: add settings domain rules"
```

Expected: commit succeeds.

---

### Task 2: Settings-Backed Business Rules

**Files:**
- Modify: `src/domain/today.ts`
- Modify: `src/domain/today.test.ts`
- Modify: `src/domain/reviewStats.ts`
- Modify: `src/domain/reviewStats.test.ts`
- Modify: `src/domain/reminders.ts`
- Modify: `src/domain/reminders.test.ts`

- [ ] **Step 1: Write failing tests for custom today threshold**

Append to `src/domain/today.test.ts`:

```ts
test("uses a custom important threshold for important unscheduled plans", () => {
  const important = plan({
    id: "below-custom-threshold",
    importanceScore: 7,
  });

  const sections = Object.fromEntries(
    buildTodaySections([important], now, { importantThreshold: 8 }).map(
      (section) => [section.id, section.plans.map((item) => item.id)],
    ),
  );

  expect(sections.important_unscheduled).toEqual([]);
});
```

- [ ] **Step 2: Write failing tests for review and reminder settings**

Append to `src/domain/reviewStats.test.ts`:

```ts
test("uses custom matrix rules for quadrant review and important unscheduled plans", () => {
  const stats = buildReviewStats(
    [
      plan({
        id: "below-custom-threshold",
        importanceScore: 7,
        endAt: "2026-06-06T11:00:00.000Z",
      }),
      plan({
        id: "unscheduled-below-custom-threshold",
        importanceScore: 7,
      }),
    ],
    new Date("2026-06-06T10:30:00.000Z"),
    "this_week",
    { urgentWindowHours: 72, pressureHorizonDays: 14, importantThreshold: 8 },
  );

  expect(stats.quadrants["not-important-urgent"].total).toBe(1);
  expect(stats.quadrants["important-urgent"].total).toBe(0);
  expect(stats.importantUnscheduledPlans).toEqual([]);
});
```

Append to `src/domain/reminders.test.ts`:

```ts
test("returns no candidates when reminders are disabled", () => {
  const candidates = buildPlanReminderCandidates(
    [
      plan({
        id: "due-soon",
        endAt: "2026-06-06T10:59:00.000Z",
      }),
    ],
    now,
    new Set(),
    { enabled: false, dueSoonMinutes: 30 },
  );

  expect(candidates).toEqual([]);
});

test("does not create due-soon reminders when the lead time is zero", () => {
  const candidates = buildPlanReminderCandidates(
    [
      plan({
        id: "due-now",
        endAt: "2026-06-06T10:30:00.000Z",
      }),
    ],
    now,
    new Set(),
    { enabled: true, dueSoonMinutes: 0 },
  );

  expect(candidates).toEqual([]);
});
```

- [ ] **Step 3: Run red tests**

Run:

```bash
npm test -- src/domain/plan.test.ts src/domain/today.test.ts src/domain/reviewStats.test.ts src/domain/reminders.test.ts
```

Expected: FAIL because `buildTodaySections` and `buildReviewStats` do not yet accept settings-backed arguments, and `PlanReminderRules` does not include `enabled`.

- [ ] **Step 4: Implement settings-backed domain changes**

Change `src/domain/today.ts` so `buildTodaySections` accepts:

```ts
export interface TodayRules {
  importantThreshold: number;
}

const defaultTodayRules: TodayRules = {
  importantThreshold: importantScoreThreshold,
};

export function buildTodaySections(
  plans: Plan[],
  now = new Date(),
  rules: TodayRules = defaultTodayRules,
): TodaySection[] {
  // pass rules into getTodaySectionId
}
```

Change the important-unscheduled branch in `getTodaySectionId` to:

```ts
if (
  !plan.startAt &&
  !plan.endAt &&
  plan.importanceScore >= rules.importantThreshold
) {
  return "important_unscheduled";
}
```

Change `src/domain/reviewStats.ts` so `buildReviewStats` accepts:

```ts
export function buildReviewStats(
  plans: Plan[],
  now: Date,
  periodId: ReviewPeriodId,
  matrixRules: MatrixRules = defaultMatrixRules,
): ReviewStats {
  // use matrixRules for current quadrant and important checks
}
```

Replace `isImportant(plan)` with:

```ts
function isImportant(plan: Plan, importantThreshold: number): boolean {
  return plan.importanceScore >= importantThreshold;
}
```

Change `getCurrentReviewQuadrant` to receive `matrixRules` and use `matrixRules.urgentWindowHours` plus `matrixRules.importantThreshold`.

Change `src/domain/reminders.ts`:

```ts
export interface PlanReminderRules {
  enabled: boolean;
  dueSoonMinutes: number;
}

const defaultRules: PlanReminderRules = {
  enabled: true,
  dueSoonMinutes: 30,
};
```

At the top of `buildPlanReminderCandidates`, return `[]` when `rules.enabled` is false. In `getPlanReminderCandidate`, only produce a `due_soon` kind when `rules.dueSoonMinutes > 0`.

- [ ] **Step 5: Run green tests**

Run:

```bash
npm test -- src/domain/plan.test.ts src/domain/today.test.ts src/domain/reviewStats.test.ts src/domain/reminders.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit settings-backed business rules**

Run:

```bash
git add src/domain/today.ts src/domain/today.test.ts src/domain/reviewStats.ts src/domain/reviewStats.test.ts src/domain/reminders.ts src/domain/reminders.test.ts
git commit -m "feat: apply settings to planning rules"
```

Expected: commit succeeds.

---

### Task 3: Persisted Settings and UI State

**Files:**
- Create: `src/state/settings.ts`
- Modify: `src/state/ui.ts`

- [ ] **Step 1: Write the settings store**

Create `src/state/settings.ts`:

```ts
import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  defaultAppSettings,
  normalizeAppSettings,
  type AppSettings,
  type SettingsView,
} from "@/domain/settings";

interface SettingsState extends AppSettings {
  setDefaultView: (defaultView: SettingsView) => void;
  setImportantThreshold: (importantThreshold: number) => void;
  setUrgentWindowHours: (urgentWindowHours: number) => void;
  setRemindersEnabled: (remindersEnabled: boolean) => void;
  setReminderLeadMinutes: (reminderLeadMinutes: number) => void;
}

const STORAGE_KEY = "chronomatrix.settings";

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...defaultAppSettings,
      setDefaultView: (defaultView) =>
        set((state) => normalizeAppSettings({ ...state, defaultView })),
      setImportantThreshold: (importantThreshold) =>
        set((state) => normalizeAppSettings({ ...state, importantThreshold })),
      setUrgentWindowHours: (urgentWindowHours) =>
        set((state) => normalizeAppSettings({ ...state, urgentWindowHours })),
      setRemindersEnabled: (remindersEnabled) =>
        set((state) => normalizeAppSettings({ ...state, remindersEnabled })),
      setReminderLeadMinutes: (reminderLeadMinutes) =>
        set((state) => normalizeAppSettings({ ...state, reminderLeadMinutes })),
    }),
    {
      name: STORAGE_KEY,
      merge: (persisted, current) => ({
        ...current,
        ...normalizeAppSettings(persisted),
      }),
    },
  ),
);
```

- [ ] **Step 2: Add settings dialog UI state**

Modify `src/state/ui.ts`:

```ts
interface UiState {
  view: AppView;
  editingPlan: Plan | null;
  dialogOpen: boolean;
  searchOpen: boolean;
  settingsOpen: boolean;
  setView: (view: AppView) => void;
  openCreateDialog: () => void;
  openEditDialog: (plan: Plan) => void;
  closeDialog: () => void;
  openSearch: () => void;
  closeSearch: () => void;
  setSearchOpen: (open: boolean) => void;
  openSettings: () => void;
  closeSettings: () => void;
  setSettingsOpen: (open: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  view: "matrix",
  editingPlan: null,
  dialogOpen: false,
  searchOpen: false,
  settingsOpen: false,
  setView: (view) => set({ view }),
  openCreateDialog: () => set({ dialogOpen: true, editingPlan: null }),
  openEditDialog: (plan) => set({ dialogOpen: true, editingPlan: plan }),
  closeDialog: () => set({ dialogOpen: false, editingPlan: null }),
  openSearch: () => set({ searchOpen: true }),
  closeSearch: () => set({ searchOpen: false }),
  setSearchOpen: (open) => set({ searchOpen: open }),
  openSettings: () => set({ settingsOpen: true }),
  closeSettings: () => set({ settingsOpen: false }),
  setSettingsOpen: (open) => set({ settingsOpen: open }),
}));
```

- [ ] **Step 3: Run TypeScript build check**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 4: Commit persisted settings state**

Run:

```bash
git add src/state/settings.ts src/state/ui.ts
git commit -m "feat: persist app settings"
```

Expected: commit succeeds.

---

### Task 4: Settings Dialog UI and App Wiring

**Files:**
- Create: `src/components/SettingsDialog.tsx`
- Modify: `src/App.tsx`
- Modify: `src/components/MatrixView.tsx`
- Modify: `src/components/CalendarView.tsx`
- Modify: `src/components/TodayView.tsx`
- Modify: `src/components/ReviewView.tsx`
- Modify: `src/components/ReminderRunner.tsx`

- [ ] **Step 1: Create settings dialog component**

Create `src/components/SettingsDialog.tsx` with this structure:

```tsx
import { Monitor, Moon, Settings, Sun } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { themeLabels, type ThemePreference } from "@/domain/theme";
import { maxImportanceScore, minImportanceScore } from "@/domain/importance";
import { useSettingsStore } from "@/state/settings";
import { useThemeStore } from "@/state/theme";
import { useUiStore, type AppView } from "@/state/ui";
import type { ReactNode } from "react";

const viewLabels: Record<AppView, string> = {
  today: "今日",
  matrix: "矩阵",
  calendar: "日历",
  list: "列表",
  review: "复盘",
};

const themeOptions: Array<{ value: ThemePreference; label: string }> = [
  { value: "system", label: "跟随本地/系统" },
  { value: "light", label: themeLabels.light },
  { value: "dark", label: themeLabels.dark },
];

export function SettingsDialog() {
  const open = useUiStore((state) => state.settingsOpen);
  const setOpen = useUiStore((state) => state.setSettingsOpen);
  const settings = useSettingsStore();
  const themePreference = useThemeStore((state) => state.preference);
  const setThemePreference = useThemeStore((state) => state.setPreference);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="size-4" />
            设置
          </DialogTitle>
          <DialogDescription>
            调整默认视图、矩阵规则、提醒和外观偏好。
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5">
          <SettingsSection title="常规" description="打开应用时的默认工作区。">
            <Select
              value={settings.defaultView}
              onValueChange={(value) =>
                settings.setDefaultView(value as AppView)
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(viewLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingsSection>

          <SettingsSection title="矩阵" description="控制重要和紧急的判定边界。">
            <RangeSetting
              label="重要阈值"
              value={settings.importantThreshold}
              min={minImportanceScore}
              max={maxImportanceScore}
              suffix="分"
              onChange={settings.setImportantThreshold}
            />
            <RangeSetting
              label="紧急窗口"
              value={settings.urgentWindowHours}
              min={1}
              max={336}
              suffix="小时"
              onChange={settings.setUrgentWindowHours}
            />
          </SettingsSection>

          <SettingsSection title="提醒" description="控制正式计划的系统通知。">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label>启用提醒</Label>
                <p className="mt-1 text-xs text-muted-foreground">
                  关闭后不会发送即将截止或过期通知。
                </p>
              </div>
              <Button
                type="button"
                variant={settings.remindersEnabled ? "default" : "outline"}
                onClick={() =>
                  settings.setRemindersEnabled(!settings.remindersEnabled)
                }
              >
                {settings.remindersEnabled ? "已启用" : "已关闭"}
              </Button>
            </div>
            <RangeSetting
              label="提前提醒"
              value={settings.reminderLeadMinutes}
              min={0}
              max={1440}
              suffix="分钟"
              onChange={settings.setReminderLeadMinutes}
            />
          </SettingsSection>

          <SettingsSection title="外观" description="控制是否跟随本地系统外观。">
            <Select
              value={themePreference}
              onValueChange={(value) =>
                setThemePreference(value as ThemePreference)
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {themeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.value === "system" ? <Monitor /> : null}
                    {option.value === "light" ? <Sun /> : null}
                    {option.value === "dark" ? <Moon /> : null}
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingsSection>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

Add local helper components in the same file:

```tsx
function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="grid gap-3 rounded-lg border bg-card/70 p-3">
      <div>
        <h3 className="text-sm font-medium">{title}</h3>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="grid gap-3">{children}</div>
    </section>
  );
}

function RangeSetting({
  label,
  value,
  min,
  max,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  suffix: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-3">
        <Label>{label}</Label>
        <span className="text-sm font-medium tabular-nums">
          {value} {suffix}
        </span>
      </div>
      <Slider
        min={min}
        max={max}
        step={1}
        value={[value]}
        onValueChange={(nextValue) => onChange(nextValue[0] ?? value)}
      />
    </div>
  );
}
```

- [ ] **Step 2: Wire settings into app shell**

Modify `src/App.tsx` imports:

```tsx
import { Settings } from "lucide-react";
import { SettingsDialog } from "@/components/SettingsDialog";
import {
  getMatrixRulesFromSettings,
  getReminderRulesFromSettings,
} from "@/domain/settings";
import { useSettingsStore } from "@/state/settings";
```

Inside `App`, read settings:

```tsx
const openSettings = useUiStore((state) => state.openSettings);
const settings = useSettingsStore();
const matrixRules = useMemo(
  () => getMatrixRulesFromSettings(settings),
  [settings.importantThreshold, settings.urgentWindowHours],
);
const reminderRules = useMemo(
  () => getReminderRulesFromSettings(settings),
  [settings.remindersEnabled, settings.reminderLeadMinutes],
);
```

Initialize the default view once:

```tsx
useEffect(() => {
  setView(settings.defaultView);
}, []);
```

Add the toolbar button:

```tsx
<Button
  variant="outline"
  size="icon"
  onClick={openSettings}
  title="设置"
  aria-label="打开设置"
>
  <Settings />
</Button>
```

Pass settings into children:

```tsx
{view === "today" ? (
  <TodayView
    plans={plans}
    now={now}
    importantThreshold={matrixRules.importantThreshold}
  />
) : null}
{view === "matrix" ? (
  <MatrixView plans={plans} now={now} matrixRules={matrixRules} />
) : null}
{view === "calendar" ? (
  <CalendarView plans={plans} now={now} matrixRules={matrixRules} />
) : null}
{view === "review" ? (
  <ReviewView plans={plans} now={now} matrixRules={matrixRules} />
) : null}
<SettingsDialog />
<ReminderRunner plans={plans} now={now} rules={reminderRules} />
```

- [ ] **Step 3: Update view and runner props**

Modify `MatrixViewProps`:

```ts
interface MatrixViewProps {
  plans: Plan[];
  now: Date;
  matrixRules: MatrixRules;
}
```

Use `matrixRules` in placement and layout:

```ts
const placements = plans.map((plan) => ({
  plan,
  placement: getPlanMatrixPlacement(plan, now, matrixRules),
}));

const matrixLayoutItems = useMemo(
  () => buildMatrixLayoutItems(plans, now, matrixRules, matrixLayoutRules),
  [matrixLayoutRules, matrixRules, now, plans],
);
```

Modify `CalendarViewProps`:

```ts
interface CalendarViewProps {
  plans: Plan[];
  now: Date;
  matrixRules: MatrixRules;
}
```

Pass the rules into every quadrant lookup:

```ts
const quadrant = getPlanQuadrant(plan, now, matrixRules);
```

Modify `TodayViewProps`:

```ts
interface TodayViewProps {
  plans: Plan[];
  now: Date;
  importantThreshold: number;
}
```

Use:

```ts
const sections = useMemo(
  () => buildTodaySections(plans, now, { importantThreshold }),
  [importantThreshold, now, plans],
);
```

Modify `ReviewViewProps`:

```ts
interface ReviewViewProps {
  plans: Plan[];
  now: Date;
  matrixRules: MatrixRules;
}
```

Use:

```ts
const stats = useMemo(
  () => buildReviewStats(plans, now, period, matrixRules),
  [matrixRules, now, period, plans],
);
```

Modify `ReminderRunnerProps`:

```ts
interface ReminderRunnerProps {
  plans: Plan[];
  now: Date;
  rules: PlanReminderRules;
}
```

Use:

```ts
const candidates = buildPlanReminderCandidates(
  plans,
  now,
  listSentReminderKeys(),
  rules,
).slice(0, maxNotificationsPerPass);
```

- [ ] **Step 4: Run build check**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 5: Commit settings UI**

Run:

```bash
git add src/App.tsx src/components/SettingsDialog.tsx src/components/MatrixView.tsx src/components/CalendarView.tsx src/components/TodayView.tsx src/components/ReviewView.tsx src/components/ReminderRunner.tsx
git commit -m "feat: add settings dialog"
```

Expected: commit succeeds.

---

### Task 5: Documentation and Full Verification

**Files:**
- Modify: `docs/PRODUCT.md`
- Modify: `docs/QA.md`

- [ ] **Step 1: Update product documentation**

In `docs/PRODUCT.md`, add a `设置` section after `主题与深色模式`:

```md
## 设置

应用顶部工具栏提供设置入口。

- 常规设置可以选择默认打开视图。
- 矩阵设置可以调整重要阈值和紧急时间窗口。
- 提醒设置可以启用或关闭提醒，并调整提前提醒时间。
- 外观设置可以选择跟随本地系统外观、浅色或深色。
- 设置保存在本地，下次打开自动恢复。
```

- [ ] **Step 2: Update QA documentation**

In `docs/QA.md`, add settings verification cases:

```md
## 设置

- 点击顶部齿轮按钮会打开设置弹窗。
- 修改默认打开视图后，重新打开应用时进入对应视图。
- 调高重要阈值后，低于阈值的计划不再进入重要象限或重要未排期列表。
- 缩短紧急窗口后，超出窗口的计划不再显示为紧急。
- 关闭提醒后，即将截止和过期计划不会触发系统通知。
- 外观选择跟随本地系统时，系统明暗外观变化会同步到应用。
- 外观选择浅色或深色时，应用不再随系统明暗外观变化。
```

- [ ] **Step 3: Run focused tests**

Run:

```bash
npm test -- src/domain/settings.test.ts src/domain/plan.test.ts src/domain/today.test.ts src/domain/reviewStats.test.ts src/domain/reminders.test.ts
```

Expected: PASS.

- [ ] **Step 4: Run all tests**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 5: Run production build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 6: Start dev server for manual verification**

Run:

```bash
npm run dev -- --host 127.0.0.1
```

Expected: Vite starts and prints a localhost URL.

- [ ] **Step 7: Verify in browser**

Open the Vite URL in the in-app browser and verify:

- the gear button opens the settings dialog
- settings sections render without overlapping text
- changing matrix sliders immediately changes matrix/today/review classification
- changing reminder settings does not crash the runner
- changing appearance between follow-system, light, and dark updates the page

- [ ] **Step 8: Commit docs and verification fixes**

Run:

```bash
git add docs/PRODUCT.md docs/QA.md
git commit -m "docs: document app settings"
```

Expected: commit succeeds.

---

### Self-Review Checklist

- Spec coverage: all approved settings are covered by Tasks 1 through 5.
- Scope: no account, sync, category, import/export, shortcut, or notification-channel settings are included.
- Type consistency: `AppSettings`, `MatrixRules`, `PlanReminderRules`, and `AppView` are introduced or reused before later tasks reference them.
- Verification: domain tests, full test suite, production build, and browser verification are included.
