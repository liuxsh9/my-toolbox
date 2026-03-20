# Work Hours Global Refresh Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make any Work Hours refresh action trigger a tool-wide global refresh across panels and across Work Hours page/widget instances, without affecting other tools.

**Architecture:** Add a small front-end refresh bus with same-instance listeners plus `BroadcastChannel` cross-instance propagation. Migrate each data-bearing Work Hours component to subscribe and re-run its own existing fetch logic when a global refresh event arrives. Keep the DayView “today refresh” write-path (`/api/today/refresh`) but broadcast after it succeeds.

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library, BroadcastChannel

**Spec:** `/Users/lxs/code/my-toolbox/docs/superpowers/specs/2026-03-20-work-hours-global-refresh-design.md`

---

## File Structure

### New files
- `/Users/lxs/code/my-toolbox/packages/work-hours/src/web/refreshBus.ts`
- `/Users/lxs/code/my-toolbox/packages/work-hours/src/web/refreshBus.test.ts`

### Modified files
- `/Users/lxs/code/my-toolbox/packages/work-hours/src/web/components/DayView.tsx`
- `/Users/lxs/code/my-toolbox/packages/work-hours/src/web/components/WeekView.tsx`
- `/Users/lxs/code/my-toolbox/packages/work-hours/src/web/components/TodayView.tsx`
- `/Users/lxs/code/my-toolbox/packages/work-hours/src/web/components/MonthView.tsx`
- `/Users/lxs/code/my-toolbox/packages/work-hours/src/web/components/TrendView.tsx`
- `/Users/lxs/code/my-toolbox/packages/work-hours/src/web/components/SummaryCards.tsx`
- `/Users/lxs/code/my-toolbox/packages/work-hours/src/web/components/WeekView.test.tsx`
- `/Users/lxs/code/my-toolbox/packages/work-hours/package.json` (only if test config changes are needed)

---

## Task 1: Refresh bus tests first

**Files:**
- Create: `/Users/lxs/code/my-toolbox/packages/work-hours/src/web/refreshBus.test.ts`
- Create: `/Users/lxs/code/my-toolbox/packages/work-hours/src/web/refreshBus.ts`

- [ ] **Step 1: Write failing tests for local subscribers and BroadcastChannel delivery**
- [ ] **Step 2: Run `pnpm --filter @my-toolbox/work-hours test -- refreshBus` and verify RED**
- [ ] **Step 3: Implement the minimal refresh bus**
- [ ] **Step 4: Re-run the targeted tests and verify GREEN**

## Task 2: WeekView triggers global refresh

**Files:**
- Modify: `/Users/lxs/code/my-toolbox/packages/work-hours/src/web/components/WeekView.tsx`
- Modify: `/Users/lxs/code/my-toolbox/packages/work-hours/src/web/components/WeekView.test.tsx`

- [ ] **Step 1: Extend `WeekView.test.tsx` to fail unless Week refresh emits the global refresh event**
- [ ] **Step 2: Run the targeted test and verify RED**
- [ ] **Step 3: Update `WeekView` so the button emits global refresh instead of only local refresh**
- [ ] **Step 4: Re-run the targeted test and verify GREEN**

## Task 3: Data components subscribe to global refresh

**Files:**
- Modify: `SummaryCards.tsx`
- Modify: `TodayView.tsx`
- Modify: `DayView.tsx`
- Modify: `MonthView.tsx`
- Modify: `TrendView.tsx`
- Modify: `WeekView.tsx`

- [ ] **Step 1: For each component, wrap existing fetch logic so it can be re-used by mount effects and refresh subscriptions**
- [ ] **Step 2: Subscribe on mount and unsubscribe on unmount**
- [ ] **Step 3: Ensure refresh does not create duplicate fetch loops**
- [ ] **Step 4: Keep current range/date/tab state intact while only reloading data**

## Task 4: DayView today refresh broadcasts after write succeeds

**Files:**
- Modify: `/Users/lxs/code/my-toolbox/packages/work-hours/src/web/components/DayView.tsx`

- [ ] **Step 1: Keep `/api/today/refresh` for the today-only button**
- [ ] **Step 2: After it succeeds, emit global refresh so all other Work Hours views refresh too**
- [ ] **Step 3: Preserve button loading/disabled behavior**

## Task 5: Verification and commit

- [ ] **Step 1: Run fresh tests**

Run: `pnpm --filter @my-toolbox/work-hours test`
Expected: PASS.

- [ ] **Step 2: Run fresh build**

Run: `pnpm --filter @my-toolbox/work-hours build`
Expected: PASS.

- [ ] **Step 3: Manually verify with browser tooling that clicking refresh causes multiple Work Hours views to refetch**
- [ ] **Step 4: Commit the global refresh work**

```bash
git add packages/work-hours/src/web docs/superpowers/specs/2026-03-20-work-hours-global-refresh-design.md docs/superpowers/plans/2026-03-20-work-hours-global-refresh.md
git commit -m "feat(work-hours): add global refresh across views"
```

- [ ] **Step 5: Push `main`**

Run: `git push origin main`
Expected: remote updated successfully.
