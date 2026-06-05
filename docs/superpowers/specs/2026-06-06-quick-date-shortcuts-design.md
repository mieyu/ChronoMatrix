# Quick Date Shortcuts Design

## Goal

Make plan creation faster by adding date shortcut controls to the existing plan dialog. The first version should reduce repeated manual date entry without changing the storage model, introducing natural-language parsing, or adding dependencies.

## Scope

This feature modifies the existing `PlanDialog` flow only.

Included:

- Add shortcut buttons for common start and end times.
- Keep the existing manual `datetime-local` inputs.
- Keep the existing clear-time action.
- Use local calendar dates based on the user's current machine time.
- Cover date shortcut calculations with focused unit tests.

Excluded:

- Natural-language parsing such as "tomorrow afternoon".
- A global quick-add command bar.
- Reminders, notifications, recurrence, or calendar drag-and-drop.
- Changes to SQLite schema or persisted plan shape.

## User Experience

In the plan dialog, each optional date field keeps its label, input, and clear button. Below each input, a compact row of shortcut buttons appears.

Start time shortcuts:

- `现在`: set the start time to the current local minute.
- `今天 09:00`: set the start time to today at 09:00.
- `明天 09:00`: set the start time to tomorrow at 09:00.

End time shortcuts:

- `今天 18:00`: set the end time to today at 18:00.
- `明天 18:00`: set the end time to tomorrow at 18:00.
- `本周五 18:00`: set the end time to the next Friday in the current week when possible.
- `下周一 18:00`: set the end time to next Monday at 18:00.

If a shortcut produces a time earlier than the current moment, it still writes the exact date implied by the label. The app already supports overdue and expired states, so the shortcut should not silently move today shortcuts to tomorrow.

## Architecture

Date shortcut calculation should live outside React in a small domain/helper module, for example `src/domain/dateShortcuts.ts`. React should only render shortcut metadata and write the returned `datetime-local` string into the existing field state.

The helper should expose:

- a stable list of shortcut definitions for start and end fields;
- a function that resolves a shortcut id against a `Date`;
- values formatted for the existing `datetime-local` input.

This keeps UI changes small and makes date math testable without rendering the dialog.

## Components

`PlanDialog` remains the only changed component.

`OptionalDateTimeField` should accept an optional `shortcuts` prop. When present, it renders compact outline buttons below the input. Each button calls `onChange(shortcut.value)`.

The component should not know how to compute dates. It receives resolved labels and values from `PlanDialog` or a small local mapping derived from the domain helper.

## Data Flow

1. `PlanDialog` renders with current form state.
2. It asks the shortcut helper for start and end shortcut values using `new Date()`.
3. User clicks a shortcut.
4. The existing `startAt` or `endAt` local state is updated with a `datetime-local` string.
5. Save continues through the existing `fromDateTimeLocalValue()` conversion and `createPlan()` or `updatePlan()`.

No database write happens until the user presses Save.

## Error Handling

The helper should return valid `datetime-local` values for all defined shortcuts. If an unknown shortcut id is requested, it should throw an error in development/test code rather than fail silently.

The UI should keep the existing disabled Save behavior when the title is empty or a save is pending.

## Testing

Add unit tests for the shortcut helper.

The tests should verify:

- `现在` rounds/truncates to the current local minute in the expected input format.
- today and tomorrow shortcuts set the expected hour and date.
- Friday shortcut resolves to Friday of the current week when the current date is before or on Friday.
- Friday shortcut resolves to the following Friday when the current date is already after Friday.
- next Monday always resolves to the Monday after the current week.

Run:

```bash
npm test -- src/domain/dateShortcuts.test.ts
npm run build
```

## Acceptance Criteria

- A user can set common start/end times with one click in the existing plan dialog.
- Manual date entry and clear-time behavior still work.
- Saving new and edited plans uses the existing storage path.
- Shortcut date calculations are covered by unit tests.
- TypeScript build passes.
