# Matrix Crowding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce visual overlap in the Eisenhower matrix when many plans land near the same time-pressure position.

**Architecture:** Keep matrix business rules in `src/domain` and keep React responsible for rendering only. Convert per-plan matrix placement into render items: individual plans get deterministic collision offsets, while dense same-quadrant groups become expandable clusters.

**Tech Stack:** React, TypeScript, Vitest, existing shadcn/ui primitives, existing matrix placement domain model.

---

### Task 1: Domain Layout Rules

**Files:**
- Create: `src/domain/matrixLayout.test.ts`
- Create: `src/domain/matrixLayout.ts`

- [ ] **Step 1: Write failing tests**

Add tests that verify:
- two nearby plans in one quadrant remain individual items with different coordinates;
- three nearby plans in one quadrant become one cluster item;
- far plans remain individual items;
- dense plans in different quadrants never cluster together.

- [ ] **Step 2: Run red test**

Run: `npm test -- src/domain/matrixLayout.test.ts`

Expected: fail because `matrixLayout.ts` does not exist yet.

- [ ] **Step 3: Implement layout**

Create `buildMatrixLayoutItems(plans, now, rules)` in `src/domain/matrixLayout.ts`.

Rules:
- use `getPlanMatrixPlacement()` as the canonical base placement;
- ignore non-matrix plans;
- group only within the same quadrant;
- cluster groups of at least 3 plans when target points are within a normalized radius of `0.08`;
- spread groups of 2 by a deterministic perpendicular offset;
- clamp final coordinates inside the item quadrant.

- [ ] **Step 4: Run green test**

Run: `npm test -- src/domain/matrixLayout.test.ts src/domain/plan.test.ts`

Expected: all tests pass.

### Task 2: Matrix View Rendering

**Files:**
- Modify: `src/components/MatrixView.tsx`

- [ ] **Step 1: Replace direct placement mapping**

Use `buildMatrixLayoutItems()` for body rendering while keeping existing side panels based on `getPlanMatrixPlacement()`.

- [ ] **Step 2: Render clusters**

Render cluster buttons with count, top title preview, and a hover/focus panel listing plans. Clicking a plan in the panel opens the edit dialog.

- [ ] **Step 3: Preserve hover priority**

Keep individual cards and cluster previews above neighboring items on hover/focus.

- [ ] **Step 4: Verify build**

Run: `npm run build`

Expected: TypeScript and Vite build pass.

### Task 3: Desktop Verification

**Files:**
- No source edits expected.

- [ ] **Step 1: Run full tests**

Run: `npm test -- src/domain/matrixLayout.test.ts src/domain/calendar.test.ts src/domain/plan.test.ts`

Expected: all tests pass.

- [ ] **Step 2: Build Tauri debug app**

Run: `env -u HTTP_PROXY -u HTTPS_PROXY -u ALL_PROXY -u http_proxy -u https_proxy -u all_proxy npm run tauri -- build --debug --bundles app`

Expected: debug `.app` bundle builds successfully.
