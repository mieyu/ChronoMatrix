# Plan Reminders Design

## Goal

Add first-pass macOS notification reminders for formal plans in ChronoMatrix.

## Scope

The first version only reminds formal `plans`.

It does not read or notify:

- `daily_notebooks`
- `daily_time_slices`
- Daily temporary work

## Reminder Rules

The app checks reminders while ChronoMatrix is open.

- completed plans are ignored
- archived plans are ignored
- plans without `endAt` are ignored
- a plan due within the next 30 minutes produces a `due_soon` reminder once
- a plan whose end time is already past produces an `expired` reminder once
- reminder keys include the plan id, reminder kind, and end time so changing a plan's deadline can trigger a new reminder

The first version does not try to send notifications after the app is fully closed.

## Notification Permission

ChronoMatrix uses the official Tauri v2 notification plugin. When there is at least one pending reminder candidate, the app checks notification permission and requests it if needed. If the user denies permission, the reminder is not marked as sent.

## Architecture

`src/domain/reminders.ts` contains pure reminder selection rules.

`src/data/reminders.ts` stores sent reminder keys in local storage so each reminder kind only fires once for a given plan deadline.

`src/components/ReminderRunner.tsx` runs inside `App`, checks reminders whenever the app's minute clock updates, asks Tauri for notification permission, sends notifications, and marks successfully attempted reminders as sent.

Tauri notification support is registered through:

- `@tauri-apps/plugin-notification`
- `tauri-plugin-notification`
- `notification:default` capability

## Testing

Add unit tests for:

- due-soon reminders inside the 30 minute window
- no reminder outside the due-soon window
- expired reminders for unfinished plans
- completed and archived plans excluded
- reminder dedupe by sent key
- reminder keys changing when a deadline changes
