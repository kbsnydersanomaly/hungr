# P0-E2 Design: CI foundation

- Roadmap item: `P0-E2-design` (state file `docs/ROADMAP_STATE.md`, Phase 0 engineering prerequisites).
- Implements roadmap section 1159: "Add CI for lint, `tsc --noEmit`, unit/component tests, clean database bootstrap, RLS tests, schema drift, production build, and selected E2E smoke tests."
- Depends on: `P0-E1-design` (accepted 2026-07-24) and the delivered `P0-E1a`–`P0-E1d` tooling.
- Status: draft awaiting engineering acceptance (section 11).

## 1. Context

### 1.1 Verified current state

Checked against the working tree on 2026-07-24:

- **There is no CI.** No `.github/` directory exists. Every check has been run by hand on a Windows workstation.
- **Host is GitHub, deploy target is Vercel.** `origin` is `https://github.com/kbsnydersanomaly/hungr.git`; `DEPLOYMENT.md` part 2 describes Vercel importing the GitHub repository and running `pnpm build`.
- **Package manager is pinned.** `package.json` sets `packageManager: pnpm@10.19.0+sha512...`, so `corepack enable` reproduces the exact version without a third-party setup action.
- **The Supabase CLI is a devDependency**, not a system tool: `supabase@^2.98.1`. `scripts/bootstrap-db.ts`, `scripts/env-preset.ts`, and `scripts/check-schema-drift.ts` all invoke it as `node node_modules/supabase/dist/supabase.js`. CI therefore runs the same CLI build a workstation runs.
- **Local stack shape** (`supabase/config.toml`): Postgres `major_version = 17`, API `54321`, database `54322`, storage `file_size_limit = "50MiB"`, signup `enable_confirmations = true`.
- **All `.env*` files are gitignored except `.env.example`.** CI has no environment file until it makes one.
- **`pnpm db:bootstrap` is self-pinning.** It resolves its target from `supabase status`, sets `NEXT_PUBLIC_SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` in-process before importing `db/seed.ts`, and aborts on any non-loopback API URL. It needs no `.env.local`.
- **`pnpm env:local` already works with only committed files.** `localPresetBase()` falls back `.env.local-db` → `.env.remote-db` → `.env.example`, then overwrites `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_DB_URL` from `supabase status`, forcing `MAIL_PROVIDER=console` on a derived preset. In CI only `.env.example` exists, which is exactly the supported fallback.
- **`pnpm db:check` no longer needs `psql`** (`P0-E1c`); it reads `supabase_migrations.schema_migrations` through the pinned CLI.
- **`pnpm db:smoke` and `tests/rls/**` read `.env.local` through dotenv.** `tests/rls/helpers.ts` throws at module load when `NEXT_PUBLIC_SUPABASE_URL` is not loopback and `RLS_ALLOW_REMOTE !== "1"`.
- **Playwright has no `webServer`.** `playwright.config.ts` uses `baseURL = PLAYWRIGHT_BASE_URL ?? http://localhost:3000`, and under `CI` sets `forbidOnly`, `retries: 2`, `workers: 1`. Nine specs exist in `tests/e2e/`.
- **`/api/health` exists** (`app/api/health/route.ts`) and is the documented post-deploy probe.

### 1.2 The blocking defect in `vitest.config.ts`

The `node` Vitest project includes **both** `tests/unit/**/*.test.ts` **and** `tests/rls/**/*.spec.ts`:

```ts
name: "node",
include: ["tests/unit/**/*.test.ts", "tests/rls/**/*.spec.ts"],
```

So `pnpm exec vitest run` cannot run without a database. A CI job that only wants lint-speed unit and component feedback would import `tests/rls/helpers.ts`, find `NEXT_PUBLIC_SUPABASE_URL` unset, and die on the guard above. The database-free and database-backed test tiers must be separable before the job graph can exist. This is the one repository change CI forces.

### 1.3 The production build does not need a database

Verified 2026-07-24 on this workstation, with nothing listening on the placeholder port:

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54399 \
NEXT_PUBLIC_SUPABASE_ANON_KEY=ci-placeholder-anon-key \
SUPABASE_SERVICE_ROLE_KEY=ci-placeholder-service-role-key \
NEXT_PUBLIC_APP_URL=http://localhost:3000 \
pnpm build
```

completed successfully. Every application route is `ƒ` (server-rendered on demand); the only `○` static pages (`/reset`, `/sign-in`, `/verify`, `/_not-found`) do not evaluate the server env proxy at build time. The `build` job therefore needs no Docker and no database, which keeps the fastest failure signal off the slowest dependency.

`lib/env.ts` computes `isDev = process.env.NODE_ENV !== "production"`, so under a production build `PAYFAST_MERCHANT_ID`/`PAYFAST_MERCHANT_KEY` become required *if* anything calls `getEnv()` during the build. Nothing does today. Placeholders for both are still supplied so that adding one prerendered page that touches server env does not turn into a mystery CI break.

### 1.4 What CI has to protect

Phase 0's whole point was that a clean machine can rebuild the database from `supabase/migrations/` alone. That guarantee decays silently: it only breaks when someone provisions a fresh database, which nobody does on a normal working day. CI is the only thing that will keep exercising it. The same applies to `pnpm db:smoke`, which proves the non-public Auth/Storage objects a schema diff cannot see.

## 2. Goal

A GitHub Actions workflow that, on every pull request and every push to `main`:

1. Fails fast on lint, type, unit, and component regressions.
2. Proves the production build still compiles.
3. Rebuilds the database from an empty volume, checks the migration ledger, runs the runtime smoke tests, and runs the RLS suite.
4. Runs a selected Playwright smoke set against a production server backed by that database.
5. Requires **zero repository secrets** and is safe to run on fork pull requests.
6. Runs the same commands a developer runs locally, so a red CI is reproducible in one command.

## 3. Exclusions

- **Deployment.** Vercel owns deploys; CI never deploys and never runs `supabase db push` against the hosted project. Hosted migration application stays the manual, reviewed step in `DEPLOYMENT.md`.
- **Hosted or branch databases in CI.** Section 4 option B is rejected.
- **Coverage thresholds**, dependency update bots, and release automation.
- **Security scanning and external assessment** — `P9-2`.
- **Load, soak, and failure-injection testing** — `P4B-1`, `P9-1`, `P9-3`.
- **Real-device mobile Safari verification** — `P3-14`, `P4B-5`; a hosted device cloud is not in scope here.
- **Enabling branch protection.** The workflow defines the checks; a repository admin must mark them required (section 5.10).

## 4. Options considered

| Option | Summary | Verdict |
|---|---|---|
| **A. GitHub Actions + local Supabase stack per database job** | `ubuntu-latest` runners, Docker already present, `pnpm db:bootstrap` builds the database from the baseline in-job | **Selected.** Zero secrets, zero shared state, and it re-proves the `P0-E1` guarantee on every run |
| B. GitHub Actions + hosted Supabase branch/preview database | CI points at a real Supabase project per branch | Rejected: requires access tokens and project refs as secrets (fork PRs then lose CI), costs money per branch, shares state between concurrent runs, and — decisively — cannot prove "a fresh database builds from migrations alone", which is the thing most worth protecting |
| C. Vercel checks only | Rely on Vercel's build for signal | Rejected: no lint, no tests, no database, no RLS; a build-only gate would have caught none of the `P0-E1` defects |
| D. One monolithic job | Everything sequential in a single job | Rejected: a lint typo would wait behind a Docker pull, and the failing step is buried in one log |

### 4.1 Why the local stack is affordable

The database and e2e jobs pay a Supabase Docker image pull (roughly 2–4 minutes on a cold runner). That is accepted rather than optimised because the alternative is shared mutable state. Revisit only if either job's wall time exceeds 10 minutes (section 5.7).

## 5. Design

### 5.1 Provider, triggers, permissions, concurrency

One workflow file, `.github/workflows/ci.yml`, named `CI`.

```yaml
on:
  pull_request:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read

concurrency:
  group: ci-${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: ${{ github.event_name == 'pull_request' }}
```

- `pull_request` (not `pull_request_target`): the workflow uses no secrets, so running fork code is safe and fork PRs get full CI.
- Superseded PR runs are cancelled; `main` runs are never cancelled, so the history of `main` stays complete.
- `permissions: contents: read` at workflow level; no job widens it.

### 5.2 Job graph

Six jobs. The first five have no `needs` and start together, so the slowest job sets wall-clock time.

| Job | Commands | Needs | Docker | Timeout |
|---|---|---|---|---|
| `lint` | `pnpm lint` | — | no | 10 min |
| `typecheck` | `pnpm exec tsc --noEmit` | — | no | 10 min |
| `unit` | `pnpm test:ci` | — | no | 15 min |
| `build` | `pnpm build` (placeholder env, section 5.4) | — | no | 20 min |
| `database` | `pnpm db:bootstrap` → `pnpm env:local` → `pnpm db:check` → `pnpm db:smoke` → `pnpm test:rls` | — | yes | 25 min |
| `e2e` | bootstrap → `pnpm env:local` → `pnpm build` → `pnpm start` → selected Playwright specs | `[unit, build]` | yes | 35 min |

`e2e` takes `needs: [unit, build]` purely to avoid spending a Docker pull and a full build when cheaper signals already failed. It does **not** consume the `database` job's stack: every GitHub Actions job runs on its own VM, so `e2e` bootstraps its own database. That duplication is deliberate and is the cost of job isolation.

`P0-E2a` delivers `lint`, `typecheck`, `unit`, `build`. `P0-E2b` adds `database`. `P0-E2c` adds `e2e` and the required-checks documentation.

### 5.3 Shared setup

A composite action at `.github/actions/setup/action.yml` used by every job:

```yaml
runs:
  using: composite
  steps:
    - run: corepack enable
      shell: bash
    - uses: actions/setup-node@v4
      with:
        node-version-file: .nvmrc
        cache: pnpm
    - run: pnpm install --frozen-lockfile
      shell: bash
```

`actions/checkout` stays in each job (a composite action cannot be the first thing that fetches the repository containing it).

- `corepack enable` honours `packageManager`, so CI and workstations resolve the identical pnpm build. No `pnpm/action-setup` version to drift.
- `--frozen-lockfile` makes a stale `pnpm-lock.yaml` a CI failure rather than a silent resolution.
- Node is pinned by a new `.nvmrc`. **Recommended value: `22`** — the current Vercel default runtime, so the `build` job mirrors production. The workstation currently runs Node 24; pinning CI lower is intentional (production parity beats workstation parity), and `.nvmrc` also documents the supported version for new machines. See decision D3.

### 5.4 Environment strategy — zero secrets

Nothing in this workflow reads `secrets.*`.

**Database-free jobs** (`build`, and any future job needing env) set placeholders inline in the workflow file. They are literal non-secrets and are committed:

```yaml
env:
  NEXT_PUBLIC_APP_URL: http://localhost:3000
  NEXT_PUBLIC_SUPABASE_URL: http://127.0.0.1:54321
  NEXT_PUBLIC_SUPABASE_ANON_KEY: ci-placeholder-anon-key
  SUPABASE_SERVICE_ROLE_KEY: ci-placeholder-service-role-key
  PAYFAST_MERCHANT_ID: "10013557"
  PAYFAST_MERCHANT_KEY: nn7rftlml9ki3
  MAIL_PROVIDER: console
```

The two PayFast values are the sandbox credentials already committed in `.env.example` and defaulted in `lib/env.ts`.

**Database-backed jobs** do not use placeholders. They run, in this order:

1. `pnpm db:bootstrap` — self-pinning, needs no env file.
2. `pnpm env:local` — creates `.env.local-db` from `.env.example` (the only preset present in a clean checkout), refreshes the four Supabase values from `supabase status`, forces `MAIL_PROVIDER=console`, and activates it as `.env.local`.

Everything downstream (`db:check`, `db:smoke`, `tests/rls/**`, `tests/e2e/helpers.ts`) then finds a correct `.env.local` through its existing dotenv load, with no CI-specific branch in application or test code.

Consequence to preserve: **`pnpm env:local` must keep working with only `.env.example` present.** A future change that makes `.env.remote-db` mandatory breaks CI. Add a comment to that effect in `scripts/env-preset.ts` during `P0-E2b`.

Two env vars are set for every job: `CI: true` (GitHub sets it; Playwright's config already keys off it) and `NEXT_TELEMETRY_DISABLED: 1`.

### 5.5 Local Supabase lifecycle in CI

- `ubuntu-latest` ships Docker; no Docker setup step is needed.
- Start via `pnpm db:bootstrap` (no `--fresh`) — a runner volume is already empty, and `--fresh` would only add a pointless `stop`.
- Bootstrap covers `supabase start`, `supabase db reset` (applies `20260717120001_baseline.sql`), idempotent seed, and type generation.
- **Generated-types drift gate** (in the `database` job, immediately after bootstrap): `git diff --exit-code lib/database.types.ts`. Because bootstrap regenerates the file, a non-empty diff means the committed types no longer match the migrations. This is a cheap, exact check and it belongs to `P0-E2b`.
- **Migration ledger gate**: `pnpm db:check`.
- **Non-public object gate**: `pnpm db:smoke` (auth trigger, `review_stats`, all five buckets including `help-media`, service-role and org-admin invoice paths, three negative policy checks).
- No `supabase stop` step — the VM is discarded. Add an `if: failure()` diagnostics step instead (section 5.11).
- `supabase db diff --from migrations --to linked` is **not** run in CI: it requires a linked hosted project and an access token, which would reintroduce secrets. Hosted equivalence stays a manual pre-deploy check, and `P0-E1a`'s session log already records that the bare `--linked` form is unreliable on CLI v2.106.0.

### 5.6 Required repository change: split the Vitest projects

`vitest.config.ts` gains a third project and the `node` project loses the RLS glob:

```ts
{ name: "node",       include: ["tests/unit/**/*.test.ts"] },
{ name: "components", include: ["tests/components/**/*.test.{ts,tsx}"], environment: "jsdom", setupFiles: [...] },
{ name: "rls",        include: ["tests/rls/**/*.spec.ts"] },
```

`package.json` gains two stable command names so the workflow never encodes a project list:

```json
"test:ci":  "vitest run --project node --project components",
"test:rls": "vitest run --project rls"
```

`pnpm test` and a bare `pnpm exec vitest run` keep running all three projects, so local behaviour is unchanged and the existing 480-test full run stays meaningful. Only the CI split is new. This change lands in `P0-E2a`, because the `unit` job depends on it.

### 5.7 Caching

| Cache | Mechanism | Key | Jobs |
|---|---|---|---|
| pnpm store | `actions/setup-node` `cache: pnpm` | lockfile hash (built in) | all |
| Next build cache | `actions/cache` on `.next/cache` | `${{ runner.os }}-next-${{ hashFiles('pnpm-lock.yaml') }}-${{ hashFiles('app/**', 'components/**', 'lib/**') }}`, restore-keys on the lockfile prefix | `build`, `e2e` |
| Playwright browsers | `actions/cache` on `~/.cache/ms-playwright` | `${{ runner.os }}-playwright-${{ hashFiles('pnpm-lock.yaml') }}` | `e2e` |

Playwright installs run as `pnpm exec playwright install --with-deps chromium` on a cache miss and `pnpm exec playwright install-deps chromium` on a hit — OS packages live outside the cached browser directory and must be installed either way.

Supabase Docker images are deliberately not cached: GitHub's image-layer save/restore is routinely slower than a fresh pull. Revisit if `database` or `e2e` exceeds 10 minutes.

### 5.8 Playwright smoke selection

Membership criterion for the per-PR smoke set: the spec covers a route reachable before login or during first-run onboarding, or the core menu read/write path, **and** it depends on no third-party service.

Per-PR smoke set (four specs):

- `tests/e2e/auth-redirect.spec.ts` — unauthenticated routing.
- `tests/e2e/onboarding.spec.ts` — signup through first organisation/restaurant.
- `tests/e2e/menu-management.spec.ts` — core authenticated CRUD.
- `tests/e2e/public-menu.spec.ts` — public read path, the most customer-visible surface.

Full suite (all nine specs, adding `admin-panel`, `branding`, `menu-delete`, `sub-categories`, `subscription-invalid-menu`) runs on `push` to `main` and on `workflow_dispatch`, selected with an expression on the spec list rather than a second workflow file.

Application under test: `pnpm build` then `pnpm start` (production server on port 3000), **not** `pnpm dev` — it matches Vercel and avoids dev-server compile timing flakiness. Readiness is a poll on `http://localhost:3000/api/health` until it returns 200, capped at 60 seconds, before Playwright starts. `PLAYWRIGHT_BASE_URL` is left at its default.

`playwright.config.ts` already supplies `retries: 2` and `workers: 1` under `CI`; no change is needed. On failure, upload `playwright-report/` and `test-results/` as artifacts with 7-day retention.

### 5.9 Failure policy

- Every job carries `timeout-minutes` (section 5.2). A hang is a failure, never an hour of runner time.
- No `continue-on-error` anywhere. A job that is not trustworthy enough to block is removed from the required set by explicit decision, not softened in place.
- Flake handling: if a job fails, then passes on re-run with no code change, open an issue referencing the run URL. Two such events for the same spec quarantine it out of the smoke set (moved to the `main`-only full suite) until fixed. Silent retries beyond Playwright's existing two are not added.

### 5.10 Required checks

After the workflow is green on `main`, a repository admin sets these as required status checks on `main` in branch protection, with "require branches to be up to date before merging" enabled:

`lint`, `typecheck`, `unit`, `build`, `database`, `e2e`

The agent cannot and does not change repository settings. `P0-E2c` documents the list in `DEPLOYMENT.md` and records the enablement as a human step with the repository owner as owner.

### 5.11 Diagnostics

In the `database` and `e2e` jobs, an `if: failure()` step dumps container state so a red run is diagnosable without a re-run:

```bash
docker ps -a
docker logs --tail 200 supabase_db_hungr || true
docker logs --tail 200 supabase_auth_hungr || true
docker logs --tail 200 supabase_storage_hungr || true
```

Container names follow `supabase_<service>_<project-id>`; the exact `project_id` is read from `supabase/config.toml` during implementation rather than assumed.

## 6. Affected files

New:

- `.github/workflows/ci.yml`
- `.github/actions/setup/action.yml`
- `.nvmrc`

Modified:

- `vitest.config.ts` — third `rls` project; `node` loses the RLS glob (section 5.6).
- `package.json` — `test:ci`, `test:rls` scripts.
- `scripts/env-preset.ts` — comment recording that the `.env.example` fallback is a CI contract (no behaviour change).
- `DEPLOYMENT.md` — required checks, what CI does and does not do, and that hosted migrations stay manual.
- `README.md` — "reproduce CI locally" command list.
- `docs/ROADMAP_STATE.md` — status and session log.

Not modified: application code, migrations, `playwright.config.ts`, `db/seed.ts`, `scripts/bootstrap-db.ts`, `scripts/check-schema-drift.ts`, `scripts/smoke-test-db.ts`. If CI needs any of those changed, that is a finding about the script, not about CI, and gets its own checklist ID.

## 7. Verification

Each implementation task has two verification halves. Both are required before `[x]`.

### 7.1 Local equivalence (agent-runnable)

Every command the workflow runs must pass on a workstation first:

```
pnpm install --frozen-lockfile
pnpm lint
pnpm exec tsc --noEmit
pnpm test:ci                      # must pass with no .env.local present
pnpm test:rls                     # must fail clearly with no database, pass with one
pnpm build                        # with the section 5.4 placeholders only
pnpm db:bootstrap
pnpm env:local
git diff --exit-code lib/database.types.ts
pnpm db:check
pnpm db:smoke
pnpm exec playwright test tests/e2e/auth-redirect.spec.ts tests/e2e/onboarding.spec.ts tests/e2e/menu-management.spec.ts tests/e2e/public-menu.spec.ts
```

Additionally, for `P0-E2a`: prove the split by running `pnpm test:ci` with `.env.local` deleted (or renamed) — it must pass, which is the exact condition the `unit` job runs under.

The `.env.example`-only path of `pnpm env:local` must be proven by temporarily moving both `.env.local-db` and `.env.remote-db` aside, running `pnpm env:local`, and confirming the generated file points at the local stack — that is the CI code path, and it is not otherwise exercised on a developer machine.

### 7.2 Remote proof (requires a push — human step)

A workflow cannot be proven green without running on GitHub. `act` is not a substitute: Docker-in-Docker makes the Supabase stack unreliable under it.

Therefore each of `P0-E2a`, `P0-E2b`, `P0-E2c` ends its agent-side work at "local equivalence passes, workflow written", and then requires the repository owner to push the branch and open a pull request so the run executes. Until a green run URL is recorded, the task stays `[-]` with `Progress: awaiting green Actions run <branch>`, not `[x]`. The agent does not push; per the roadmap execution rules, committing and pushing happen only on explicit user request.

Record in the session log, per task: the run URL, the job names, and their durations.

## 8. Success criteria

1. A pull request from a fresh clone gets six job results with no repository secrets configured.
2. `unit` passes on a runner that never starts Docker.
3. `database` builds the database from an empty volume, and `pnpm db:check`, `git diff --exit-code lib/database.types.ts`, `pnpm db:smoke`, and `pnpm test:rls` all pass in that job.
4. Deleting a required object from the baseline migration (for example the `help-media` bucket) turns the `database` job red — verified once, deliberately, on a throwaway branch.
5. `build` completes with placeholder env only and no database reachable.
6. `e2e` runs the four smoke specs against `pnpm start` and uploads a report on failure.
7. Every job carries a timeout, and no job uses `continue-on-error`.
8. `DEPLOYMENT.md` lists the required checks, and the repository owner has enabled them on `main`.
9. Total PR wall time is under 15 minutes on a warm cache.

## 9. Decisions

Recommended defaults, for confirmation by the accepting engineer (section 11).

| # | Decision | Recommendation | Rationale |
|---|---|---|---|
| D1 | CI provider | GitHub Actions, one `ci.yml` | Repository is on GitHub; no new vendor, no new secret store |
| D2 | Triggers | `pull_request` (all), `push: [main]`, `workflow_dispatch`; cancel-in-progress on PRs only | Full fork PR coverage; complete `main` history |
| D3 | Node version | `.nvmrc` = `22`, consumed via `node-version-file` | Mirrors the Vercel production runtime. **Confirm the current Vercel project runtime during `P0-E2a` and pin `.nvmrc` to whatever it actually is** — the value matters more than the number |
| D4 | pnpm provisioning | `corepack enable` + `packageManager` | Exact version parity with workstations, one fewer third-party action |
| D5 | Secrets | None, anywhere | Fork PRs keep full CI; no leak surface; forces the local-stack design that is more valuable anyway |
| D6 | Database in CI | Local stack via `pnpm db:bootstrap` | Re-proves the `P0-E1` clean-bootstrap guarantee on every run |
| D7 | Vitest split | Third `rls` project; `test:ci` / `test:rls` scripts; `pnpm test` unchanged | Unblocks a Docker-free unit job without changing local habits |
| D8 | Build env | Committed placeholders, no database | Verified working (section 1.3); keeps the fastest signal off the slowest dependency |
| D9 | E2E server | `pnpm build` + `pnpm start`, health-poll readiness | Production parity; avoids dev-compile flake |
| D10 | E2E scope per PR | Four smoke specs; all nine on `main` and dispatch | Keeps PR wall time under the section 8.9 target while `main` stays fully covered |
| D11 | Docker image caching | Not cached; revisit above 10-minute job time | GitHub layer save/restore is typically slower than the pull |
| D12 | Hosted schema diff in CI | Excluded | Would require an access token, and the bare `--linked` form is already known unreliable |
| D13 | Required checks | All six; enabled by a repository admin, documented in `DEPLOYMENT.md` | Agent cannot change repository settings |

No open product decisions. Every item above is an engineering call.

## 10. Checklist impact

- `P0-E2a` additionally covers the section 5.6 Vitest project split and `.nvmrc`; without it the `unit` job cannot exist. No new child ID is needed — it is inside the task's stated scope ("lint, `tsc --noEmit`, unit/component, and production-build jobs").
- `P0-E2b` additionally covers the `git diff --exit-code lib/database.types.ts` drift gate and the `scripts/env-preset.ts` contract comment.
- `P0-E2c` additionally covers the required-checks documentation and the human enablement step, which lands as an `Awaiting:` note on the repository owner if branch protection is not enabled in the same session.
- All three tasks inherit the section 7.2 constraint: they cannot reach `[x]` in a session that does not include a green Actions run, and the agent does not push. Expect each to end `[-]` pending a run URL unless the user pushes during the session.

## 11. Acceptance

Required: engineering (feasibility, safety, cost). No product, security, legal, or vendor gate applies — the workflow introduces no user-visible behaviour, no data processing, no third-party account, and no secret.

- Engineering: **accepted by Kyle-Ben (kb@paperjetstudios.co.za), 2026-07-24** — decisions D1–D13 confirmed as recommended, including D3's `.nvmrc` pin of `22`.

D3 carried a "confirm against the live Vercel project runtime" caveat. Acceptance closed it at the recommended value; the Vercel project's Node setting was **not** read (no Vercel access from this environment). If that project is set to a different major, change `.nvmrc` and re-run CI — nothing else in this design depends on the number.
