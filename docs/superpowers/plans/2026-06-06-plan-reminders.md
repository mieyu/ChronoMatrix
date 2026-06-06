# Plan Reminders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Send first-pass macOS notifications for formal plans that are due soon or expired while ChronoMatrix is open.

**Architecture:** Keep reminder selection as pure domain logic, persist sent reminder keys separately, and isolate Tauri notification calls in a runner component.

**Tech Stack:** React 19, TypeScript, Vitest, Tauri v2, `@tauri-apps/plugin-notification`, `tauri-plugin-notification`, date-fns.

---

### Task 1: Plugin Setup

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/Cargo.lock`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/capabilities/default.json`

- [ ] **Step 1: Add the official plugin**

Run: `npm run tauri add notification`

Expected: JS/Rust dependencies are added and `notification:default` is added to the default capability.

### Task 2: Reminder Rules

**Files:**
- Create: `src/domain/reminders.test.ts`
- Create: `src/domain/reminders.ts`

- [ ] **Step 1: Write failing tests**

Cover due-soon, expired, excluded statuses, sent-key dedupe, and deadline-change behavior.

- [ ] **Step 2: Run red test**

Run: `npm test -- src/domain/reminders.test.ts`

Expected: FAIL because `src/domain/reminders.ts` does not exist yet.

- [ ] **Step 3: Implement reminder selection**

Create `buildPlanReminderCandidates(plans, now, sentKeys)`.

- [ ] **Step 4: Run green test**

Run: `npm test -- src/domain/reminders.test.ts`

Expected: PASS.

### Task 3: Reminder Persistence

**Files:**
- Create: `src/data/reminders.test.ts`
- Create: `src/data/reminders.ts`

- [ ] **Step 1: Write failing tests**

Verify sent keys can be read, saved, and merged.

- [ ] **Step 2: Run red test**

Run: `npm test -- src/data/reminders.test.ts`

Expected: FAIL because `src/data/reminders.ts` does not exist yet.

- [ ] **Step 3: Implement local storage persistence**

Create `listSentReminderKeys()` and `markReminderKeysSent(keys)`.

- [ ] **Step 4: Run green test**

Run: `npm test -- src/data/reminders.test.ts`

Expected: PASS.

### Task 4: Notification Runner

**Files:**
- Create: `src/components/ReminderRunner.tsx`
- Modify: `src/App.tsx`
- Modify: `docs/PRODUCT.md`
- Modify: `docs/QA.md`

- [ ] **Step 1: Add runner component**

The runner should no-op outside Tauri, check candidates from formal plans, request notification permission only when needed, send at most a few notifications per pass, and mark sent reminders only after permission is granted.

- [ ] **Step 2: Mount the runner**

Mount `ReminderRunner` in `App` with `plans` and `now`.

- [ ] **Step 3: Document behavior**

Update product and QA docs.

### Task 5: Verification

- [ ] **Step 1: Run all tests**

Run: `npm test`

Expected: PASS.

- [ ] **Step 2: Run web build**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 3: Build debug app**

Run: `env -u HTTP_PROXY -u HTTPS_PROXY -u ALL_PROXY -u http_proxy -u https_proxy -u all_proxy npm run tauri -- build --debug --bundles app`

Expected: PASS and `.app` is emitted under `src-tauri/target/debug/bundle/macos/ChronoMatrix.app`.
