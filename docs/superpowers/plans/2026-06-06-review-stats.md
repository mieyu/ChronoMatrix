# Review Stats Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a first-pass Review view that analyzes only formal plans and keeps Daily temporary content isolated.

**Architecture:** Put all review calculations in a pure domain module and render the output in a dedicated React view. Keep Daily data modules untouched.

**Tech Stack:** React 19, TypeScript, Vitest, date-fns, Tailwind CSS, shadcn/ui, lucide-react.

---

### Task 1: Domain Statistics

**Files:**
- Create: `src/domain/reviewStats.test.ts`
- Create: `src/domain/reviewStats.ts`

- [ ] **Step 1: Write failing tests**

Create tests for period ranges, created/completed metrics, current expired metrics, quadrant buckets, and important unscheduled plans.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/domain/reviewStats.test.ts`

Expected: FAIL because `src/domain/reviewStats.ts` does not exist yet.

- [ ] **Step 3: Implement minimal domain logic**

Create `buildReviewStats(plans, now, period)` and supporting types.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/domain/reviewStats.test.ts`

Expected: PASS.

### Task 2: Review View

**Files:**
- Create: `src/components/ReviewView.tsx`
- Modify: `src/state/ui.ts`
- Modify: `src/App.tsx`

- [ ] **Step 1: Add `review` to `AppView`**

Update `src/state/ui.ts`.

- [ ] **Step 2: Add the top-level tab**

Update `src/App.tsx` with a `复盘` tab and render `ReviewView`.

- [ ] **Step 3: Render review sections**

Create `ReviewView.tsx` with period controls, metric cards, quadrant summaries, and detail lists.

- [ ] **Step 4: Verify build**

Run: `npm run build`

Expected: PASS.

### Task 3: Full Verification

**Files:**
- Modify: `docs/PRODUCT.md`
- Modify: `docs/QA.md`

- [ ] **Step 1: Document the Review view**

Update product and QA docs to state that Review only analyzes formal plans and excludes Daily.

- [ ] **Step 2: Run all tests**

Run: `npm test`

Expected: PASS.

- [ ] **Step 3: Run production build**

Run: `npm run build`

Expected: PASS.
