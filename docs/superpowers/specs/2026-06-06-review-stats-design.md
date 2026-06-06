# Review Stats Design

## Goal

Add a Review view that helps users understand formal plan progress in ChronoMatrix without mixing in Daily temporary notes or time slices.

## Scope

The first version only reads `plans`.

It does not read or display:

- `daily_notebooks`
- `daily_time_slices`
- Daily record counts
- temporary time-slice statistics

Daily remains a separate temporary workspace and does not affect formal plan completion, overdue counts, or matrix performance.

## User Experience

Add a top-level `复盘` tab beside `今日`, `矩阵`, `日历`, and `列表`.

The Review view shows:

- period controls: `本周`, `近 7 天`, `近 30 天`
- metric cards: created plans, completed plans, completion rate, current expired plans, completed important plans, expired important plans
- quadrant review: counts by Eisenhower quadrant, split into total, completed, expired, and unfinished
- detail lists: completed plans in the selected period, current expired plans, and important unscheduled plans

## Rules

Period-limited counts use plan timestamps:

- created count: `createdAt` falls inside the selected period
- completed count: `completedAt` falls inside the selected period
- completed important count: `completedAt` falls inside the selected period and `importanceScore` is at or above the important threshold

Current state counts use `deriveEffectiveStatus(plan, now)`:

- current expired plans are unfinished plans whose effective status is `expired`
- expired important plans are current expired plans above the important threshold
- important unscheduled plans are unfinished, unarchived, uncompleted plans with no start or end time and important score at or above the threshold

Quadrant review classifies scheduled, non-archived plans using the same importance threshold and urgent-window rule as the matrix. Completed plans remain visible in the quadrant counts so the review can compare completed, expired, and unfinished formal work. Unscheduled plans are excluded from quadrant counts and are shown separately when they are important.

## Architecture

Create `src/domain/reviewStats.ts` for pure review calculations. It receives `plans`, `now`, and a period id, then returns a fully shaped view model for `ReviewView`.

Create `src/components/ReviewView.tsx` for presentation. The component should not contain period arithmetic or status rules.

Update `src/state/ui.ts` and `src/App.tsx` to register the new top-level view.

## Testing

Add `src/domain/reviewStats.test.ts`.

Tests should cover:

- period range boundaries for this week, last 7 days, and last 30 days
- created and completed counts
- completion rate based on period-created plans
- current expired and important expired counts
- quadrant buckets excluding completed and archived plans
- important unscheduled plans
- no dependency on Daily data
