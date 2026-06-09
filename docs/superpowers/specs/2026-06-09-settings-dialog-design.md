# Settings Dialog Design

## Goal

Add a first-pass settings entry for ChronoMatrix so users can adjust product behavior without editing code or restarting the app.

## Scope

The first version covers settings that already map to existing product rules:

- default view on app open
- matrix importance threshold
- matrix urgent window
- reminder enablement
- due-soon reminder lead time
- theme preference, including whether the app follows the local system appearance

It does not add account settings, cloud sync, category management, import/export, keyboard shortcut customization, or notification channel customization.

## User Experience

Add a gear settings button to the top toolbar beside the existing global controls. Clicking it opens a modal settings dialog, matching the existing dialog pattern used by search and plan editing.

The dialog has four grouped sections:

- `常规`: choose the default view opened by the app
- `矩阵`: adjust the important score threshold and urgent window
- `提醒`: enable or disable reminders and choose the due-soon lead time
- `外观`: choose whether to follow the local system appearance; when not following the system, choose light or dark mode

Settings apply immediately after the user changes them. The app should not require restart or a manual refresh.

The existing theme toggle remains in the toolbar as a quick shortcut, while the settings dialog exposes the full appearance state more explicitly.

## Rules

Default values preserve current behavior:

- default view: `matrix`
- important threshold: `6`
- urgent window: `72` hours
- reminders enabled: `true`
- due-soon reminder lead time: `30` minutes
- theme follows system: current `system` preference

Valid ranges:

- important threshold: integer `0` through `10`
- urgent window: integer hours, constrained to a practical range such as `1` through `336`
- due-soon reminder lead time: integer minutes, constrained to a practical range such as `0` through `1440`

When reminders are disabled, `ReminderRunner` does not build or send notification candidates.

When due-soon lead time is `0`, only expired reminders are sent; due-soon reminders are effectively disabled.

The same settings-backed matrix rules should be used anywhere the product classifies plans by importance or urgency, including matrix placement, review quadrant stats, and important-unscheduled surfaces.

## Architecture

Create a persisted settings store under `src/state/settings.ts`, using Zustand persistence in the same style as `src/state/theme.ts`.

Create small pure helpers under `src/domain/settings.ts` for defaults, validation, and conversion from settings to existing domain rule objects. Domain and component code should receive explicit settings-derived rule values where possible instead of importing the store directly.

Create `src/components/SettingsDialog.tsx` for the modal UI. It should reuse existing UI primitives such as `Dialog`, `Button`, `Label`, `Select`, and `Slider` rather than introducing new component libraries.

Update `src/state/ui.ts` with settings dialog open/close state.

Update `src/App.tsx` to add the gear button, mount `SettingsDialog`, initialize the selected default view on startup, and pass settings-derived rules into views and runners.

Update pure domain APIs that currently rely on hard-coded defaults so callers can supply settings-backed rules:

- matrix placement and matrix layout usage
- review stats quadrant classification
- today important-unscheduled classification
- reminder candidate selection

## Testing

Add focused unit tests for:

- settings defaults match current product behavior
- settings validation clamps invalid values
- matrix rules are derived from settings
- review/today important thresholds respond to settings
- reminder candidate selection respects enablement and due-soon lead time

Run the existing test suite and production build after implementation:

```bash
npm test
npm run build
```
