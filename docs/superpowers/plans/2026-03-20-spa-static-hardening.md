# SPA Static Serving Hardening Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the shared Fastify SPA static-serving failure mode across all frontend-backed tool packages by introducing one tested helper and migrating all affected packages to it.

**Architecture:** Add a single `registerSpaStatic()` helper in `@my-toolbox/shared` that handles static assets and SPA fallback with explicit route behavior, then replace the duplicated per-package `fastifyStatic + setNotFoundHandler` blocks with that helper. Lock the behavior with shared-package Node tests instead of package-by-package duplicate tests.

**Tech Stack:** TypeScript, Fastify 5, @fastify/static, Vitest, pnpm workspaces

**Spec:** `/Users/lxs/code/my-toolbox/docs/superpowers/specs/2026-03-20-spa-static-hardening-design.md`

---

## File Structure

### New files
- `/Users/lxs/code/my-toolbox/packages/shared/src/spa-static.ts`
- `/Users/lxs/code/my-toolbox/packages/shared/src/spa-static.test.ts`
- `/Users/lxs/code/my-toolbox/packages/shared/vitest.config.ts`

### Modified files
- `/Users/lxs/code/my-toolbox/packages/shared/package.json`
- `/Users/lxs/code/my-toolbox/packages/shared/src/index.ts`
- `/Users/lxs/code/my-toolbox/packages/portal/src/server/index.ts`
- `/Users/lxs/code/my-toolbox/packages/cc-monitor/src/server/index.ts`
- `/Users/lxs/code/my-toolbox/packages/notes/src/server/index.ts`
- `/Users/lxs/code/my-toolbox/packages/notifications/src/server/index.ts`
- `/Users/lxs/code/my-toolbox/packages/todo/src/server/index.ts`
- `/Users/lxs/code/my-toolbox/packages/win-switcher/src/server/index.ts`
- `/Users/lxs/code/my-toolbox/packages/api-quota/src/server/index.ts`
- `/Users/lxs/code/my-toolbox/packages/litellm-monitor/src/server/index.ts`
- `/Users/lxs/code/my-toolbox/packages/bookmarks/src/server/index.ts`
- `/Users/lxs/code/my-toolbox/packages/work-hours/src/server/index.ts`
- `/Users/lxs/code/my-toolbox/pnpm-lock.yaml`

---

## Chunk 1: Shared Helper Test Harness

### Task 1: Add shared-package test support and write failing tests first

**Files:**
- Modify: `/Users/lxs/code/my-toolbox/packages/shared/package.json`
- Create: `/Users/lxs/code/my-toolbox/packages/shared/vitest.config.ts`
- Test: `/Users/lxs/code/my-toolbox/packages/shared/src/spa-static.test.ts`

- [ ] **Step 1: Add a `test` script and minimal Vitest dependencies to `packages/shared/package.json`**
- [ ] **Step 2: Create `packages/shared/vitest.config.ts` for Node-environment tests**
- [ ] **Step 3: Write failing tests for `registerSpaStatic()` covering:**
  - `GET /` returns `index.html`
  - `GET /dashboard` returns `index.html`
  - `GET /api/missing` returns 404
  - replacing `assets/old.js` with `assets/new.js` after registration still serves `new.js`
  - `GET /favicon.ico` returns 404, not `index.html`
- [ ] **Step 4: Run the targeted tests to verify RED**

Run: `pnpm --filter @my-toolbox/shared test -- spa-static`
Expected: FAIL because helper does not exist yet.

## Chunk 2: Implement the Shared Helper

### Task 2: Make the shared tests pass with the smallest helper

**Files:**
- Create: `/Users/lxs/code/my-toolbox/packages/shared/src/spa-static.ts`
- Modify: `/Users/lxs/code/my-toolbox/packages/shared/src/index.ts`
- Test: `/Users/lxs/code/my-toolbox/packages/shared/src/spa-static.test.ts`

- [ ] **Step 1: Implement `registerSpaStatic(app, webDir)` using `@fastify/static` plus explicit document/fallback routes**
- [ ] **Step 2: Export it from `packages/shared/src/index.ts`**
- [ ] **Step 3: Re-run the targeted tests and verify GREEN**

Run: `pnpm --filter @my-toolbox/shared test -- spa-static`
Expected: PASS.

- [ ] **Step 4: Commit the shared helper and tests**

```bash
git add packages/shared/package.json packages/shared/vitest.config.ts packages/shared/src/spa-static.ts packages/shared/src/spa-static.test.ts packages/shared/src/index.ts pnpm-lock.yaml
git commit -m "fix(shared): add tested SPA static helper"
```

## Chunk 3: Migrate All Affected Packages

### Task 3: Replace duplicated per-package SPA serving blocks with the shared helper

**Files:**
- Modify: each affected `src/server/index.ts` listed above

- [ ] **Step 1: For each affected package, remove direct SPA `fastifyStatic` usage and import `registerSpaStatic` from `@my-toolbox/shared`**
- [ ] **Step 2: Preserve non-SPA static mounts like `bookmarks` screenshots**
- [ ] **Step 3: Keep all business routes and startup logic unchanged**
- [ ] **Step 4: Build the whole repo to verify integration**

Run: `pnpm build`
Expected: exit 0.

- [ ] **Step 5: Commit the package migrations separately from the helper**

```bash
git add packages/*/src/server/index.ts
git commit -m "fix(server): unify SPA static serving"
```

## Chunk 4: Runtime Verification

### Task 4: Prove the fix holds across running tools

**Files:**
- No source changes required unless verification finds a regression

- [ ] **Step 1: Restart affected PM2 services**

Run: `pm2 restart portal cc-monitor bookmarks win-switcher notifications notes litellm-monitor work-hours api-quota todo`

- [ ] **Step 2: Verify root HTML and referenced hash asset for each service**

Use an automated script to request `/` and the current `/assets/*.js` path from the returned HTML.
Expected: every service returns `200` for both.

- [ ] **Step 3: If any service fails, return to TDD for that specific package before continuing**

## Chunk 5: Final Verification + Push

### Task 5: Verify and publish

- [ ] **Step 1: Run fresh shared tests**

Run: `pnpm --filter @my-toolbox/shared test`
Expected: PASS.

- [ ] **Step 2: Run fresh full build**

Run: `pnpm build`
Expected: PASS.

- [ ] **Step 3: Check working tree is clean**

Run: `git status --short --untracked-files=all`
Expected: no unintended changes.

- [ ] **Step 4: Push `main`**

Run: `git push origin main`
Expected: remote updated successfully.
