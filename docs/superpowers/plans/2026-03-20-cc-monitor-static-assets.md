# Claude Code Monitor Static Asset Fix Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `cc-monitor` continue serving newly built hashed frontend assets without requiring a PM2 restart.

**Architecture:** Keep the Fastify + SPA structure unchanged, but switch the static asset handler to runtime path matching so newly generated files under `dist/web/assets` are served after build. Extract app construction into a helper so a regression test can start the server against a temporary web root.

**Tech Stack:** TypeScript, Fastify 5, `@fastify/static`, Node `node:test`

**Spec:** `docs/superpowers/specs/2026-03-20-cc-monitor-static-assets-design.md`

---

## File Structure

### Modify
- `packages/cc-monitor/src/server/index.ts` — delegate app construction and keep process startup behavior

### Create
- `packages/cc-monitor/src/server/app.ts` — build Fastify app with routes, process scanner, and static frontend serving
- `packages/cc-monitor/src/server/app.test.mjs` — regression test for post-start asset refresh behavior

---

## Task 1: Write the failing regression test

**Files:**
- Create: `packages/cc-monitor/src/server/app.test.mjs`

- [ ] **Step 1: Write a test that starts a Fastify app against a temporary `webDir`**
- [ ] **Step 2: After startup, replace `index.html` with one that references a new hashed JS file and create that file on disk**
- [ ] **Step 3: Request the new JS path and verify the current implementation fails to serve JavaScript**

## Task 2: Implement the smallest server fix

**Files:**
- Create: `packages/cc-monitor/src/server/app.ts`
- Modify: `packages/cc-monitor/src/server/index.ts`

- [ ] **Step 1: Extract app construction into `createApp()` so tests can provide a temporary `webDir`**
- [ ] **Step 2: Change the static file registration to `wildcard: true`**
- [ ] **Step 3: Keep SPA fallback behavior for non-API routes**

## Task 3: Verify and ship

**Files:**
- Modify: `docs/superpowers/specs/2026-03-20-cc-monitor-static-assets-design.md`
- Modify: `docs/superpowers/plans/2026-03-20-cc-monitor-static-assets.md`

- [ ] **Step 1: Run `node --test packages/cc-monitor/src/server/app.test.mjs` and confirm pass**
- [ ] **Step 2: Run `pnpm --filter @my-toolbox/cc-monitor build` and confirm pass**
- [ ] **Step 3: Restart `cc-monitor` and verify `/assets/*.js` returns JavaScript**
- [ ] **Step 4: Commit, merge into `main`, and push**
