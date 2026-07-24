# P0-E1 Design: Reproducible database bootstrap and migration-history repair

- **Roadmap item:** `P0-E1-design` (`docs/ROADMAP_STATE.md`); roadmap sections 3, 15 (priority design queue #1), and Phase 0 engineering prerequisites.
- **Status:** ACCEPTED 2026-07-24 (engineering). Option A, defaults. Implementation may start at `P0-E1a`.
- **Author:** drafted 2026-07-24.
- **Blocks:** `P0-E1a`, `P0-E1b`, `P0-E1c`, `P0-E2-design`, `P0-E2b`, and therefore `P0-exit`.

## 1. Context

### 1.1 Verified current state

Every claim below was checked against the repository and the linked hosted project on 2026-07-24, not inherited from prior documentation.

| Fact | Evidence |
|---|---|
| Hosted project `bvkiqrgkommynhdvsdut`, Postgres 17.6.1, `ACTIVE_HEALTHY`, region `eu-central-1` | `supabase projects list` |
| Migration ledger is **fully in sync** — 14 local files, 14 remote rows, identical versions, no orphans in either direction | `supabase migration list --linked` |
| `supabase/schemas/baseline.sql` is a 76.7 KB pg_dump-style snapshot: 30 tables, 13 functions, 71 policies, 38 indexes, 1 trigger, 137 grants, 0 views | static scan of the file |
| The baseline is **strictly `public`-schema only**: 0 references to `storage.`, 0 `storage.objects` policies, 0 bucket rows. Its only 4 `auth.` references are `auth.uid()` calls inside policy bodies | `grep -c 'storage\.'` → 0; `grep -c 'ON "storage"."objects"'` → 0 |
| The baseline is **not wired into any tooling**: `supabase/config.toml` has no `[db.migrations]` (`schema_paths`) and no `[db.seed]` (`sql_paths`) section | `grep` over `config.toml` |
| There is no `supabase/seed.sql`; seeding is `db/seed.ts` invoked manually via `pnpm db:seed`, outside `supabase db reset` | directory listing, `package.json` |
| The earliest migration `20260615110000` opens with `alter table branding add column ...`, so migrations alone cannot initialize an empty database | file head |

### 1.2 The baseline's exact cut point

The roadmap and `README.md` both assert that replaying all migrations over the baseline is unsafe "because the snapshot already contains some migrated state," but neither states *where* the snapshot sits. This design fixes that boundary, because every repair strategy depends on it.

Probing the baseline for each migration's distinguishing object:

| Migration | Distinguishing object | In baseline? |
|---|---|---|
| `20260615110000` banner + team invite | `banner_image_urls` | yes |
| `20260624120000` invite org context | invitation org columns | yes |
| `20260624130000` help articles | `help_categories` / `help_articles` + policies | yes |
| `20260624130001` help media storage | `help-media` bucket, `storage.objects` policies | **no** (non-public) |
| `20260629100000` profile phone | `profiles.phone` | yes |
| `20260629120000` help media table | `help_media` table + policy | yes |
| `20260630120000` `is_super_admin` security definer | `SECURITY DEFINER` on `public.is_super_admin()` | yes (confirmed at baseline line 323) |
| `20260630130000` restaurant storage limit | `restaurants.storage_limit_mb` | yes |
| `20260713120000` delete restaurant cascade | `delete_restaurant*` function | **no** |
| `20260714123202` superseded status | `superseded` | **no** |
| `20260714150000` restore non-public objects | auth trigger, buckets | **no** (non-public) |
| `20260714170000` staff scope choice | `organization_members.restaurant_scoped` | **no** |
| `20260714170001` help articles not null | — | **no** |
| `20260717120000` pending subscriptions index | — | **no** |

**Conclusion: the baseline represents the `public` schema exactly as of `20260630130000`.** Eight migrations precede or equal that point; six follow it.

### 1.3 Why replaying over the baseline actually fails

The failure is concrete, not theoretical. Postgres has no `CREATE POLICY IF NOT EXISTS`, and two of the eight pre-cut migrations create policies unguarded:

- `20260624130000_help_articles.sql` line 30 — `create policy "help_categories public read" ...`. That exact policy name is already present in the baseline.
- `20260629120000_help_media_table.sql` line 26 — `create policy "help_media super admin all" ...`, likewise already present.

Replaying either against a baseline-loaded database aborts with `ERROR: policy "..." already exists`. By contrast the storage migrations *are* idempotent (`on conflict (id) do nothing`, `drop policy if exists` before each `create policy`), and `alter table ... enable row level security` is a no-op when already enabled. Most other flagged `insert`/`update` statements are function *bodies* inside `create or replace function`, not migration-time DDL.

So the unsafety is narrow and identifiable — but real, and it lands on the first fresh-bootstrap attempt.

### 1.4 The non-public gap that a naive squash would silently open

`supabase/schemas/baseline.sql` contains no non-public objects at all. Everything outside `public` is created by exactly two migrations:

- `20260624130001_help_media_storage.sql` — the `help-media` bucket and its four `storage.objects` policies. **This file is the sole source of those objects.**
- `20260714150000_restore_non_public_schema_objects.sql` — the `auth.users` profile-provisioning trigger, the one-time `review_stats` materialized-view population, the `menu-media` / `branding` / `invoices` / `private` buckets, and roughly sixteen storage policies.

Critically, `20260714150000` does **not** re-create `help-media`. Its bucket list is `menu-media`, `branding`, `invoices`, `private` only.

**Therefore: any strategy that discards the eight pre-cut migration files without first folding `20260624130001` into the new baseline will silently break help-article image upload on every freshly created database**, while the hosted project — which already has the bucket — continues to look healthy. This is the single highest-risk detail in the whole item and the main reason a hand-rolled squash is unsafe.

Two further landmines in the same area, both already documented inside `20260714150000` and both of which must survive into any new baseline:

1. `review_stats` is created `WITH NO DATA`, but the `reviews_after_change` trigger refreshes it `CONCURRENTLY`, which errors on an unpopulated matview — breaking every write that touches `reviews`.
2. Without the `auth.users` trigger, signups create no `profiles` row, so every insert referencing `profiles` fails.

### 1.5 Restating the problem

There is nothing wrong with the migration *ledger*. The roadmap's framing — "migration-history repair/squash" — should be read as: the ledger is consistent, but **the repository cannot construct the schema that ledger describes.** The defect is a missing, registered, authoritative starting point, not corruption.

## 2. Goal

One documented command must build a complete, correct Hungr database from empty — `public` schema, non-public Auth/Storage objects, and optional seed data — with the hosted project's ledger left consistent with the repository and its schema untouched.

## 3. Exclusions

Out of scope for `P0-E1`:

- CI wiring (`P0-E2`), which consumes this bootstrap but is designed separately.
- Any schema *change*. This item is schema-preserving; the resulting database must be byte-for-byte equivalent in structure to today's hosted schema.
- Seed *content* redesign. `db/seed.ts` is reused as-is; only its invocation is standardized.
- Production data migration, backup policy, or PITR configuration.
- Provisioning a second hosted project. The bootstrap must *make that possible*, but doing it is a separate operational task.

## 4. Options considered

| Option | Description | Verdict |
|---|---|---|
| **A. Full squash** | Regenerate one authoritative baseline migration from the live hosted schema, delete the 14 existing files, repair the hosted ledger to reference only the new file. | **Recommended.** |
| B. Register baseline at its cut point | Move the snapshot to `20260630130001_baseline.sql`, delete the 8 pre-cut files, repair those 8 to `reverted`, keep the 6 later deltas. | Viable, but leaves the `help-media` gap to be patched by hand and preserves a confusing two-era history for no benefit. |
| C. Non-destructive bootstrap script | Leave history untouched; add a script that applies the baseline then only post-cut migrations. | Rejected: institutionalizes two sources of truth and keeps `supabase db reset` broken, which is what `P0-E2b` needs. |
| D. Declarative schemas | Adopt `[db.migrations] schema_paths` and generate migrations by diffing. | Rejected for now: a workflow change of much larger blast radius, and it conflicts with the established "baseline is documentation-only" convention. Reconsider post-Phase 0. |

### 4.1 Why Option A is safe here

Squashing is normally avoided because it rewrites history other environments depend on. That objection does not apply:

- The hosted project is **pre-launch** with no external users; the product owner confirmed on 2026-07-24 that destructive migration work against it is acceptable.
- `bvkiqrgkommynhdvsdut` is the **only** deployed environment. There is no second consumer of the ledger to desynchronize.
- Crucially, `supabase migration repair` **only edits rows in `supabase_migrations.schema_migrations`. It never executes DDL and never alters the schema.** The hosted database's structure and data are untouched throughout; only the ledger's account of how it got there changes. This is the property that makes the operation reversible and low-risk.
- The 14 existing files remain in Git history permanently, so nothing is lost.

## 5. Design

### 5.1 Target repository shape

```
supabase/
  migrations/
    20260717120001_baseline.sql     # single authoritative starting point
  schemas/
    baseline.sql                    # regenerated, documentation-only (see 5.6)
  seed.sql                          # optional; see 5.5
```

The baseline migration is timestamped **immediately after the newest existing migration** (`20260717120000` → `20260717120001`) rather than before the oldest. This matters: a later timestamp means any future migration sorts after it naturally, and the local ordering never depends on the repaired ledger being interpreted in a particular way.

### 5.2 Baseline migration contents, in order

1. **`public` schema DDL** — generated by `supabase db dump --linked`, not hand-edited. Covers tables, columns, constraints, indexes, functions, triggers, views, RLS enablement, policies, and grants.
2. **Non-public objects** — carried over verbatim from the existing, already-production-verified sources, preserving their guard style so the file stays re-runnable:
   - the `auth.users` profile-provisioning trigger, guarded by function identity (from `20260714150000` §1);
   - the `review_stats` conditional population (from `20260714150000` §2);
   - **all five** buckets — `menu-media`, `branding`, `invoices`, `private` (from `20260714150000` §3) **and `help-media` (from `20260624130001`)** — via `insert ... on conflict (id) do nothing`;
   - **all** storage policies for those five buckets, each preceded by `drop policy if exists` (from `20260714150000` §4 **and `20260624130001`**).

The explicit inclusion of `help-media` in both sub-steps is the mitigation for §1.4 and must be verified by test, not by reading.

Do **not** dump the `auth` or `storage` schemas wholesale. Those schemas are Supabase-managed; their definitions differ across platform versions, and reproducing them would conflict with a fresh project's own managed objects. Only Hungr's objects *inside* them are carried.

### 5.3 Idempotency and transaction scope

The Supabase CLI applies each migration file inside a single transaction, so a mid-file failure rolls the whole file back — there is no partial-baseline state to recover from. The `public` DDL section is not required to be re-runnable (it only ever runs against an empty database), but every non-public statement retains its existing guard so that re-running the file against an already-provisioned database is a no-op. That property is what lets the same file serve both fresh local databases and a future second hosted project.

### 5.4 Hosted ledger repair

Executed once, against the linked project, in this order:

1. Confirm no schema drift exists *before* touching anything: `supabase db diff --linked` must report no differences. If it does not, stop — the drift is a separate finding and must get its own checklist ID.
2. Mark the 14 superseded versions as reverted: `supabase migration repair --status reverted <version>` for each.
3. Mark the new baseline as applied without running it: `supabase migration repair --status applied 20260717120001`.
4. Re-verify: `supabase migration list --linked` shows exactly one row on both sides, and `supabase db diff --linked` still reports no differences.

Step 4 is the acceptance gate for the operation. If `db diff` reports differences after the repair that it did not report before, the baseline dump is incomplete and must be regenerated — the hosted schema itself will not have changed, because no DDL ran.

### 5.5 Seeding

`supabase db reset` automatically runs `supabase/seed.sql` when `[db.seed]` is enabled. Two acceptable shapes; the implementer picks one and records it:

- **Preferred:** keep `db/seed.ts` as the single seed implementation (it already handles Auth user creation, which raw SQL cannot do cleanly) and have the bootstrap command invoke it as an explicit second step.
- Alternative: add a thin `supabase/seed.sql` for reference rows only, leaving Auth-dependent seeding in `db/seed.ts`.

Either way seeding must be **conditional and idempotent** — running the bootstrap twice must not duplicate rows — and must never run against the hosted project by default.

### 5.6 Fate of `supabase/schemas/baseline.sql`

The convention "the baseline is documentation-only, never a migration substitute" (stated in `AGENTS.md`-adjacent skills, `README.md`, and `DEPLOYMENT.md`) is **retained**. After the squash, the snapshot is regenerated from the same dump so it once again reflects reality, and its documentation-only status is unchanged. What changes is that it is no longer the *hidden prerequisite* for a working database — the migration is. Reviewers keep using it to see the starting state at a glance.

### 5.7 Authorization, tenancy, and privileged operations

This item introduces no new tables, policies, grants, or roles, so there is no new tenant boundary and no role-matrix change. Two obligations follow from that, both verifiable:

- The regenerated baseline must preserve **every** existing grant and policy exactly. Newer Supabase projects do not automatically expose SQL-created tables to Data API roles, so a dropped `GRANT` would produce a database that passes schema comparison but fails at runtime. The 137 grants and 71 public policies are a checkable count.
- The `auth.users` trigger and all `security definer` functions must retain their locked `search_path` (`public, pg_temp`).

Operationally, the repair requires a Supabase personal access token and linked-project rights. It is performed by the engineer running the item, once, and is not automated in CI.

### 5.8 Failure recovery and rollback

| Failure | Detection | Recovery |
|---|---|---|
| Baseline dump incomplete | `supabase db diff --linked` after repair reports differences | Regenerate the dump and repeat §5.4 step 3. Hosted schema was never modified. |
| Ledger repair partially applied | `supabase migration list --linked` shows a mixed ledger | Re-run the remaining `repair` commands; the operation is idempotent per version. |
| Wrong decision entirely | — | `git revert` the commit and repair the 14 original versions back to `applied`. The hosted schema never changed, so no data restore is involved. |
| Fresh `db reset` succeeds but app fails | Signup or upload smoke test fails | Almost certainly a missing non-public object (§1.4). Fix the baseline's non-public section; no hosted action needed. |

There is deliberately no rollback procedure involving data restore, because no step in this design executes DDL or DML against hosted.

## 6. Affected files

- `supabase/migrations/*` — 14 files deleted, `20260717120001_baseline.sql` added.
- `supabase/schemas/baseline.sql` — regenerated.
- `supabase/config.toml` — `[db.seed]` section if §5.5 alternative is chosen.
- `package.json` — one bootstrap script (e.g. `db:bootstrap`) composing reset + seed + type generation.
- `README.md` — replace the `P0-E1` block gate (line 11) and rewrite "Database baseline and migrations" (line 68).
- `DEPLOYMENT.md` — remove the bootstrap gate (line 7) and the "cannot provision a new project" warning (line 41).
- `docs/ROADMAP_STATE.md` — status updates.
- `scripts/check-schema-drift.ts` — its header comment describing untracked base-schema versions becomes obsolete once the ledger has a single tracked baseline.

No application routes, server actions, or components change, so there is no cache-revalidation surface and no UI test impact.

## 7. Verification

Exact commands, to be run by `P0-E1c`. On this Windows workstation, run `corepack enable pnpm` first.

**Pre-flight (before any change):**
```
pnpm exec supabase migration list --linked      # expect 14 = 14
pnpm exec supabase db diff --linked             # expect no differences
```

**Fresh-database proof (the actual acceptance test):**
```
pnpm exec supabase stop --no-backup             # discard any existing local volume
pnpm exec supabase start
pnpm exec supabase db reset                     # must succeed from genuinely empty
pnpm db:seed
pnpm db:gen-types                               # lib/database.types.ts must be unchanged
git diff --exit-code lib/database.types.ts
pnpm db:check
```

`supabase stop --no-backup` is not optional — reusing an initialized volume is exactly how the current broken state stayed hidden, since `README.md` line 11 admits the documented sequence "requires an existing initialized local Supabase volume."

**Equivalence proof:**
```
pnpm exec supabase db diff --from migrations --to linked    # expect no differences
```
This is the strongest available check that the squashed baseline reconstructs the hosted schema exactly.

**Runtime smoke tests** (catch the non-public gaps in §1.4, which no schema diff detects):

1. Sign up a new user against the fresh local database → a `profiles` row must be created (proves the `auth.users` trigger).
2. Submit a review → must not error (proves `review_stats` is populated).
3. Upload menu media → proves `menu-media` bucket + policies.
4. **Upload a help-article image as a super admin → proves the `help-media` bucket survived the squash.** This test exists specifically because §1.4 is otherwise invisible.
5. Download an invoice → proves `invoices` bucket policies.

**Regression suite:**
```
pnpm exec vitest run
pnpm exec vitest run tests/rls        # local Supabase only; RLS_ALLOW_REMOTE stays 0
pnpm lint
pnpm exec tsc --noEmit
pnpm build
```

RLS tests mutate users and must target local Supabase — they are the reason a working local bootstrap is a prerequisite for `P0-E2b`.

## 8. Success criteria

1. A single documented command produces a complete, correct database from empty, verified on a machine with no pre-existing Supabase volume.
2. `supabase db diff --from migrations --to linked` reports no differences.
3. `supabase migration list --linked` shows one migration, matched on both sides.
4. `pnpm db:gen-types` against the fresh database produces no diff in `lib/database.types.ts`.
5. All five storage buckets, the `auth.users` trigger, and a populated `review_stats` exist on the fresh database, each proven by a runtime smoke test rather than inspection.
6. Grant and policy counts on the fresh database match hosted.
7. `README.md` and `DEPLOYMENT.md` no longer carry a `P0-E1` bootstrap gate.
8. The hosted project's schema and data are provably unmodified throughout.

## 9. Decisions (closed 2026-07-24)

All four were accepted at their recommended defaults. They are settled; implementation follows them without re-litigation.

1. **Seed shape** — `db/seed.ts` stays the single seed implementation, invoked as an explicit second step of the bootstrap command. No `supabase/seed.sql`, so no `[db.seed]` section is added to `config.toml`.
2. **Baseline timestamp** — `20260717120001`, sorting immediately after the newest superseded migration.
3. **Squash versus cut-point registration** — **Option A, full squash**, on the strength of §4.1.
4. **`supabase/schemas/baseline.sql` retention** — regenerated from the same dump and retained as documentation-only (§5.6).

## 10. Checklist impact

The existing children map onto this design without renumbering:

- `P0-E1a` — generate the baseline migration (§5.2), delete superseded files, repair the hosted ledger (§5.4).
- `P0-E1b` — add the single bootstrap command and seed wiring (§5.5).
- `P0-E1c` — run §7 end-to-end from an empty environment and update `README.md` / `DEPLOYMENT.md`.

`P0-E1a`'s scope is now explicitly larger than its one-line description implied: it must fold `20260624130001`'s `help-media` objects into the baseline, not merely dump `public`.

## 11. Acceptance

Per roadmap section 15, design acceptance is explicit and human. Technical completeness of this draft was established by the agent; acceptance below was given by the human owner.

| Role | Owner | Date | Status |
|---|---|---|---|
| Engineering (feasibility, safety) | Kyle-Ben (kb@paperjetstudios.co.za) | 2026-07-24 | **ACCEPTED** — Option A, all §9 defaults |

Product acceptance is not required: this item changes no product behaviour. Security acceptance is not required: no schema, grant, policy, or role changes are introduced — a property that must be re-checked if the implementer deviates from §5.7.

Scope of this acceptance: the strategy in §5 and the decisions in §9. It does not pre-approve deviation. If `P0-E1a` finds that the baseline dump cannot reproduce the hosted schema without a schema change, that is a new finding requiring its own checklist ID and a fresh acceptance.
