# Quick Date Shortcuts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one-click local date shortcuts to the existing plan dialog.

**Architecture:** Put date math in a small domain helper so the React dialog only renders shortcut buttons and updates existing form state. Keep persistence unchanged: the selected shortcut writes into the current `datetime-local` input value and existing save logic converts it to ISO.

**Tech Stack:** React, TypeScript, date-fns, Vitest, existing shadcn/ui `Button`.

---

## File Structure

- Create `src/domain/dateShortcuts.ts`: shortcut definitions, shortcut id types, and local date resolution for `datetime-local` values.
- Create `src/domain/dateShortcuts.test.ts`: focused unit tests for all shortcut calculations.
- Modify `src/components/PlanDialog.tsx`: render shortcut buttons in `OptionalDateTimeField` and pass start/end shortcut options from the helper.

### Task 1: Date Shortcut Tests

**Files:**
- Create: `src/domain/dateShortcuts.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/domain/dateShortcuts.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import {
  buildDateShortcutOptions,
  endDateShortcuts,
  resolveDateShortcutValue,
  startDateShortcuts,
} from "./dateShortcuts";

describe("resolveDateShortcutValue", () => {
  test("formats now at the current local minute", () => {
    expect(
      resolveDateShortcutValue("now", new Date(2026, 5, 5, 10, 37, 45, 999)),
    ).toBe("2026-06-05T10:37");
  });

  test("sets today and tomorrow morning shortcuts", () => {
    const now = new Date(2026, 5, 5, 10, 30);

    expect(resolveDateShortcutValue("today-morning", now)).toBe(
      "2026-06-05T09:00",
    );
    expect(resolveDateShortcutValue("tomorrow-morning", now)).toBe(
      "2026-06-06T09:00",
    );
  });

  test("sets today and tomorrow evening shortcuts", () => {
    const now = new Date(2026, 5, 5, 10, 30);

    expect(resolveDateShortcutValue("today-evening", now)).toBe(
      "2026-06-05T18:00",
    );
    expect(resolveDateShortcutValue("tomorrow-evening", now)).toBe(
      "2026-06-06T18:00",
    );
  });

  test("uses Friday in the current week before or on Friday", () => {
    expect(
      resolveDateShortcutValue(
        "this-friday-evening",
        new Date(2026, 5, 3, 12, 0),
      ),
    ).toBe("2026-06-05T18:00");

    expect(
      resolveDateShortcutValue(
        "this-friday-evening",
        new Date(2026, 5, 5, 20, 0),
      ),
    ).toBe("2026-06-05T18:00");
  });

  test("uses the following Friday after Friday has passed", () => {
    expect(
      resolveDateShortcutValue(
        "this-friday-evening",
        new Date(2026, 5, 6, 12, 0),
      ),
    ).toBe("2026-06-12T18:00");
  });

  test("uses Monday after the current week for next Monday", () => {
    expect(
      resolveDateShortcutValue(
        "next-monday-evening",
        new Date(2026, 5, 5, 10, 30),
      ),
    ).toBe("2026-06-08T18:00");

    expect(
      resolveDateShortcutValue(
        "next-monday-evening",
        new Date(2026, 5, 7, 10, 30),
      ),
    ).toBe("2026-06-08T18:00");
  });
});

describe("buildDateShortcutOptions", () => {
  test("resolves labels and values for start shortcuts", () => {
    const options = buildDateShortcutOptions(
      startDateShortcuts,
      new Date(2026, 5, 5, 10, 37),
    );

    expect(options).toEqual([
      { id: "now", label: "现在", value: "2026-06-05T10:37" },
      { id: "today-morning", label: "今天 09:00", value: "2026-06-05T09:00" },
      { id: "tomorrow-morning", label: "明天 09:00", value: "2026-06-06T09:00" },
    ]);
  });

  test("resolves labels and values for end shortcuts", () => {
    const options = buildDateShortcutOptions(
      endDateShortcuts,
      new Date(2026, 5, 6, 10, 37),
    );

    expect(options).toEqual([
      { id: "today-evening", label: "今天 18:00", value: "2026-06-06T18:00" },
      { id: "tomorrow-evening", label: "明天 18:00", value: "2026-06-07T18:00" },
      {
        id: "this-friday-evening",
        label: "本周五 18:00",
        value: "2026-06-12T18:00",
      },
      {
        id: "next-monday-evening",
        label: "下周一 18:00",
        value: "2026-06-08T18:00",
      },
    ]);
  });
});
```

- [ ] **Step 2: Run the red test**

Run:

```bash
npm test -- src/domain/dateShortcuts.test.ts
```

Expected: FAIL because `src/domain/dateShortcuts.ts` does not exist.

### Task 2: Date Shortcut Domain Helper

**Files:**
- Create: `src/domain/dateShortcuts.ts`
- Test: `src/domain/dateShortcuts.test.ts`

- [ ] **Step 1: Implement the helper**

Create `src/domain/dateShortcuts.ts`:

```ts
import { addDays, format, isAfter, startOfDay, startOfWeek } from "date-fns";

const dateTimeLocalFormat = "yyyy-MM-dd'T'HH:mm";

export type DateShortcutId =
  | "now"
  | "today-morning"
  | "tomorrow-morning"
  | "today-evening"
  | "tomorrow-evening"
  | "this-friday-evening"
  | "next-monday-evening";

export interface DateShortcutDefinition {
  id: DateShortcutId;
  label: string;
}

export interface DateShortcutOption extends DateShortcutDefinition {
  value: string;
}

export const startDateShortcuts: DateShortcutDefinition[] = [
  { id: "now", label: "现在" },
  { id: "today-morning", label: "今天 09:00" },
  { id: "tomorrow-morning", label: "明天 09:00" },
];

export const endDateShortcuts: DateShortcutDefinition[] = [
  { id: "today-evening", label: "今天 18:00" },
  { id: "tomorrow-evening", label: "明天 18:00" },
  { id: "this-friday-evening", label: "本周五 18:00" },
  { id: "next-monday-evening", label: "下周一 18:00" },
];

export function buildDateShortcutOptions(
  shortcuts: DateShortcutDefinition[],
  now = new Date(),
): DateShortcutOption[] {
  return shortcuts.map((shortcut) => ({
    ...shortcut,
    value: resolveDateShortcutValue(shortcut.id, now),
  }));
}

export function resolveDateShortcutValue(
  id: DateShortcutId,
  now = new Date(),
): string {
  switch (id) {
    case "now":
      return format(now, dateTimeLocalFormat);
    case "today-morning":
      return format(atLocalTime(now, 9), dateTimeLocalFormat);
    case "tomorrow-morning":
      return format(atLocalTime(addDays(now, 1), 9), dateTimeLocalFormat);
    case "today-evening":
      return format(atLocalTime(now, 18), dateTimeLocalFormat);
    case "tomorrow-evening":
      return format(atLocalTime(addDays(now, 1), 18), dateTimeLocalFormat);
    case "this-friday-evening":
      return format(atLocalTime(getUpcomingFriday(now), 18), dateTimeLocalFormat);
    case "next-monday-evening":
      return format(atLocalTime(getNextMonday(now), 18), dateTimeLocalFormat);
  }
}

function atLocalTime(date: Date, hour: number): Date {
  const localDate = new Date(date);
  localDate.setHours(hour, 0, 0, 0);
  return localDate;
}

function getUpcomingFriday(now: Date): Date {
  const monday = startOfWeek(now, { weekStartsOn: 1 });
  const friday = addDays(monday, 4);

  return isAfter(startOfDay(now), startOfDay(friday)) ? addDays(friday, 7) : friday;
}

function getNextMonday(now: Date): Date {
  return addDays(startOfWeek(now, { weekStartsOn: 1 }), 7);
}
```

- [ ] **Step 2: Run the helper tests**

Run:

```bash
npm test -- src/domain/dateShortcuts.test.ts
```

Expected: PASS.

- [ ] **Step 3: Commit the helper and tests**

Run:

```bash
git add src/domain/dateShortcuts.ts src/domain/dateShortcuts.test.ts
git commit -m "Add quick date shortcut helpers"
```

Expected: commit succeeds.

### Task 3: Plan Dialog Shortcut UI

**Files:**
- Modify: `src/components/PlanDialog.tsx`
- Test: `src/domain/dateShortcuts.test.ts`

- [ ] **Step 1: Import shortcut helpers**

In `src/components/PlanDialog.tsx`, add this import after the data import:

```ts
import {
  buildDateShortcutOptions,
  endDateShortcuts,
  startDateShortcuts,
  type DateShortcutOption,
} from "@/domain/dateShortcuts";
```

- [ ] **Step 2: Build shortcut options inside `PlanDialog`**

Inside `PlanDialog`, after the state declarations, add:

```ts
  const shortcutReference = new Date();
  const startShortcutOptions = buildDateShortcutOptions(
    startDateShortcuts,
    shortcutReference,
  );
  const endShortcutOptions = buildDateShortcutOptions(
    endDateShortcuts,
    shortcutReference,
  );
```

- [ ] **Step 3: Pass shortcuts to both date fields**

Update the `OptionalDateTimeField` calls:

```tsx
            <OptionalDateTimeField
              id="plan-start"
              label="开始时间"
              emptyLabel="未设置开始时间"
              icon={<CalendarClock className="size-4" />}
              value={startAt}
              shortcuts={startShortcutOptions}
              onChange={setStartAt}
            />
            <OptionalDateTimeField
              id="plan-end"
              label="结束时间"
              emptyLabel="未设置结束时间"
              icon={<Clock3 className="size-4" />}
              value={endAt}
              shortcuts={endShortcutOptions}
              onChange={setEndAt}
            />
```

- [ ] **Step 4: Extend `OptionalDateTimeField` props**

Update the function signature props:

```ts
function OptionalDateTimeField({
  id,
  label,
  emptyLabel,
  icon,
  value,
  shortcuts = [],
  onChange,
}: {
  id: string;
  label: string;
  emptyLabel: string;
  icon: ReactNode;
  value: string;
  shortcuts?: DateShortcutOption[];
  onChange: (value: string) => void;
}) {
```

- [ ] **Step 5: Render compact shortcut buttons below the input**

Inside `OptionalDateTimeField`, after the `Input` element and before the helper paragraph, add:

```tsx
      {shortcuts.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {shortcuts.map((shortcut) => (
            <Button
              key={shortcut.id}
              type="button"
              variant="outline"
              size="xs"
              onClick={() => onChange(shortcut.value)}
            >
              {shortcut.label}
            </Button>
          ))}
        </div>
      ) : null}
```

- [ ] **Step 6: Run TypeScript build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 7: Commit the dialog UI**

Run:

```bash
git add src/components/PlanDialog.tsx
git commit -m "Add date shortcut buttons to plan dialog"
```

Expected: commit succeeds.

### Task 4: Final Verification

**Files:**
- No source edits expected.

- [ ] **Step 1: Run focused tests**

Run:

```bash
npm test -- src/domain/dateShortcuts.test.ts src/domain/calendar.test.ts src/domain/plan.test.ts
```

Expected: all listed tests pass.

- [ ] **Step 2: Run full build**

Run:

```bash
npm run build
```

Expected: TypeScript and Vite build pass.

- [ ] **Step 3: Check working tree**

Run:

```bash
git status --short
```

Expected: no unstaged source changes unless this plan document itself is intentionally uncommitted.

## Self-Review

- Spec coverage: the plan adds shortcut buttons, keeps manual entry/clear behavior, avoids storage changes, avoids new dependencies, and tests the date math.
- Placeholder scan: no placeholder markers or vague implementation steps remain.
- Type consistency: `DateShortcutOption`, `buildDateShortcutOptions`, `startDateShortcuts`, and `endDateShortcuts` are defined before React uses them.
