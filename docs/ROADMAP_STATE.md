# Hungr Roadmap Execution State

Single source of truth for roadmap progress across sessions. Read this first, work the next unblocked step, update this file before ending the session.

- Full specification: `HUNGR_PRODUCT_ROADMAP.md` (section references below point there).
- Decisions: roadmap section 20 Decision Log — closed 2026-07-22 except items marked OPEN or PROPOSED DEFAULT.
- Conventions: `.agents/skills/hungr-project-workflow`, plus `hungr-next-ui-work` (UI) and `hungr-supabase-actions` (DB) as relevant.

## Update rules

Status syntax:

- `[ ]` not started
- `[-]` partially complete and resumable; same line must end with `Progress:` and exact remainder
- `[x]` complete; required verification passed
- `[!]` blocked by a newly discovered technical/product issue; same line must end with `Blocked by:` and unblock condition
- `[>]` waiting on a human/external owner; same line must end with `Awaiting:` owner/artifact/unblock condition
- `[~]` intentionally deferred/out of current scope

Rules:

1. Mark `[x]` only after required verification ran and passed; record commands in the session log.
2. Steps have stable IDs — reference them in plans, commits when requested, and the session log.
3. New discoveries get fresh IDs under the correct group; never silently reorder finished history.
4. Use `[-]` for interrupted or incomplete work, not optimistic completion. Prefer resuming unblocked `[-]` work next session.
5. Use `[!]` only for a blocker discovered during execution. Planned dependencies remain `[ ]` with `Depends on:` metadata.
6. End every session with one append-only session-log row, including exact remaining work when partial or blocked.

## Status snapshot

- **Now:** **CI is live and green.** `P0-E2-design` accepted (Kyle-Ben, 2026-07-24, D1–D13 at recommended defaults) and **`P0-E2a` is complete** — `lint`, `typecheck`, `unit`, and `build` all pass on GitHub Actions. `P0-E1` is complete (`P0-E1-design`, `P0-E1a`–`P0-E1d`, all 2026-07-24). Next task is `P0-E2b` (database bootstrap, types-drift gate, `db:check`, `db:smoke`, RLS jobs).
- **Work now lives on a branch, and the repository finally has its history.** `ci/p0-e2a-foundation` (PR #1) carries the first commit of the `P0-E1` squash, all Phase 0 tooling, the roadmap/state/spec documents, and the CI foundation — 75 files that had been verified locally across earlier sessions but never committed. `main` is untouched until that PR merges. **`supabase/migrations/20260717120001_baseline.sql` was untracked until this commit**; so was `.env.example`, which `pnpm env:local` needs as its CI fallback.
- **Push to a branch, not `main`.** The Vercel project auto-deploys: a branch push produces a preview deployment (verified on PR #1), while a push to `main` deploys production and attaches the daily `/api/cron/grace-period` cron from `vercel.json`. Vercel never applies migrations — hosted schema changes stay the manual `DEPLOYMENT.md` step.
- **Git credentials:** `origin` is `kbsnydersanomaly/hungr`, but `gh` also holds a `PaperjetStudios` account, which gets HTTP 403 on push. `gh auth switch --user kbsnydersanomaly` fixes it; the active account was left switched to `kbsnydersanomaly`.
- **The Vitest projects are now split three ways:** `node` (`tests/unit/**`), `components`, and `rls` (`tests/rls/**`). `pnpm test:ci` runs node + components with **no database and no `.env.local`**; `pnpm test:rls` runs the RLS project and needs a local stack. `pnpm test` and a bare `pnpm exec vitest run` still run all three (480 tests). The split was mandatory: `tests/rls/helpers.ts` throws at module load without a loopback Supabase URL.
- **CI needs zero repository secrets.** Database jobs run the local stack (`pnpm db:bootstrap`, then `pnpm env:local`, which already falls back to `.env.example` when no preset exists — that fallback is now a CI contract). `pnpm build` was verified 2026-07-24 to succeed with the workflow's placeholder env, **no `.env.local` at all**, and no database reachable, so the build job needs no Docker.
- **CI cannot be marked done without a push.** A workflow is only provable by a green Actions run, so `P0-E2b`/`P0-E2c` each need a push to reach `[x]` — record the run URL and per-job durations in the session log, as `P0-E2a` did.
- **Env presets are scripted, not shelled:** `pnpm env:local|env:remote|env:which` run `scripts/env-preset.ts` (Node fs, no `cp`/`grep`, works on Windows). `env:local` creates `.env.local-db` on first use and refreshes its Supabase URL, both keys, and `SUPABASE_DB_URL` from `supabase status` on every switch, leaving all other settings alone; with the stack stopped it falls back to the existing preset, and `--no-refresh` skips the probe. `.env.remote-db` still holds hosted credentials that cannot be generated.
- **Runtime proof, not inspection:** `pnpm db:smoke` (`scripts/smoke-test-db.ts`) exercises the non-public objects no schema diff can see — the `auth.users` trigger, the populated `review_stats`, and all five buckets — as the real roles, including the `help-media` upload that design section 1.4 flagged as the squash's highest-risk silent failure. Run it after any change to the baseline's non-public section.
- **`pnpm db:check` no longer needs `psql`:** it reads the ledger through the repository-pinned Supabase CLI (`migration list --local`, or `--db-url` when `SUPABASE_DB_URL` is set), so it runs on this Windows workstation and in CI without PostgreSQL client tools. `P0-E2b` can rely on it.
- **Bootstrap contract:** `pnpm db:bootstrap [--fresh] [--skip-seed] [--skip-types]` resolves its target from `supabase status`, never from `.env.local` (which points at hosted), and aborts on any non-loopback API URL. `pnpm db:seed` now refuses a remote URL unless `SEED_ALLOW_REMOTE=1`.
- **Generate types through the script, not a shell redirect:** `pnpm db:bootstrap` writes `lib/database.types.ts` with Node. The pre-existing worktree modification to that file came from `pnpm db:gen-types`' shell redirect re-encoding the output; the bootstrap run restored it to the committed bytes.
- **Verified 2026-07-24:** `supabase db reset` now builds a complete database from a genuinely empty volume off `supabase/migrations/20260717120001_baseline.sql` alone. Both ledgers hold exactly that one version. The hosted `public` and `storage` schema dumps are byte-identical before and after the repair (SHA-256 match), confirming no DDL ran against hosted.
- **Use the explicit diff form:** `supabase db diff --from migrations --to linked` reports no differences. Bare `supabase db diff --linked` emitted a large spurious drop list against the same state on CLI v2.106.0 and should not be used as the equivalence gate in `P0-E1c` or `P0-E2b`.
- **Waiting on externals:** WPS sample, provider evaluation responses, Pilot contact, legal review.
- **Phases 2-9:** not started; Phase 2 design review can confirm decisions 15/16, but implementation also requires identity/worker prerequisites.
- **One-task sessions:** run `/roadmap-next` or ask “continue the roadmap”; skill executes exactly one unblocked item and records partial/done/blocked state before stopping.
- **Overnight Linux runner:** `scripts/roadmap-overnight.sh` starts a fresh `/roadmap-next` session repeatedly and stops when checklist state cannot progress, repeated CLI failures occur, or an optional session cap is reached.

## Phase 0 leftovers (external / client-owned)

- [>] **P0-1** WPS repro pack. Awaiting: client; provide failing CSV, WPS build, and OS locale; then complete `P1-4g`.
- [>] **P0-2** Payment provider evaluation. Awaiting: client + dev; provide PayFast/Zapper/SnapScan docs, sandbox, KYC, settlement, signing, refund, and fee scorecard; then select Phase 4 provider.
- [>] **P0-3** Pilot POS contact. Awaiting: client; provide sandbox, API keys, Online Ordering API docs, and roadmap section 12.2 answers; then start `P8-design`.
- [>] **P0-4** POPIA and CPA section 36 legal package. Awaiting: client + counsel; provide data map, lawful bases, retention, notices, and prize-draw review; then unblock external patron and draw gates.
- [>] **P0-5** Split-payment sub-decisions. Awaiting: product owner; decide rounding, payer tips, provider mixing, partial-payment expiry, partial-refund allocation, and abandonment; then start `P5-design`.
- [>] **P0-6** Decisions 15/16 defaults. Awaiting: product owner; confirm pilot override expiry/plan behavior and open-cart behavior on global disable; then start `P2-design`.

## Phase 0 engineering prerequisites

### P0-E1 Reproducible database bootstrap

- [x] **P0-E1-design** Design and accept migration-history repair/squash strategy for existing hosted project plus fresh local/hosted databases. Spec: `docs/superpowers/specs/2026-07-24-database-bootstrap-design.md`; Option A full squash to one baseline migration `20260717120001`. Accepted by engineering — Kyle-Ben (kb@paperjetstudios.co.za), 2026-07-24; all four section 9 decisions closed at recommended defaults.
- [x] **P0-E1a** Generate the squashed baseline migration `20260717120001` (public dump plus all non-public Auth/Storage objects, including `20260624130001`'s `help-media` bucket and policies), delete the 14 superseded files, and repair the hosted ledger with `supabase migration repair`. Hosted schema and data must remain unmodified; only `supabase_migrations.schema_migrations` changes. Corrected 2026-07-24: the original wording "without invalidating existing hosted migration history" predates the accepted design, which deliberately rewrites the ledger. Depends on: P0-E1-design.
- [x] **P0-E1b** Add one safe bootstrap command covering database creation, migrations, non-public Auth/Storage objects, and conditional/idempotent seed data. Depends on: P0-E1a. Delivered 2026-07-24 as `pnpm db:bootstrap [--fresh] [--skip-seed] [--skip-types]` (`scripts/bootstrap-db.ts`), with `db/seed.ts` made idempotent and local-only.
- [x] **P0-E1c** Verify from an empty local environment; run migration-history/schema checks, signup, upload, and seed smoke tests; update README/deployment docs. Depends on: P0-E1b. Completed 2026-07-24: all eight spec section 8 success criteria pass; `pnpm db:check` no longer needs `psql`; runtime smoke tests are now `pnpm db:smoke`.
- [x] **P0-E1d** Repair local-environment env wiring: both `env:local`/`env:remote` use `cp`, which is unavailable in the Windows shell, and nothing creates the `.env.local-db` preset they depend on. `P0-E1c` had to write that preset by hand to run the RLS suite and smoke tests. Depends on: P0-E1b. Completed 2026-07-24: `pnpm env:local|env:remote|env:which` now run `scripts/env-preset.ts` in Node, and `env:local` creates/refreshes `.env.local-db` from `supabase status`.

### P0-E2 CI foundation

- [x] **P0-E2-design** Define CI jobs, secrets, local Supabase lifecycle, caches, branch triggers, and required-check policy. Depends on: P0-E1-design. Spec: `docs/superpowers/specs/2026-07-24-ci-foundation-design.md` — GitHub Actions, six jobs, zero repository secrets, local Supabase stack per database job. Accepted by engineering — Kyle-Ben (kb@paperjetstudios.co.za), 2026-07-24; decisions D1–D13 closed at recommended defaults, including the `.nvmrc` pin of `22`.
- [x] **P0-E2a** Add lint, `tsc --noEmit`, unit/component, and production-build jobs. Depends on: P0-E2-design. Also carried the spec section 5.6 Vitest project split and `.nvmrc`. Completed 2026-07-24: `.github/workflows/ci.yml` (`lint`, `typecheck`, `unit`, `build`), `.github/actions/setup/action.yml`, `.nvmrc` (`22`), the `node`/`components`/`rls` Vitest split with `test:ci`/`test:rls`, and the README CI section. Section 7.2 remote proof satisfied — PR #1, run <https://github.com/kbsnydersanomaly/hungr/actions/runs/30090156888> all green (lint 26s, typecheck 29s, unit 44s, build 55s).
- [ ] **P0-E2b** Add clean database bootstrap, migration/schema check, and RLS jobs. Depends on: P0-E1c, P0-E2-design.
- [ ] **P0-E2c** Add selected Playwright smoke jobs and document required checks. Depends on: P0-E2a, P0-E2b.

### P0-E3 Existing PayFast subscription webhook hardening

- [ ] **P0-E3-design** Accept atomic event-claim, validation, transaction, post-commit side-effect, and recovery design.
- [ ] **P0-E3a** Add schema/RPC support for atomic provider-event claims and valid billing transitions. Depends on: P0-E3-design.
- [ ] **P0-E3b** Refactor webhook to stop on duplicate claim and validate merchant/account/amount/currency/state before side effects. Depends on: P0-E3a.
- [ ] **P0-E3c** Queue or safely isolate invoice/email work after committed billing state. Depends on: P0-E3b.
- [ ] **P0-E3d** Add concurrent duplicate, out-of-order, mismatch, and failure-recovery tests plus alerts/runbook. Depends on: P0-E3c.

### P0-E4..P0-E7 Remaining prerequisites

- [ ] **P0-E4** Accept durable worker decision: runtime, queue/claim mechanism, cadence, leases, retries, dead letters, replay, monitoring, hosted-plan requirements, and crash recovery. Blocks Phase 2 outbox implementation.
- [ ] **P0-E5** Accept dual-role identity/account lifecycle design: profile-only Auth provisioning, server-controlled organisation creation, patron closure distinct from Auth deletion, ownership transfer, patron/operator/dual-role tests. Blocks Phase 2 auth changes.
- [ ] **P0-E6a** Design ownership-validating public review RPC, direct-grant changes, payload/rate limits, and abuse monitoring.
- [ ] **P0-E6b** Implement review RPC/grant hardening and cross-tenant/unpublished-menu tests before P1-2 notification fan-out. Depends on: P0-E6a.
- [ ] **P0-E7** Audit `xlsx` package maintenance, advisories, licence, resource-limit support, and alternatives; record keep/replace decision before P1-4 implementation expands spreadsheet use.

- [ ] **P0-exit** Engineering-owned Phase 0 prerequisites complete; external items remain explicitly waiting or are resolved/deferred with owner approval. Depends on: P0-E1c, P0-E2c, P0-E3d, P0-E4, P0-E5, P0-E6b, P0-E7.

## Planning gates and recommended sequence

- Non-trivial roadmap groups require a focused design spec under `docs/superpowers/specs/`; implementation plans follow under `docs/superpowers/plans/` after design acceptance. Required contents are defined in roadmap section 15, “Planning depth and design gates.”
- Design acceptance is recorded with approver role/name and date: engineering for feasibility/safety, product for behaviour/scope, and security/accounting/legal/vendor owners where gated. Document existence alone does not make a group READY.
- First engineering priority: P0-E1 database bootstrap and migration-history repair. It blocks clean onboarding, CI database recreation, and new Supabase projects.
- Independent quick win while P0-E1 is designed: accept `P1-3-design`, then implement the unsaved item-sheet guard.
- In parallel, pursue client-owned P0-1..P0-4 and prepare design specs for P0-E3, P0-E4, and P0-E5 without implementing blocked vendor/legal assumptions.
- Phase 3 and Phase 4 designs must include the roadmap's QR token, immutable-history, monetary, tenant-consistency, payment-allocation, and deletion invariants.

## Phase 1: Platform improvements (roadmap section 5) — DESIGN CHECKPOINTS REQUIRED

### P1-1 Restaurant operating info (5.1)

- [ ] **P1-1-design** Design spec accepted by engineering and product; security accepts schema/RLS boundary. Covers schedule transaction, timezone/overnight semantics, legacy hours migration, public badge cache strategy, and tests.
- [ ] **P1-1a** Migration: `restaurants.timezone` (default `Africa/Johannesburg`), `restaurants.seat_capacity` (nullable, non-negative check), `restaurant_operating_intervals` table; explicit grants + RLS; regenerate types. Depends on: P1-1-design.
- [ ] **P1-1b** Transactional schedule replacement: overlap/overnight/timezone validation, DB checks for weekday/time/order invariants, concurrent-editor handling. Depends on: P1-1a.
- [ ] **P1-1c** Settings UI: weekday open/closed toggles, multi-interval editor, timezone select, seat capacity field. Depends on: P1-1b.
- [ ] **P1-1d** Pure badge function: open/closed/closes-soon derivation (shared with future ordering enforcement). Depends on: P1-1a.
- [ ] **P1-1e** Public display: badge on public menu + About; structured hours replace/derive `about_pages.business_hours`; legacy text preserved until migrated; no badge when no intervals. Depends on: P1-1c, P1-1d.
- [ ] **P1-1f** Migrate specials filtering to restaurant timezone; define weekday mapping and overnight selected-day semantics. Depends on: P1-1a.
- [ ] **P1-1g** Tests: unit (intervals, overnight, midnight boundaries, timezone, closes-soon threshold, specials), component (settings form), direct-write/RLS allow/deny. Depends on: P1-1a..P1-1f.

### P1-2 Notifications (5.2)

- [ ] **P1-2-design** Design spec accepted by engineering, product, and security. Covers atomic review/event creation, abuse controls, recipient authorization, dedupe, Realtime/polling, keyset pagination, retention worker, and tests.
- [ ] **P1-2a** Notification schema foundation: `event_id`/dedupe unique constraint, `(user_id, created_at desc, id desc)` timeline index, bounded-prune indexes, explicit grants/RLS, Realtime publication, regenerated types. Depends on: P1-2-design.
- [ ] **P1-2b** Atomic review/event RPC returning review ID; idempotent recipient fan-out (org owner/admin/manager + restaurant manager, deduped), payload snapshot; in-app rows independent of `review_emails`. Depends on: P1-2a, P0-E6b.
- [ ] **P1-2c** Normalise billing notification types/payloads so bell formatter recognises them. Depends on: P1-2-design.
- [ ] **P1-2d** Bell fixes: mark-read on click, review deep link, accurate unread count, "View all" routes to `/notifications` (preferences stay at `/settings/notifications`). Depends on: P1-2a, P1-2c.
- [ ] **P1-2e** `/notifications` timeline page: keyset pagination on `(created_at, id)`, read/unread filter, mark one/all read, empty state. Depends on: P1-2a, P1-2d.
- [ ] **P1-2f** `team.invite_accepted` event (recipients: org owners/admins minus actor). Depends on: P1-2a.
- [ ] **P1-2g** Realtime badge: user-filtered subscription, reconnect refetch, 60s polling fallback with visibility pause, cross-tab read sync, cleanup on auth/org change. Depends on: P1-2a, P1-2d.
- [ ] **P1-2h** Retention: config values (500 rows / 12 months, read-first), scheduled batched prune job, window stated in UI. Depends on: P1-2a, P0-E4.
- [ ] **P1-2i** Tests: producer idempotency, formatter, stable pagination, count, read state, deep-link access, realtime insert/reconnect, prune eligibility. Depends on: P1-2b..P1-2h.

### P1-3 Unsaved item-sheet guard (5.3)

- [ ] **P1-3-design** Short design spec accepted by engineering and product; confirms close-path inventory, canonical comparison, pending-save behaviour, `beforeunload`, accessibility, and component-test matrix.
- [ ] **P1-3a** Opening snapshot + canonical dirty comparison in `ItemEditSheet` (ignore transient UI state). Depends on: P1-3-design.
- [ ] **P1-3b** Guard all close paths (overlay, Escape, close icon, Cancel, parent close); confirm dialog: "Discard unsaved changes?" / Keep editing / Discard changes; block close while save pending; reset snapshot after successful save. Depends on: P1-3a.
- [ ] **P1-3c** `beforeunload` while dirty. Depends on: P1-3a.
- [ ] **P1-3d** Component tests: every close source, create + edit modes, failed-save stays open and dirty. Depends on: P1-3a..P1-3c.

### P1-4 Spreadsheet compatibility (5.4)

- [ ] **P1-4-design** Design spec accepted by engineering and product; security accepts untrusted-workbook limits and formula-injection handling. Covers package decision, file contracts, transactional modes, fixtures, and rollback.
- [ ] **P1-4a** Implement package decision from P0-E7; replace `xlsx` first if audit fails. Depends on: P1-4-design, P0-E7.
- [ ] **P1-4b** XLSX export: template + current-menu download, recommended default; format chooser UI (XLSX recommended / CSV UTF-8) with help text. Depends on: P1-4a.
- [ ] **P1-4c** CSV hardening: UTF-8 BOM, CRLF, RFC 4180 quoting, formula-injection escaping (`=`, `+`, `-`, `@`). Depends on: P1-4-design.
- [ ] **P1-4d** Import: strip BOM, delimiter detection, surface Papa Parse errors with row/column, reject malformed files; enforce compressed/expanded workbook, sheet, row, and cell limits. Depends on: P1-4a.
- [ ] **P1-4e** Validate full batch before writes; transactional add/modify/replace RPCs cover categories, items, ordering, and pairings. Any failure leaves menu unchanged. Depends on: P1-4d.
- [ ] **P1-4f** Excel and LibreOffice round-trip plus formula-injection fixtures. Depends on: P1-4b..P1-4e.
- [ ] **P1-4g** Reproduce WPS issue and add WPS round-trip fixture. Depends on: P1-4f, P0-1.

### P1-5 Specials ordering (5.5, decision 4)

- [ ] **P1-5-design** Design spec accepted by engineering and product; security accepts tenant-integrity/RLS changes. Covers target consistency, timezone semantics, reorder concurrency, customer-best pricing, checkout bridge, and tests.
- [ ] **P1-5a** Tenant-integrity migration/actions: special menu and every item/category target belong to same restaurant; transactional target replacement; public reads require public restaurant/menu context; RLS tests with foreign IDs. Depends on: P1-5-design.
- [ ] **P1-5b** Migration: `specials.display_order` + backfill (`priority desc, created_at asc, id`) + index; keep `priority` until readers migrate. Depends on: P1-5a.
- [ ] **P1-5c** Atomic reorder RPC (validates ownership, rejects duplicates). Depends on: P1-5b.
- [ ] **P1-5d** Drag-and-drop UI + keyboard controls; remove Priority field from editor; label per 5.5. Depends on: P1-5c.
- [ ] **P1-5e** `bestPriceForItem(item, applicableSpecials)`: customer-best final price, replaces raw-percentage heuristic; used by dashboard preview + public menu and later server quote path. Depends on: P1-5a.
- [ ] **P1-5f** Tests: tenant consistency, target transactionality, reorder concurrency/determinism, conflict pricing across percentage/fixed/category cases, drag + keyboard component tests. Depends on: P1-5a..P1-5e.

### Phase 1 exit

- [ ] **P1-exit** All 5.x acceptance criteria pass; lint, type check, relevant Vitest projects, and production build green. Remove `priority` reader dependencies before later column-drop migration. Depends on: P1-1g, P1-2i, P1-3d, P1-4g, P1-5f.

## Phase 2: Commerce foundations and feature controls (roadmap sections 6-7, 8.1, 10, 14-15)

- [ ] **P2-design** Accept integrated Phase 2 design covering feature controls, dual-role identity, consent, events/outbox, worker, secrets, audit, RLS, migration, and tests. Depends on: P0-6, P0-E4, P0-E5.
- [ ] **P2-1** Add global feature mode/kill switch, organisation overrides, restaurant ordering settings, constraints, grants, RLS, and generated types. Depends on: P2-design.
- [ ] **P2-2** Implement typed fail-closed entitlement resolver and transactional DB enforcement for critical mutations. Depends on: P2-1.
- [ ] **P2-3** Add super-admin feature-control UI, effective-decision diagnostics, expiry/reason handling, and audit. Depends on: P2-2.
- [ ] **P2-4** Replace signup trigger with profile-only provisioning and add server-controlled operator organisation onboarding. Depends on: P2-design.
- [ ] **P2-5** Add patron profile, passwordless auth/callback, safe return context, optional password/account-holder enrolment, dual-role routing, patron closure, and ownership-transfer guard. Depends on: P2-4.
- [ ] **P2-6** Add minimum restaurant-scoped marketing-consent evidence and patron grant/withdraw controls; marketing remains off by default. Depends on: P2-5.
- [ ] **P2-7** Add domain-event/outbox schema, idempotency contracts, transaction helpers, grants, RLS, and generated types. Depends on: P2-design, P0-E4.
- [ ] **P2-8** Implement selected worker claim/lease/retry/dead-letter/replay pattern with monitoring and crash recovery. Depends on: P2-7.
- [ ] **P2-9** Add private provider-connection metadata and approved secret-reference model; prove public clients cannot read secrets. Depends on: P2-design.
- [ ] **P2-10** Add precedence matrix, direct-API bypass, dual-role lifecycle, consent, outbox retry, secrets, and tenant RLS tests; update operations docs. Depends on: P2-1..P2-9.
- [ ] **P2-exit** Disabled features cannot be used through direct API paths; test organisation can be enabled safely; Phase 2 verification and accepted design criteria pass. Depends on: P2-10.

## Phase 3: Order-only pilot without online payment or POS (roadmap sections 7-9, 15)

- [ ] **P3-design** Accept commerce design covering tables, QR residual risk, sessions, catalogue, carts, quotes, orders, immutable history, state transitions, realtime, notifications, deletion, RLS, and tests. Depends on: P2-exit.
- [ ] **P3-0** Add structured schedule exceptions and enforce restaurant-timezone ordering hours through the shared availability function. Depends on: P3-design, P1-1g.
- [ ] **P3-1** Add restaurant tables, one-time seeding from `table_count`, active state, capacity, constraints, grants, RLS, and types. Depends on: P3-design.
- [ ] **P3-2** Implement signed/versioned QR tokens, rotation/revocation, invalid-code UX, printable A5/A6 pack, partial reprint, and reprint warnings. Depends on: P3-1.
- [ ] **P3-3** Add staff-activated table sessions, expiry/extension/closure, rate/value limits, anomaly visibility, and accepted residual-risk controls. Depends on: P3-0, P3-1.
- [ ] **P3-4** Normalize orderable catalogue modifier groups/options, selection constraints, availability, source IDs, and migration from display JSON. Depends on: P3-design.
- [ ] **P3-5** Add capability-protected anonymous carts and mutations bound to active table session; hash capability, enforce ordering hours, expire/revoke safely. Depends on: P3-3, P3-4.
- [ ] **P3-6** Implement transactional anonymous-cart claim through patron authentication with capability rotation and replay protection. Depends on: P2-5, P3-5.
- [ ] **P3-7** Implement server quote path with current catalogue, customer-best specials, immutable applied-special snapshots, and patron reconfirmation on changes. Depends on: P1-5e, P3-4, P3-5.
- [ ] **P3-8** Add orders/items/modifiers/events with tenant consistency, immutable snapshots, deletion semantics, idempotent submission, optimistic concurrency, and fulfilment transition RPC. Depends on: P3-7.
- [ ] **P3-9** Add patron confirmation, realtime tracking with reconnect fetch, order history, and tenant-safe detail views. Depends on: P3-8.
- [ ] **P3-10** Add one-tap reorder with current-catalogue reconciliation for removed, renamed, repriced, and modifier-changed items. Depends on: P3-9.
- [ ] **P3-11** Add restaurateur live board, transition actions, prep estimates, pause/unavailable controls, reconnect reload, and deduplicated alerts. Depends on: P3-8.
- [ ] **P3-12** Add transactional confirmation and idempotent ready notification through outbox worker. Depends on: P2-8, P3-8.
- [ ] **P3-13** Implement fake POS adapter contract and contract tests without Pilot network calls. Depends on: P3-design.
- [ ] **P3-14** Run unit/component/RLS/concurrency/E2E tests plus real-device mobile Safari QR/auth continuity verification. Depends on: P3-0..P3-13.
- [ ] **P3-exit** Selected dev organisation completes scan-to-collected non-monetary order; P0-4 and mobile Safari gate pass before external patron pilot. Depends on: P3-14, P0-4.

## Phase 4: Single-payer online payment (roadmap sections 7.7, 9, 13, 15)

- [ ] **P4-design** Accept provider/accounting/payment design, threat model, invariants, webhook/reconciliation/refund/manual-paid flows, retention, operations, and tests. Depends on: P0-2, P0-E3d, P3-exit.
- [ ] **P4-1** Add per-restaurant provider onboarding/KYC connection flow and safe readiness checks for selected provider. Depends on: P4-design.
- [ ] **P4-2** Add payment intent/attempt/reservation/allocation/refund/provider-event/reconciliation schema with monetary, currency, idempotency, tenant, and deletion constraints. Depends on: P4-design.
- [ ] **P4-3** Implement selected payment-provider adapter: checkout, status query, refund, webhook verification/normalization, and account isolation. Depends on: P4-1, P4-2.
- [ ] **P4-4** Implement pay-first capture mode, locked full-balance reservation, one-active-intent invariant, whole-order checkout, and tips. Depends on: P4-2, P4-3.
- [ ] **P4-5** Implement idempotent webhook settlement transaction with expected account/amount/currency/state validation and mismatch queue. Depends on: P4-4.
- [ ] **P4-6** Implement controlled manual-paid action with limits, reason, manager notification, reversal window, analytics distinction, and audit. Depends on: P4-2.
- [ ] **P4-7** Implement cancellation/rejection/refund commands; paid staff rejection enters `refund_required`, managers move money. Depends on: P4-5.
- [ ] **P4-8** Add receipts, payment failure, refund communication, delivery retries, and immutable history. Depends on: P4-5, P2-8.
- [ ] **P4-9** Add reconciliation/support dashboard, mismatch resolution, provider status reads, and audited overrides. Depends on: P4-3, P4-5.
- [ ] **P4-10** Run duplicate/out-of-order/timeout/failure-injection/security/RLS/E2E tests; add alerts and payment/refund/outage/reconciliation runbooks. Depends on: P4-4..P4-9.
- [ ] **P4-exit** Real-money safety gates pass; financial effects remain exactly-once under retries/timeouts; proceed to Phase 4B. Depends on: P4-10.

## Phase 4B: MVP beta hardening and approved-cohort launch

- [ ] **P4B-design** Accept beta scope, success/error thresholds, rollout, rollback, support ownership, training, and launch checklist. Depends on: P4-exit, P0-4.
- [ ] **P4B-1** Run representative load, concurrency, security, RLS, failure-injection, and recovery tests. Depends on: P4B-design.
- [ ] **P4B-2** Complete operational dashboards, alerts, retention jobs, incident/refund/reconciliation/provider-outage/rollback runbooks. Depends on: P4B-design.
- [ ] **P4B-3** Train pilot organisation and resolve launch-blocking feedback. Depends on: P4B-1, P4B-2.
- [ ] **P4B-4** Apply commercial plan/bolt-on entitlement migration if commercial decision is final; otherwise document approved pilot override. Depends on: P4B-design.
- [ ] **P4B-5** Verify QR, auth, checkout, payment return, and tracking on real-device mobile Safari. Depends on: P4B-1.
- [ ] **P4B-exit** Named owners approve one-provider, single-payer MVP launch to selected cohort; all launch gates and rollback procedure pass. Depends on: P4B-1..P4B-5.

## Phase 5: Custom-amount split payments (roadmap section 7.8, 15)

- [ ] **P5-design** Resolve P0-5 decisions and accept split reservation, tips, expiry, abandonment, provider mixing, refund allocation, recovery, and test design. Depends on: P4-exit, P0-5.
- [ ] **P5-1** Extend reservation/allocation schema and locked remaining-balance RPC for exact payer amounts. Depends on: P5-design.
- [ ] **P5-2** Add custom-amount payer UX and equal-split helper with deterministic rounding remainder. Depends on: P5-1.
- [ ] **P5-3** Integrate split checkout intents with reservation ownership, expiry, and idempotent retries. Depends on: P5-1, P4-3.
- [ ] **P5-4** Settle concurrent final payments under lock; prevent over-allocation and route late captures to reconciliation. Depends on: P5-3.
- [ ] **P5-5** Implement partial-payment expiry, abandonment, staff recovery, and new-round order rules. Depends on: P5-4.
- [ ] **P5-6** Implement split refund allocation and support tooling. Depends on: P5-4.
- [ ] **P5-7** Run concurrency/load/failure tests for simultaneous reservations, captures, expiry, abandonment, and refunds. Depends on: P5-2..P5-6.
- [ ] **P5-exit** Concurrent captures never exceed payable total; abandonment and refunds have documented, tested recovery. Depends on: P5-7.

## Phase 6: Sales analytics and CRM foundation (roadmap sections 9.3, 10, 15)

- [ ] **P6-design** Accept recognized-sales, CRM tenancy, consent, retention, export/closure, audit, query, and test design; P0-4 remains required before real patron data rollout. Depends on: P4-exit.
- [ ] **P6-1** Implement captured-payment-minus-refund fact queries and reconciliation checks. Depends on: P6-design.
- [ ] **P6-2** Build initial sales dashboards for revenue, refunds, orders, AOV, time/table/item/modifier, discounts, latency, failures, and POS dimensions. Depends on: P6-1.
- [ ] **P6-3** Add restaurant-scoped patron projection with first/last order, count, lifetime value, suppression, and pseudonymisation. Depends on: P6-design.
- [ ] **P6-4** Expand consent centre for restaurant visibility, evidence, withdrawal, suppression, and communication eligibility. Depends on: P6-3.
- [ ] **P6-5** Add CRM search, permitted contact display, manual tags/notes with audit, order history, and communication history. Depends on: P6-3, P6-4.
- [ ] **P6-6** Add audited exports plus patron access/correction/export/closure workflows and retention jobs. Depends on: P6-4, P0-4.
- [ ] **P6-7** Run analytics reconciliation, tenant RLS, consent, export, closure, and pseudonymisation tests. Depends on: P6-1..P6-6.
- [ ] **P6-exit** Analytics reconcile to captures/refunds; tenant isolation, consent evidence, and POPIA workflows pass. Depends on: P6-7.

## Phase 7: Promotions, loyalty, and marketing (roadmap sections 10-11, 15)

- [ ] **P7-design** Accept promotions, stamps, draw, consent, campaign, suppression, legal, retry/refund, fraud, and test design. Depends on: P6-exit, P0-4.
- [ ] **P7-1** Add promotion/coupon rule schema and server-authoritative eligibility, stacking, limits, reservation, redemption, and immutable snapshots. Depends on: P7-design.
- [ ] **P7-2** Add append-only loyalty ledger, digital-stamp programmes, accounts, rewards, and redemptions. Depends on: P7-design.
- [ ] **P7-3** Implement idempotent earn/redeem/reverse flows tied to captured payment and refunds. Depends on: P7-2.
- [ ] **P7-4** Add legally cleared prize-draw rules, separate consent, append-only entries, execution method, winner records, and audit. Depends on: P7-design, P0-4.
- [ ] **P7-5** Add consented segments and email campaign MVP with template/version approval and rate limits. Depends on: P6-4, P7-design.
- [ ] **P7-6** Add suppression, unsubscribe, bounce, complaint, delivery events, communication history, and campaign audit. Depends on: P7-5.
- [~] **P7-7** SMS campaigns: deferred until provider, sender, cost, consent, and STOP handling are approved.
- [ ] **P7-8** Run retry/refund/redemption-limit, consent/suppression, draw-audit, abuse, and tenant RLS tests. Depends on: P7-1..P7-6.
- [ ] **P7-exit** Rewards/discounts remain correct under retry/refund; no opted-out patron receives marketing; draw legal gate passes. Depends on: P7-8, P0-4.

## Phase 8: Pilot POS integration (roadmap section 12, 15)

- [ ] **P8-design** Accept Pilot contract, source-of-truth matrix, status vocabulary mapping, credentials, payment/refund interaction, mappings, retries, reconciliation, rollout, and tests; P4-exit is additionally required before implementing POS payment/refund state. Depends on: P0-3, P3-exit.
- [ ] **P8-1** Add secure Pilot connection setup, secret references, validation, rotation metadata, and readiness diagnostics. Depends on: P8-design.
- [ ] **P8-2** Add catalogue/table/waiter mapping records, validation, admin UX, and attention states. Depends on: P8-design.
- [ ] **P8-3** Implement Pilot adapter and data-driven status mapping with one contract test per mapping row. Depends on: P8-1, P8-2.
- [ ] **P8-4** Implement idempotent order push through integration outbox and record delivery attempts. Depends on: P8-3, P2-8.
- [ ] **P8-5** Implement signed callback inbox, unique event claim, allowed transitions, ignored-with-log statuses, and out-of-order handling. Depends on: P8-3.
- [ ] **P8-6** Add retry/backoff, dead-letter visibility, replay, mapping/config attention queue, and support actions. Depends on: P8-4, P8-5.
- [ ] **P8-7** Add reconciliation reads for missing/divergent statuses and payment state where contracted. Depends on: P8-3, P8-5.
- [ ] **P8-8** Complete sandbox certification, selected-location rollout, monitoring, and support runbook. Depends on: P8-4..P8-7.
- [ ] **P8-9** Run contract, callback ordering, worker-crash, retry/replay, reconciliation, secret-access, and tenant tests. Depends on: P8-3..P8-8.
- [ ] **P8-exit** Pilot contract matrix and live sandbox scenarios pass; selected-location rollout and support ownership are approved. Depends on: P8-9.

## Phase 9: Full-scope hardening for selected post-MVP tracks (roadmap section 15)

- [ ] **P9-scope** Product owner records which completed Phase 5-8 exits enter GA; only `[x]` phase exits may be selected. Depends on: P4B-exit.
- [ ] **P9-design** Accept final load/security/operations/retention/rollout checklist for scope recorded by P9-scope. Depends on: P9-scope.
- [ ] **P9-1** Run cross-feature load and concurrency tests at agreed volume thresholds. Depends on: P9-design.
- [ ] **P9-2** Run security threat review, tenant RLS suite, secret review, abuse tests, and external assessment where required. Depends on: P9-design.
- [ ] **P9-3** Run provider/POS/worker failure injection, recovery, replay, reconciliation, and rollback exercises. Depends on: P9-design.
- [ ] **P9-4** Finalize operational dashboards, alerts, SLOs, escalation ownership, and dead-letter/reconciliation monitoring. Depends on: P9-design.
- [ ] **P9-5** Verify retention, pseudonymisation, audit, consent, export, and deletion jobs for selected scope. Depends on: P9-design, P0-4.
- [ ] **P9-6** Complete incident, refund, provider outage, POS outage, reconciliation, data recovery, and rollback runbooks. Depends on: P9-3, P9-4.
- [ ] **P9-7** Complete restaurant/support training, feedback fixes, commercial entitlements, and release communications. Depends on: P9-1..P9-6.
- [ ] **P9-exit** Named product, engineering, security, operations, legal/accounting, and vendor owners approve GA for selected scope. Depends on: P9-1..P9-7.

## Deferred backlog (roadmap section 16)

- [~] **D-1** Item-level bill claiming.
- [~] **D-2** Mixed cash/card/provider tender.
- [~] **D-3** Shared editable group cart.
- [~] **D-4** Open tabs and post-pay ordering.
- [~] **D-5** Delivery and takeaway.
- [~] **D-6** Inventory decrement.
- [~] **D-7** Advanced kitchen stations and course firing.
- [~] **D-8** Campaign automation.
- [~] **D-9** Tiered loyalty and referrals.
- [~] **D-10** Multiple POS providers.
- [~] **D-11** Multi-currency.
- [~] **D-12** Waiter call/service requests.
- [~] **D-13** Reservations/live availability bounded context.
- [~] **D-14** `accept_then_pay` capture mode and unpaid-limbo/nag/expiry workflow.
- [~] **D-15** Spend-points loyalty programme.
- [~] **D-16** Visit rewards.
- [~] **D-17** Birthday rewards with explicit date-of-birth purpose and retention review.
- [~] **D-18** Loyalty multipliers, category/item missions, and lapsed-patron offers.

## Session log

| Date | Work | Verification | Next |
|---|---|---|---|
| 2026-07-22 | Roadmap authored + verified against code; 13 decisions closed (section 20); skills `hungr-project-workflow`/`hungr-next-ui-work`/`hungr-supabase-actions` + this state file + `hungr-roadmap-execution` skill created | Roadmap section 3 claims grep-verified against code | Start P1-1 or P1-3 (smallest); chase P0-1..P0-4 externals |
| 2026-07-23 | Audited roadmap against code; added engineering prerequisites P0-E1..P0-E7; corrected Phase 1 integrity work, dual-role identity, money permissions, specials checkout, worker/CI/bootstrap gates, and Phase 4B MVP launch; consolidated stale documents into `docs/HISTORY.md` | `git diff --check`; repository Markdown scans found no deleted-document references or superseded roadmap wording; `docs/**/*` inventory contains only current state/history | Start P1-3 (independent) or P0-E1; pursue P0-1..P0-4 externals |
| 2026-07-23 | Recorded planning-depth policy and priority design queue; added QR-token storage/signing, immutable-history deletion, order/payment database invariants, Supabase patron-upgrade clarification, and mobile Safari compatibility gate | `git diff --check`; roadmap/state consistency scan | Design P0-E1 first; P1-3 may proceed independently |
| 2026-07-23 | Review follow-up: documented static-QR remote-reuse risk, made design acceptance explicit, added `P1-3-design`, and made real-device mobile Safari verification a Phase 3/4B launch dependency | `git diff --check`; targeted roadmap/state review | Write P0-E1 design; `P1-3-design` can proceed in parallel |
| 2026-07-23 | Added explicit accepted-design checkpoints for every Phase 1 group and removed premature Phase 1 READY status | `git diff --check`; design-gate alignment review | Write P0-E1 design; choose one Phase 1 design checkpoint in parallel |
| 2026-07-23 | Expanded status checklist through Phase 9 plus deferred backlog; added partial/blocked/waiting/deferred syntax; upgraded roadmap skill and `/roadmap-next` command for exactly one autonomous task per session | `git diff --check`; checklist/skill consistency review | Run `/roadmap-next`; expected selection `P0-E1-design` |
| 2026-07-23 | Checklist audit fixes: canonicalized dependencies, added Phase 1 ordering, Phase 9 scope gate, schedule-exception task, missing deferred scope, human-only design acceptance, and exact interruption resume points | `git diff --check`; independent dependency/coverage/skill audit returned no remaining high/medium findings | Restart OpenCode, then run `/roadmap-next`; expected selection `P0-E1-design` |
| 2026-07-23 | Added hardened overnight roadmap automation: deterministic selector/state validator, one-task fresh-session runner, restricted unattended agent, bounded retries/runtime, control-plane integrity checks, transition/result validation, stall detection, locking, and resumable logs | `bash -n scripts/roadmap-overnight.sh`; `node --check scripts/roadmap-state.mjs`; state validation/selection and synthetic positive/negative transition/result tests; independent safety reviews | Run in isolated Linux clone/user after committing reviewed changes; next task remains `P0-E1-design` |
| 2026-07-24 | Ported dev environment to Windows (corepack pnpm, deps installed, hosted Supabase `bvkiqrgkommynhdvsdut` wired via `.env.remote-db`, app on port 3001). Selected `P0-E1-design`; drafted `docs/superpowers/specs/2026-07-24-database-bootstrap-design.md`. Established the baseline's exact cut point (`20260630130000`), identified the two unguarded `create policy` statements that make replay fail, and found that `20260624130001` is the sole source of the `help-media` bucket — so a naive squash would silently break help-article uploads on every fresh database | `supabase projects list`; `supabase link`; `supabase migration list --linked` (14 = 14, in sync); static baseline/migration cut-point analysis; CLI flag verification for `migration repair --status`, `db dump --linked`, `stop --no-backup`; `pnpm exec tsc --noEmit` clean; `pnpm lint` clean; `pnpm exec vitest run` 436 passed / 0 failed; `/api/health` returns `db: ok` | `P0-E1-design` accepted same session by engineering (Kyle-Ben, 2026-07-24), Option A + section 9 defaults; marked `[x]`. Correction recorded: `P0-E1a`'s description was rewritten because its original "without invalidating existing hosted migration history" wording contradicts the accepted squash strategy. Next task is `P0-E1a` |
| 2026-07-24 | `P0-E1a`: built `supabase/migrations/20260717120001_baseline.sql` (hosted `public` dump + section 2 carrying the `auth.users` trigger, conditional `review_stats` refresh, all five buckets **including `help-media`**, and all 17 storage policies), deleted the 14 superseded migrations, regenerated `supabase/schemas/baseline.sql` as documentation-only with an explicit "never apply this" header, repaired the hosted ledger (14 → `reverted`, `20260717120001` → `applied`), and refreshed the now-obsolete `scripts/check-schema-drift.ts` header comment | `supabase migration list --linked` 14 = 14 before, **1 = 1 after**; `supabase stop --no-backup` + `start` + `db reset` applied the baseline from a genuinely empty volume; `db diff --from migrations --to linked` **no differences**; hosted `public` and `storage` dumps SHA-256 **identical before/after repair**; fresh local DB has 5 buckets, 17 storage policies, `on_auth_user_created -> handle_new_user`, `review_stats` populated, 30 tables / 71 policies / 14 functions; hosted-vs-local `public` dump differs only by `pg_net`, which the local stack enables itself; `pnpm db:gen-types` left `lib/database.types.ts` byte-identical (blob hash match); `pnpm exec vitest run` 436 passed / 0 failed; `pnpm exec tsc --noEmit` clean; `pnpm lint` clean | Two corrections recorded: (1) spec section 5.4 step 1's pre-flight `supabase db diff --linked` is **unrunnable before the squash** — it replays migrations into an empty shadow and dies on `20260615110000` with `ERROR: relation "branding" does not exist`, which is the P0-E1 defect itself; drift was instead proven after the squash by dump equality. (2) bare `db diff --linked` emitted a spurious drop list where the explicit `--from/--to` form found nothing — `P0-E1c` must use the explicit form. Notes for `P0-E1b`: `pnpm db:check` could not run (no `psql` on PATH on this Windows workstation), and `pnpm env:local` references a `.env.local-db` file that does not exist, so the bootstrap command must not assume it. Next task is `P0-E1b` |
| 2026-07-24 | `P0-E1b`: added `pnpm db:bootstrap` (`scripts/bootstrap-db.ts`) composing `supabase stop --no-backup` (with `--fresh`), `start`, `db reset`, seed, and type generation; extracted `scripts/supabase-local.ts` (loopback-only target resolution from `supabase status`, never `.env.local`); made `db/seed.ts` export `seed()`, upsert plans on `slug`, and refuse non-local URLs unless `SEED_ALLOW_REMOTE=1`; added `tests/unit/bootstrap-db.test.ts` | `pnpm db:bootstrap --fresh` from a discarded volume: baseline applied, seeded, types written; five buckets present **including `help-media`**; seed run 3× total leaves 3 plans / 1 help category / 1 help article; `pnpm db:seed` against the hosted `.env.local` **refused** (exit 1); `pnpm db:bootstrap --skip-types` on an already-running stack succeeded; `supabase start` on a running stack exits 0; `git diff lib/database.types.ts` **empty**; `pnpm exec vitest run` 450 passed / 0 failed; `pnpm exec tsc --noEmit` clean; `pnpm lint` clean | Design decision 1 followed exactly: no `supabase/seed.sql`, no `[db.seed]` in `config.toml` (`db reset` logs a harmless `WARN: no files matched pattern: supabase/seed.sql`). `pnpm db:check` still not runnable here (no `psql` on PATH) — it is `P0-E1c`'s to resolve. New child added: **`P0-E1d`** — `pnpm env:local` references a non-existent `.env.local-db` and both env scripts use `cp`, so the app cannot be pointed at the freshly bootstrapped database. Next task is `P0-E1c` |
| 2026-07-24 | `P0-E1c`: ran the spec section 7 verification end-to-end from a discarded volume; added `pnpm db:smoke` (`scripts/smoke-test-db.ts`) so the section 1.4 non-public objects are proven at runtime rather than by inspection; rewrote `scripts/check-schema-drift.ts` to read the ledger through the pinned Supabase CLI instead of `psql`; removed the `P0-E1` bootstrap gate from `README.md`, `DEPLOYMENT.md`, `DEMO_AND_TEST_PLAN.md`, and `.agents/PROJECT_NOTES.md` | Pre-flight `supabase migration list --linked` **1 = 1**; `supabase db diff --from migrations --to linked` **no differences** (before and after); `pnpm db:bootstrap --fresh` rebuilt from an empty volume; `git diff --exit-code lib/database.types.ts` **clean**; `pnpm db:check` **OK — 1 file applied**; `pnpm db:smoke` **9/9** (profiles row on signup, public review insert, manager `menu-media` upload, **super-admin `help-media` upload**, service-role invoice write, org-admin invoice download, plus 3 negative policy checks); local-vs-hosted `public` dumps identical apart from `pg_net` (both **71 policies / 138 grants / 30 tables / 14 functions / 38 indexes / 1 trigger**); `storage` dumps **17 = 17 policies, names identical**; `pnpm exec vitest run tests/rls` 9 passed; `pnpm exec vitest run` **463 passed / 0 failed** (58 files); `pnpm exec tsc --noEmit` clean; `pnpm lint` clean; `pnpm build` succeeded | All eight spec section 8 success criteria pass; marked `[x]`. Two notes: (1) `pnpm db:check` could not run at all before this session (`psql` not on PATH), so making it CLI-based was required to execute the mandated verification — the pure comparison functions and their unit tests are unchanged, with four new tests for the ledger-output parser. (2) The RLS suite and smoke tests need `.env.local` pointing at local, so `.env.local-db` was written by hand from `.env.remote-db` plus `supabase status`; `pnpm env:local`/`env:remote` are still broken on Windows. `.env.local` is left pointing at **local** — restore hosted with `Copy-Item .env.remote-db .env.local`. Next task is `P0-E1d` |
| 2026-07-24 | `P0-E1d`: added `scripts/env-preset.ts` and repointed `env:local`/`env:remote`/`env:which` at it, replacing the `cp`/`grep` one-liners that cannot run in the Windows shell. `env:local` now creates `.env.local-db` when it is missing (from `.env.remote-db`, else `.env.example`, with a generated header and `MAIL_PROVIDER=console`) and refreshes `NEXT_PUBLIC_SUPABASE_URL`, both keys, and `SUPABASE_DB_URL` from `supabase status` on every switch, preserving all other values, comments, ordering, and line endings; falls back to the existing preset when the stack is stopped. Added `tests/unit/env-preset.test.ts`; documented the behaviour in `README.md` | `pnpm exec vitest run tests/unit/env-preset.test.ts` 17 passed; `pnpm env:which`/`env:remote`/`env:local` round-trip verified (hosted → local → hosted); **refreshing the hand-written preset reproduced it byte-for-byte** (SHA-256 match); deleting `.env.local-db` and re-running `pnpm env:local` regenerated it with **every value identical** to the hand-written file; `pnpm exec vitest run tests/rls` 9 passed against the generated preset; with the stack stopped (`supabase stop`) `pnpm env:local` warned and reused the preset (exit 0) while the same command with no preset **exited 1** naming `pnpm db:bootstrap`; `env:local --no-refresh` with no preset, `env:remote` with `.env.remote-db` moved away, and an unknown command each **exited 1** with an actionable message; `pnpm exec vitest run` **480 passed / 0 failed** (59 files); `pnpm exec tsc --noEmit` clean; `pnpm lint` clean; `pnpm build` succeeded | **`P0-E1` group is now complete.** Two notes: (1) `useLocal`/`useRemote` had to be renamed `activateLocal`/`activateRemote` — `react-hooks/rules-of-hooks` treats any `use*` function call as a hook, even in a script. (2) `.env.local` is left pointing at **local**; switch with `pnpm env:remote`, which now works. Next task is `P0-E2-design` |
| 2026-07-24 | `P0-E2-design`: drafted `docs/superpowers/specs/2026-07-24-ci-foundation-design.md` — GitHub Actions (`ci.yml` + `.github/actions/setup` composite + `.nvmrc`), six parallel jobs (`lint`, `typecheck`, `unit`, `build`, `database`, `e2e`), **zero repository secrets**, local Supabase stack per database job, `corepack`-provisioned pnpm, pnpm/Next/Playwright caches, `pull_request` + `push: main` + `workflow_dispatch` triggers, four-spec PR smoke set with the full nine on `main`, per-job timeouts, no `continue-on-error`, and a documented required-checks list a repository admin must enable. Two findings drive repository changes: `vitest.config.ts`'s `node` project bundles `tests/rls/**` with `tests/unit/**` (so no Docker-free unit job is possible until `rls` is split into its own project), and `pnpm env:local`'s `.env.example` fallback is what makes a secretless CI possible, so it becomes a contract | Verified against code, not assumed: no `.github/` exists; `origin` is GitHub and deploy target is Vercel (`DEPLOYMENT.md`); Supabase CLI is a devDependency invoked through Node by all three scripts; `supabase/config.toml` Postgres 17 / API 54321 / DB 54322 / `enable_confirmations = true`; `.gitignore` ignores `.env*` except `.env.example`; `scripts/bootstrap-db.ts` self-pins from `supabase status` and needs no `.env.local`; `scripts/env-preset.ts` `localPresetBase()` falls back `.env.local-db` → `.env.remote-db` → `.env.example`; `tests/rls/helpers.ts` throws at module load on a non-loopback URL; `playwright.config.ts` has no `webServer` and already sets `retries: 2` / `workers: 1` under `CI`; `app/api/health/route.ts` exists. Two commands actually run: **`pnpm build` with placeholder env against a dead port (`http://127.0.0.1:54399`) succeeded** — every app route is `ƒ`, only `/reset`, `/sign-in`, `/verify`, `/_not-found` are static and none evaluates the server env proxy, so the build job needs no database; and **`pnpm exec vitest run --project components` passed 156/0**, confirming Vitest 4 honours the `--project` selection the split depends on | Marked `[>]` — no design may be accepted by the agent. Awaiting: engineering approver; confirm decisions D1–D13, in particular **D3**, the `.nvmrc` Node pin (recommended `22` to mirror Vercel; the live Vercel project runtime should be checked before pinning, and the workstation runs Node 24). On acceptance, record approver/role/date in spec section 11, mark `P0-E2-design` `[x]`, and start `P0-E2a` (which now also carries the Vitest project split and `.nvmrc`). Recorded constraint: per section 7.2, `P0-E2a`–`P0-E2c` cannot reach `[x]` without a green Actions run, and the agent does not push — each will end `[-]` with a pending run URL unless the user pushes during the session |
| 2026-07-24 | `P0-E2-design` accepted by engineering (Kyle-Ben, D1–D13 as recommended) and recorded in spec section 11; then `P0-E2a`: added `.nvmrc` (`22`), `.github/actions/setup/action.yml` (Corepack + `actions/setup-node@v4` with `node-version-file` and `cache: pnpm` + `pnpm install --frozen-lockfile`), and `.github/workflows/ci.yml` with four jobs — `lint`, `typecheck`, `unit` (`pnpm test:ci`), and `build` (committed placeholder env, Next build cache, no Docker). Split `vitest.config.ts` into three projects (`node` = `tests/unit/**`, `components`, new `rls` = `tests/rls/**`) and added `test:ci` / `test:rls` scripts; documented the CI section and the two new scripts in `README.md` | Both YAML files parse (js-yaml); **`pnpm test:ci` with `.env.local` moved aside: 471 passed / 0 failed (56 files)** — the exact condition the `unit` job runs under; `pnpm test:rls` with no env **failed with the intended message** (`RLS tests refused to run: NEXT_PUBLIC_SUPABASE_URL (undefined) is not a local Supabase instance`, exit 1) and **passed 9/0** against the local stack; bare `pnpm exec vitest run` still **480 passed / 0 failed**, so local behaviour is unchanged; `pnpm lint` clean; `pnpm exec tsc --noEmit` clean; **`pnpm build` with `.env.local` moved aside and only the workflow's placeholder env exited 0**; `pnpm install --frozen-lockfile` exits 0 (adding scripts does not invalidate the lockfile); `.env.local` restored and confirmed pointing at local | `P0-E2a` left **`[-]`**, not `[x]`: design section 7.2 requires a green Actions run, which needs a push, and the agent does not push. Remaining work is exactly that — push the branch, open a PR, record the run URL and per-job durations, then mark `[x]`. Everything agent-side is done and verified. Next task is `P0-E2b` (clean database bootstrap, `git diff --exit-code lib/database.types.ts` drift gate, `pnpm db:check`, `pnpm db:smoke`, `pnpm test:rls`), which depends on `P0-E1c` and `P0-E2-design` only — it is not blocked by `P0-E2a`'s pending run |
| 2026-07-24 | `P0-E2a` remote proof: created branch `ci/p0-e2a-foundation`, committed 75 files (the `P0-E1` squash and Phase 0 tooling, the roadmap/state/spec documents, and the CI foundation — all previously verified but never committed), pushed, and opened PR #1. Two files that had been **untracked** and would have broken CI on a clean checkout are now tracked: `supabase/migrations/20260717120001_baseline.sql` (without it the repo has 14 deleted migrations and no baseline) and `.env.example` (`pnpm env:local`'s CI fallback, un-ignored in `.gitignore` but never added). Removed a stray empty file named `json`; gitignored `.claude/settings.local.json` while tracking the shared skills under `.agents/`, `.claude/skills/`, and `.opencode/`. Second commit bumped `actions/checkout` and `actions/setup-node` to `v5` after the first run annotated both as targeting the deprecated Node 20 | Staged diff scanned for secrets before committing — only placeholders matched. **Run 1** <https://github.com/kbsnydersanomaly/hungr/actions/runs/30090026918> **all green** (lint 42s, typecheck 39s, unit 54s, build 61s) with three Node 20 deprecation annotations. **Run 2** <https://github.com/kbsnydersanomaly/hungr/actions/runs/30090156888> after the `v5` bump **all green, no annotations** (lint 26s, typecheck 29s, unit 44s, build 55s) — well inside the design's 15-minute PR target. `gh pr checks 1` also shows **Vercel: pass** — a *preview* deployment, confirming a branch push does not touch production or the `vercel.json` cron | `P0-E2a` marked **`[x]`** — design section 7.2's remote proof is satisfied. One environment note: `git push` failed with HTTP 403 because `gh`'s active account was `PaperjetStudios` while `origin` is `kbsnydersanomaly/hungr`; `gh auth switch --user kbsnydersanomaly` fixed it and the active account was left switched. PR #1 is open against `main` and not merged — merging is the user's call. Next task is `P0-E2b` (clean database bootstrap job, `git diff --exit-code lib/database.types.ts` drift gate, `pnpm db:check`, `pnpm db:smoke`, `pnpm test:rls`) |
