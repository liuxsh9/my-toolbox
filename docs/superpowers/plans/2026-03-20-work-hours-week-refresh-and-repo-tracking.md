# Work Hours Week Refresh + Repo Tracking Cleanup Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a manual refresh button to Work Hours Week view in both page and widget modes, and fix repository tracking so the right source files are versioned while local artifacts stay ignored.

**Architecture:** Keep the Week refresh behavior local to `WeekView` by reusing its existing data-fetch path and adding a small `refreshing` UI state. Handle repository cleanup separately by updating ignore rules first, then versioning `packages/work-hours` source/config files without local databases or generated files.

**Tech Stack:** Git, TypeScript, React 19, Vite 6, Vitest, Testing Library, Fastify 5

**Spec:** `/Users/lxs/code/my-toolbox/docs/superpowers/specs/2026-03-20-work-hours-week-refresh-design.md`

---

## File Structure

### Existing files to modify
- `/Users/lxs/code/my-toolbox/.gitignore` — ignore local agent/runtime/generated artifacts that should not be tracked
- `/Users/lxs/code/my-toolbox/packages/work-hours/package.json` — add test script and minimal frontend test dependencies
- `/Users/lxs/code/my-toolbox/packages/work-hours/src/web/components/WeekView.tsx` — add refresh button and refreshing state

### New files to create
- `/Users/lxs/code/my-toolbox/packages/work-hours/src/web/components/WeekView.test.tsx` — regression tests for Week refresh button behavior
- `/Users/lxs/code/my-toolbox/packages/work-hours/src/web/test/setup.ts` — test environment bootstrap
- `/Users/lxs/code/my-toolbox/packages/work-hours/src/web/vitest.config.ts` — vitest config for jsdom/component tests

### Existing files to stage intentionally
- `/Users/lxs/code/my-toolbox/packages/work-hours/tool.yaml`
- `/Users/lxs/code/my-toolbox/packages/work-hours/tsconfig.server.json`
- `/Users/lxs/code/my-toolbox/packages/work-hours/src/server/**`
- `/Users/lxs/code/my-toolbox/packages/work-hours/src/web/**` (excluding generated output)
- `/Users/lxs/code/my-toolbox/packages/work-hours/src/native/monitor.swift`
- `/Users/lxs/code/my-toolbox/packages/work-hours/data/holidays.json`

### Files to keep ignored / untracked
- `/Users/lxs/code/my-toolbox/packages/work-hours/data/work-hours.db*`
- `/Users/lxs/code/my-toolbox/.agents/**`
- `/Users/lxs/code/my-toolbox/.superpowers/**`
- generated screenshots / local runtime artifacts identified during audit

---

## Chunk 1: Repo Hygiene Audit

### Task 1: Classify untracked content before staging anything

**Files:**
- Modify: `/Users/lxs/code/my-toolbox/.gitignore`

- [ ] **Step 1: Inspect current untracked and modified files**

Run: `git -C /Users/lxs/code/my-toolbox status --short --untracked-files=all`
Expected: list of tracked modifications plus untracked directories/files that need classification.

- [ ] **Step 2: Decide ignore vs version-control bucket**

Create a short checklist from the status output:
- source/config/docs to track
- databases/build/cache/screenshots/agent folders to ignore

- [ ] **Step 3: Update `.gitignore` for local-only artifacts**

Add exact rules for:
- `.agents/`
- `.superpowers/`
- work-hours database files if any repo-level pattern is missing
- any clearly generated screenshot/runtime paths found in the audit

- [ ] **Step 4: Verify ignored paths are now ignored**

Run: `git -C /Users/lxs/code/my-toolbox check-ignore -v <path>...`
Expected: each ignored path prints the matching `.gitignore` rule.

- [ ] **Step 5: Commit repo hygiene only**

```bash
git -C /Users/lxs/code/my-toolbox add .gitignore
git -C /Users/lxs/code/my-toolbox commit -m "chore(repo): ignore local runtime artifacts"
```

## Chunk 2: Track Work Hours Package Correctly

### Task 2: Stage only the intended Work Hours source/config files

**Files:**
- Stage: `/Users/lxs/code/my-toolbox/packages/work-hours/package.json`
- Stage: `/Users/lxs/code/my-toolbox/packages/work-hours/tool.yaml`
- Stage: `/Users/lxs/code/my-toolbox/packages/work-hours/tsconfig.server.json`
- Stage: `/Users/lxs/code/my-toolbox/packages/work-hours/src/native/monitor.swift`
- Stage: `/Users/lxs/code/my-toolbox/packages/work-hours/src/server/**`
- Stage: `/Users/lxs/code/my-toolbox/packages/work-hours/src/web/**`
- Stage: `/Users/lxs/code/my-toolbox/packages/work-hours/data/holidays.json`

- [ ] **Step 1: Re-run status for `packages/work-hours`**

Run: `git -C /Users/lxs/code/my-toolbox status --short --untracked-files=all -- packages/work-hours`
Expected: only source/config/data files intended for version control remain visible.

- [ ] **Step 2: Stage only source/config/static data**

Run a path-by-path `git add` for the intended files/directories and avoid `data/work-hours.db*`.

- [ ] **Step 3: Verify staged set is clean**

Run: `git -C /Users/lxs/code/my-toolbox diff --cached --name-only`
Expected: staged files are only Work Hours source/config/static data.

- [ ] **Step 4: Commit tracked package sources**

```bash
git -C /Users/lxs/code/my-toolbox commit -m "feat(work-hours): add package sources"
```

## Chunk 3: TDD for Week Refresh

### Task 3: Add minimal frontend test harness

**Files:**
- Modify: `/Users/lxs/code/my-toolbox/packages/work-hours/package.json`
- Create: `/Users/lxs/code/my-toolbox/packages/work-hours/src/web/vitest.config.ts`
- Create: `/Users/lxs/code/my-toolbox/packages/work-hours/src/web/test/setup.ts`
- Test: `/Users/lxs/code/my-toolbox/packages/work-hours/src/web/components/WeekView.test.tsx`

- [ ] **Step 1: Write the failing test for the refresh button**

Test behaviors:
- renders `↻`
- clicking it issues another fetch for the visible week range
- button becomes disabled during the in-flight refresh

- [ ] **Step 2: Run the targeted test to verify it fails**

Run: `pnpm --filter @my-toolbox/work-hours test -- WeekView`
Expected: FAIL because test harness and/or component behavior is not implemented yet.

- [ ] **Step 3: Add the minimal test harness needed to execute the component test**

Install/configure only:
- `vitest`
- `jsdom`
- `@testing-library/react`
- `@testing-library/jest-dom`

and add `test` script.

- [ ] **Step 4: Re-run the test and confirm it still fails for the expected feature gap**

Run: `pnpm --filter @my-toolbox/work-hours test -- WeekView`
Expected: FAIL specifically because the refresh button behavior is missing or incomplete.

- [ ] **Step 5: Commit the test harness and failing regression test once it is green-ready**

```bash
git -C /Users/lxs/code/my-toolbox add packages/work-hours/package.json packages/work-hours/src/web/vitest.config.ts packages/work-hours/src/web/test/setup.ts packages/work-hours/src/web/components/WeekView.test.tsx pnpm-lock.yaml
git -C /Users/lxs/code/my-toolbox commit -m "test(work-hours): add week view component tests"
```

## Chunk 4: Implement Week Refresh

### Task 4: Make the WeekView test pass with the smallest UI change

**Files:**
- Modify: `/Users/lxs/code/my-toolbox/packages/work-hours/src/web/components/WeekView.tsx`
- Test: `/Users/lxs/code/my-toolbox/packages/work-hours/src/web/components/WeekView.test.tsx`

- [ ] **Step 1: Add `refreshing` state to `WeekView`**

Use a separate boolean from `loading` so initial load and manual refresh remain distinguishable.

- [ ] **Step 2: Add the refresh button to the navigation row**

Use the existing nav button styles and preserve both widget and full-page rendering.

- [ ] **Step 3: Wire the button to re-run the current week's fetch**

Keep the behavior local to `fetchWeek()` and do not add new backend routes.

- [ ] **Step 4: Run the targeted test and verify it passes**

Run: `pnpm --filter @my-toolbox/work-hours test -- WeekView`
Expected: PASS.

- [ ] **Step 5: Build the package to catch integration/type issues**

Run: `pnpm --filter @my-toolbox/work-hours build`
Expected: exit 0.

- [ ] **Step 6: Commit the feature change only**

```bash
git -C /Users/lxs/code/my-toolbox add packages/work-hours/src/web/components/WeekView.tsx
git -C /Users/lxs/code/my-toolbox commit -m "feat(work-hours): add week view refresh button"
```

## Chunk 5: Final Verification + Push

### Task 5: Verify the full result before push

**Files:**
- Verify working tree and commit history only

- [ ] **Step 1: Verify tests fresh**

Run: `pnpm --filter @my-toolbox/work-hours test`
Expected: all tests pass.

- [ ] **Step 2: Verify build fresh**

Run: `pnpm --filter @my-toolbox/work-hours build`
Expected: exit 0.

- [ ] **Step 3: Inspect final status**

Run: `git -C /Users/lxs/code/my-toolbox status --short`
Expected: no unintended changes remain.

- [ ] **Step 4: Inspect commit split**

Run: `git -C /Users/lxs/code/my-toolbox log --oneline -n 10`
Expected: repo hygiene, package tracking, tests, and feature are in separate commits.

- [ ] **Step 5: Push `main`**

Run: `git -C /Users/lxs/code/my-toolbox push origin main`
Expected: remote updated successfully.
