# Today View Design

## Goal

Add a Today view that answers "what should I look at first today?" without changing the storage model or introducing scheduling automation.

## Scope

Included:

- Add a `今日` top-level tab alongside Matrix, Calendar, and List.
- Group existing plans into four Today sections:
  - `已过期`: unfinished plans whose effective status is expired.
  - `今天截止`: unfinished plans whose `endAt` falls on the local current date.
  - `今天开始`: unfinished plans whose `startAt` falls on the local current date.
  - `重要未排期`: unfinished plans with no start/end time and `importanceScore >= 60`.
- Let users open the existing edit dialog from each plan item.
- Let users mark active items as completed using the existing `completePlan()` mutation.
- Keep Matrix as the default app view.

Excluded:

- Database schema changes.
- Persistent "planned for today" flags.
- Reminders, notifications, recurring plans, AI scheduling, or drag-and-drop.
- New dependencies.

## User Experience

The app header adds a `今日` tab with a compact icon. Selecting it shows a dense work-focused surface:

- A short header with today's local date and total Today count.
- Four full-width sections laid out in a two-column grid on desktop.
- Each section has a count badge, empty state text, and plan rows.
- Plan rows show title, optional description, importance, time label, and actions.
- Actions reuse existing icon buttons: mark complete and edit.

If the same plan qualifies for multiple groups, it appears in the highest-priority group only. Priority order is:

1. 已过期
2. 今天截止
3. 今天开始
4. 重要未排期

Completed and archived plans are excluded from all Today groups.

## Architecture

Plan grouping belongs in `src/domain/today.ts`, not inside React. The helper should accept `plans` and `now`, then return stable section objects for rendering.

React should only render returned sections and call existing actions. The Today view component should live in `src/components/TodayView.tsx`.

`App.tsx` should only add the new tab and render `TodayView` when the UI state is `today`.

## Components

Create `TodayView` with props:

- `plans: Plan[]`
- `now: Date`

It should:

- call the domain helper with `useMemo`;
- render four sections consistently;
- call `useUiStore().openEditDialog(plan)` for edit;
- call `completePlan(plan.id)` through the same React Query invalidation pattern used by `ListView`.

No shared list-row abstraction is required for the first version. The duplicated row shape is acceptable because Today view has different grouping and density rules.

## Data Flow

1. `App` loads all plans through the existing `listPlans` query.
2. `App` passes `plans` and `now` into `TodayView`.
3. `TodayView` groups plans through `buildTodaySections(plans, now)`.
4. Edit opens the existing `PlanDialog`.
5. Complete uses `completePlan()`, then invalidates `["plans"]`.

No save occurs when entering Today view.

## Rules

All date comparisons use the local calendar date. A plan ending at any time today qualifies for `今天截止`. A plan starting at any time today qualifies for `今天开始`.

For section ordering:

- `已过期`: oldest end time first.
- `今天截止`: soonest end time first.
- `今天开始`: earliest start time first.
- `重要未排期`: highest importance first, then most recently updated.

Plans without descriptions render a muted fallback text instead of leaving awkward blank space.

## Testing

Add unit tests for `src/domain/today.ts`.

The tests should verify:

- expired plans appear only in the expired section;
- today-deadline plans appear in today deadline;
- today-start plans appear in today start when they do not already have a today deadline;
- important unscheduled plans appear in important unscheduled;
- completed and archived plans are excluded;
- a plan qualifying for multiple sections appears only in the highest-priority section.

Run:

```bash
npm test -- src/domain/today.test.ts
npm run build
```

## Acceptance Criteria

- `今日` appears as a fourth top-level tab.
- Today view shows the four planned groups with correct counts and empty states.
- Users can edit and mark complete from Today view.
- Matrix, Calendar, and List continue to work.
- Domain grouping rules are covered by unit tests.
- Full test suite and production build pass.
