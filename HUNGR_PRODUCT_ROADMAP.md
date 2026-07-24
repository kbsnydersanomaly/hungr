# Hungr Product Roadmap: Platform Improvements and Order & Pay

**Status:** Reviewed implementation roadmap; external gates remain open

**Created:** 2026-07-22

**Technical baseline:** Next.js 16.2.4, React 19.2.4, Supabase, PayFast subscription billing

## 1. Purpose

This document turns the requested improvements and Order & Pay programme into an implementation roadmap grounded in the current Hungr codebase.

It covers:

- Restaurant operating days, operating hours, and optional seat capacity.
- Functional dashboard notifications, starting with new-review notifications.
- Protection against accidentally discarding menu-item edits.
- CSV compatibility investigation and first-class XLSX import/export.
- Simpler specials ordering through drag-and-drop list order.
- Feature controls for a staged Order & Pay launch.
- Patron accounts, table QR sessions, carts, ordering, payments, split payments, history, and profile controls.
- Restaurateur live orders, kitchen flow, sales analytics, CRM, marketing, loyalty, discounts, and transactional messages.
- Pilot POS integration after patron and restaurant workflows are stable and credentials are available.
- Testing, security, POPIA, observability, rollout, and operational support.

This is a roadmap and architecture specification, not a fixed commercial commitment. Payments, POPIA, Pilot, and messaging require vendor and legal validation before production launch.

## 2. Executive Recommendation

Run two coordinated tracks:

1. **Platform improvements:** deliver restaurant details, review notifications, unsaved-change protection, spreadsheet compatibility, and specials ordering first. These are bounded changes with immediate customer value.
2. **Order & Pay programme:** build a new commerce bounded context behind centrally enforced feature controls. Do not extend subscription billing tables or treat existing menu JSON as a complete ordering model.

Recommended Order & Pay launch sequence:

1. Resolve commercial, payment, legal, and Pilot questions.
2. Build feature controls, domain events, patron identity, consent, and private integration configuration.
3. Launch a no-payment ordering pilot with table QR sessions and live restaurant order management.
4. Add one-provider, one-payer online payment.
5. Add amount-based split payment after concurrency and refund rules are proven.
6. Add sales analytics and basic CRM.
7. Add promotions, loyalty, and consented campaigns.
8. Integrate Pilot last through a provider adapter and replayable outbox.

Order & Pay should initially be unavailable to all production organisations. Super admins explicitly grant pilot access organisation by organisation.

## 3. Current-System Findings

Planning must account for these existing behaviours:

- `restaurants` currently stores address, `table_count`, and general metadata. It has no structured operating schedule, timezone, or seat-capacity field.
- `about_pages.business_hours` is free text. It should not become the authoritative ordering-hours source.
- `notifications` already supports per-user inbox rows and read timestamps, but current top-bar behaviour only lists unread rows, does not mark rows read, has no timeline page, and routes notification clicks to preferences.
- Review submission emails eligible managers but does not create in-app notifications.
- Billing actions produce notification types not recognised by the bell formatter.
- `ItemEditSheet` holds local form state but has no opening snapshot or guarded close path. Overlay, Escape, close button, and Cancel can discard changes.
- CSV and Excel uploads already parse `.csv`, `.xlsx`, and `.xls`. Downloads are CSV only.
- CSV exports are comma-delimited UTF-8 without an explicit BOM. Parser errors are not surfaced. Existing list-valued cells use semicolons internally.
- Bulk replace is not transactional: deleting current items can succeed before new rows fail.
- Specials use a manual numeric `priority`. Dashboard and public queries sort descending, with no deterministic tie-breaker or reorder action.
- `plans.features` can hold commercial entitlements, but `hasFeature()` is currently unused by product routes and actions.
- `platform_settings` provides one global public-menu toggle. Its current helper fails open, which is unsuitable for commerce.
- PayFast integration currently handles Hungr subscription billing. Patron order payments need separate tables, provider configuration, webhook processing, reconciliation, and accounting.
- Every new Supabase-exposed table needs explicit grants and RLS validation. Newer Supabase projects may not expose SQL-created tables to Data API roles automatically.
- Current auth trigger creates an organisation for each new user. Patron sign-up cannot reuse this behaviour unchanged.
- Current account deletion removes organisations owned by the user. Patron-profile closure must be separated from full Auth-user deletion before one identity can be both patron and operator.
- Current subscription webhook idempotency is a check-then-insert flow whose failed duplicate insert does not stop later side effects. Existing billing must be hardened before adding patron payments.
- Public review insertion relies on application validation and a race-prone duplicate check. Direct API access can bypass item/restaurant ownership validation.
- The repository cannot recreate a fresh database from migrations alone: the documentation baseline must be applied first. Clean, automated bootstrap and CI are engineering prerequisites.
- Outbox delivery, notification retention, payment reconciliation, and POS delivery require a durable worker/queue runtime that has not yet been selected.

## 4. Product and Engineering Principles

### 4.1 Tenant isolation

- Every restaurant-owned commerce row must carry `restaurant_id`; organisation-level records must carry `org_id` where useful for policy and reporting.
- Patrons must never see other patrons' orders or payment details.
- Restaurant users must never see patrons, orders, consents, or analytics outside authorised restaurants.
- Service-role operations require explicit application authorization before privileged access.
- RLS remains primary database defence; server checks provide explicit application-level authorization.
- Where both `org_id` and `restaurant_id` are stored, a database constraint must prove that the restaurant belongs to that organisation. Never trust two independently supplied tenant identifiers.

### 4.2 Server-authoritative commerce

- Client cart values are proposals, never authoritative prices.
- Server calculates item, modifier, discount, tax, fee, tip, and total amounts using integer cents.
- Submitted orders store immutable names, prices, modifier selections, tax values, and promotion snapshots.
- Later menu edits must not rewrite historical order facts.

### 4.3 Separate state machines

Do not use one combined status for ordering, payment, and POS delivery.

- Fulfilment status describes restaurant workflow.
- Payment status describes money movement.
- POS delivery status describes integration delivery.
- Table-session status describes current dining session.

This avoids impossible combined states and makes retries/reconciliation manageable.

### 4.4 Idempotent external effects

- Every provider event, callback, email, SMS, notification, POS push, loyalty award, and coupon redemption needs a stable idempotency key.
- Persist business changes and outbox work in one transaction.
- Process external effects asynchronously with retries and dead-letter visibility.
- Realtime accelerates UI updates; database remains source of truth.

### 4.5 Safe feature disabling

Disabling Order & Pay stops new carts, orders, and payment attempts. It must not block:

- Open-order fulfilment.
- Provider webhook processing.
- Refunds and reconciliation.
- Order history and receipts.
- POPIA access, correction, consent withdrawal, or deletion requests.
- Super-admin support and exports.

## 5. Track A: Platform Improvements

### 5.1 Restaurant operating information

#### Product behaviour

Restaurant settings gain:

- Timezone, defaulting to `Africa/Johannesburg` for current South African restaurants.
- Open/closed toggle for each weekday.
- One or more service intervals per open day, such as `09:00-14:00` and `17:00-22:00`.
- Optional seat capacity.
- Later: date-specific closures, public holidays, and exceptional hours.

Operating days derive from schedule rows. Do not store a second, independent days array that can drift from hours.

`seat_capacity` means total customer seats and remains informational in this scope. It is separate from existing `table_count` and future table-level capacities.

DECIDED (2026-07-22, decision 1): the client intends reservations/live availability later, so this field is a bookings foundation, not a dead-end label. Consequences now: keep `seat_capacity` a plain integer with no availability semantics; per-table capacity lives on `restaurant_tables.capacity`; any future bookings feature is its own bounded context that reads these fields and layers time slots on the structured operating schedule (5.1) - none of which changes this phase's build, only forbids shortcuts that would overload these columns.

#### Recommended data model

- Add `restaurants.timezone text not null default 'Africa/Johannesburg'`.
- Add `restaurants.seat_capacity integer null` with a non-negative check.
- Add `restaurant_operating_intervals`:
  - `id uuid`
  - `restaurant_id uuid`
  - `day_of_week smallint` constrained to `0..6`
  - `opens_at time`
  - `closes_at time`
  - `sort_order integer`
  - timestamps
- Add `restaurant_schedule_exceptions` only when Order & Pay starts enforcing availability:
  - `restaurant_id`
  - `service_date`
  - `closed`
  - optional replacement intervals
  - note/reason

Multiple rows support split service. Overnight intervals require explicit tested semantics: `closes_at <= opens_at` means next day.

#### UI and migration

- Add fields to create flow only if onboarding simplicity remains acceptable; otherwise collect them in restaurant settings and onboarding checklist.
- Replace or derive public `about_pages.business_hours` display from structured data. Preserve legacy text until migrated.
- Public About page displays structured schedule and seat capacity only when set.
- Existing restaurants receive timezone default, no intervals, and null seat capacity. No invented hours.

#### Public "Open now / Closed" indicator

Once structured hours exist, surface them on the public menu and About pages as a live status badge. Same data, immediate visible value.

Behaviour:

- Compute status server-side from `restaurant_operating_intervals` in the restaurant's timezone, never the viewer's device timezone.
- States: `Open now`, `Closes soon` (within a configurable threshold, default 30 minutes), `Closed - opens <next opening>` where next opening resolves across day boundaries and overnight intervals.
- Restaurants with no intervals configured show no badge at all. Never display "Closed" as a side effect of missing data.
- The badge is informational in this scope. It must read from the same source of truth that Order & Pay later uses to enforce ordering hours, so display and enforcement can never disagree.
- Render on the server where cache strategy allows; if the public menu page is cached, either compute on request, pass intervals to a small client component that derives status locally from the restaurant timezone, or accept a documented revalidation window. Choose one and test it around midnight and interval boundaries.
- Schedule exceptions (`restaurant_schedule_exceptions`), once introduced, take precedence over weekly intervals in the same computation path.

Acceptance criteria:

- Badge state is correct for split service (gap between lunch and dinner shows `Closed - opens 17:00`), overnight intervals crossing midnight, and timezone offsets where server timezone differs from restaurant timezone.
- `Closes soon` threshold boundary is covered by unit tests.
- No badge renders when intervals are absent.
- Badge status derivation is a pure, unit-tested function shared by public display and (later) ordering-availability enforcement.

#### Acceptance criteria

- Manager can save closed days, multiple daily intervals, overnight intervals, timezone, and optional seat capacity.
- Invalid overlaps, negative capacity, and missing open/close values fail with useful messages.
- Public display uses restaurant timezone and does not show seat capacity when null.
- Ordering availability later uses same source of truth.
- RLS permits authorised restaurant managers and denies other tenants.

### 5.2 Review notifications and notification timeline

#### Product behaviour

Top-bar bell becomes a functional inbox preview:

- Displays latest notifications, including read/unread visual state.
- Shows accurate unread count.
- Clicking a review notification marks it read and deep-links to that restaurant's review queue or review detail.
- “View all notifications” opens `/notifications`, not notification preferences.
- Preferences remain at `/settings/notifications`.
- Timeline supports pagination, read/unread filter, mark one read, and mark all read.
- Empty state explains that review, payment, and team activity will appear there.

First supported event: `review.submitted`.

#### Recipient rules

Create in-app review notifications for users who can moderate that restaurant:

- Organisation owner, admin, and manager with restaurant access.
- Restaurant manager.
- Deduplicate users who qualify through multiple memberships.

In-app operational notification and email preference are separate. In-app review notifications should remain enabled for authorised managers; `review_emails` controls only email delivery.

#### Event and payload contract

Use stable names, for example:

- `review.submitted`
- `subscription.paused`
- `subscription.cancelled`
- `subscription.resumed`
- `team.invite_accepted` - a user accepted an invitation into the organisation or restaurant.
- `team.member_removed` - a member's access was revoked (notify owners/admins, not the removed user, through this event; the removed user gets a direct communication if product requires it).
- `team.role_changed` - a member's role or restaurant scope changed.
- Future: `order.submitted`, `order.ready`, `payment.failed`, `pos.delivery_failed`.

Team events exist because the timeline empty state promises "review, payment, and team activity". Ship at least `team.invite_accepted` in the same milestone as review notifications so the empty-state copy is honest; the other team events may follow, but the copy must never advertise event types that cannot occur. Team-event recipients are organisation owners and admins, deduplicated the same way as review recipients, and excluding the actor who caused the event.

Review payload should contain presentation snapshot and routing identifiers:

```json
{
  "restaurant_id": "uuid",
  "restaurant_name": "Name",
  "review_id": "uuid",
  "menu_item_id": "uuid",
  "item_name": "Item",
  "rating": 5,
  "customer_name": "Name",
  "path": "/restaurants/.../reviews?review=..."
}
```

Add `event_id` or a unique dedupe key with a database unique constraint so retrying recipient fan-out cannot duplicate rows.

#### Delivery architecture

Short term:

- Add the notification dedupe column/index, timeline keyset index, explicit grants/RLS, and Realtime publication before adding producers.
- Create reviews and their durable event atomically through a database function that validates item/restaurant/public-menu ownership and returns the review ID.
- Revoke unrestricted anonymous review inserts when the function replaces them; add payload limits, rate limits, cross-restaurant tests, and abuse monitoring.
- Fan out recipient inbox rows idempotently. Preserve accepted review success when email fails, but log and alert delivery failure.
- Normalise existing billing notification types and payloads.

Order & Pay foundation:

- Add domain-event/outbox processing.
- Inbox rows, email jobs, and SMS jobs derive idempotently from an event.
- Delivery failure never rolls back accepted business operations.

#### Live badge updates

The bell must update without a full page reload, otherwise "functional notifications" reads as broken the first time a review arrives mid-session.

- Subscribe to Supabase Realtime `INSERT` (and `UPDATE` for read-state sync across tabs) on the current user's `notifications` rows, filtered by `user_id`. Verify the table is in the realtime publication and that RLS constrains the subscription to the user's own rows before enabling.
- On received insert: increment the unread count and prepend to the open dropdown list. Do not trust accumulated client state as authoritative - on dropdown open and on realtime reconnect, refetch the authoritative unread count and latest rows, matching the project rule that realtime invalidates state rather than owning it.
- Fallback: if realtime is unavailable (subscription error, browser restrictions), poll the unread count at a modest interval (60s) and stop polling when the tab is hidden (`visibilitychange`). Either mechanism must coalesce with the other without double counting.
- Clean up the subscription on unmount and on auth/organisation context change.
- Marking read in one tab reconciles the count in other open tabs via the same channel.

Acceptance criteria:

- New notification appears in bell within seconds without reload while tab is active.
- Reconnect after network loss refetches count and rows; no stale or duplicated entries.
- No subscription leaks across sign-out/sign-in or organisation switch.

#### Retention and volume

Notification rows grow unbounded per user once producers exist (reviews now, orders later at much higher volume). Define retention at introduction, not after the table is large:

- Keep a per-user cap and an age cap, whichever prunes more, for example: retain at most 500 rows per user and nothing older than 12 months; read rows older than 90 days are eligible first.
- Prune via a scheduled job (Supabase cron / `pg_cron`) deleting in bounded batches to avoid long locks; never prune synchronously inside request paths.
- Pruning is permanent inbox cleanup, not audit deletion - anything with audit or legal value (billing events, consent changes, financial notifications) must already exist in its own durable audit records and must not rely on the notification inbox as the system of record.
- The timeline page states the retention window in its footer or empty state so users are not surprised.
- Retention values live in configuration, not scattered constants, so Order & Pay volumes can tighten them without a code hunt.
- Use keyset pagination on `(created_at, id)` with an index on `(user_id, created_at desc, id desc)`. Add separate bounded-prune indexes based on the implemented delete predicates.

#### Acceptance criteria

- One review creates one in-app row per eligible recipient despite retries and overlapping roles.
- Email follows `review_emails`; in-app notification does not.
- Bell count decreases after click or mark-all-read.
- Timeline pagination remains stable when new notifications arrive.
- Deep links resolve only for users who still have restaurant access.
- Notification tests cover producer, formatter, count, read state, deep link, empty state, and tenant access.
- Realtime insert updates the badge without reload; reconnect refetches authoritative state.
- Prune job removes only eligible rows and never rows newer than the documented window.

### 5.3 Unsaved menu-item protection

#### Recommended wording

**Title:** `Discard unsaved changes?`

**Body:** `You have unsaved changes to this menu item. If you leave now, your changes will be lost.`

**Actions:** `Keep editing` and `Discard changes`

This is clearer than “Are you sure you want to continue?” because it names the destructive result.

#### Behaviour

- Capture a canonical opening snapshot when sheet opens.
- For new item, dirty means any meaningful field differs from empty initial state.
- For existing item, dirty means any meaningful field differs from persisted opening state.
- Ignore temporary UI state such as autocomplete search text.
- Intercept overlay click, Escape, close icon, Cancel, and parent-driven close.
- Close immediately when clean.
- While save is pending, prevent accidental close.
- After successful save, update/reset snapshot before closing so confirmation does not appear.
- Failed save preserves current fields and dirty state.
- Add `beforeunload` protection while dirty. Route-navigation interception can follow if reliable within current Next.js version.

No draft persistence is required for this improvement. Browser/local draft recovery can be a later enhancement if abandonment data supports it.

Client-communication note: the original report asked for "save as draft". This scope deliberately ships the guard, not drafts - the guard eliminates the reported loss scenario (accidental outside click destroying work) at a fraction of the complexity, with no partially filled items leaking into menus and no draft-cleanup lifecycle. When closing the loop with the client, state explicitly that items cannot yet be saved half-finished for later, and that accidental data loss is what this change removes. If "resume later" remains a real need after the guard ships, scope local draft recovery (sessionStorage snapshot keyed by restaurant + item, restored on next open, cleared on successful save) as its own item.

#### Acceptance criteria

- Editing any persisted field causes close attempts to show confirmation.
- Returning a field to its opening value clears dirty state.
- Clean Cancel closes directly.
- `Keep editing` leaves every value intact.
- `Discard changes` closes and reopening restores persisted values.
- Failed server save remains open and dirty.
- Component tests cover all close sources and create/edit modes.

### 5.4 CSV and XLSX compatibility

#### Finding

XLSX upload support already exists. Reported WPS behaviour likely concerns CSV delimiter interpretation, not missing spreadsheet parsing. Exact WPS Office version, operating-system locale, sample file, and import steps are needed to reproduce it.

Probable root cause, to be confirmed against the partner's actual file and WPS version in Phase 0: WPS Office (like Excel) chooses the CSV field delimiter from the operating-system regional list separator. In locales where the list separator is `;` (much of Europe, and some regional configurations elsewhere), a comma-delimited file double-clicked open lands entirely in column A - exactly the reported symptom. Three consequences:

- Adding a UTF-8 BOM is still correct (it fixes character-encoding detection in desktop office suites) but does **not** fix delimiter locale. Do not close the report on BOM alone.
- The `sep=,` first-line hint fixes delimiter detection in Excel but is non-standard, breaks strict RFC 4180 consumers, and support in WPS versions is unverified. Do not rely on it as the primary fix.
- Making XLSX the default download sidesteps delimiter locale entirely, which is why it is the primary fix. CSV remains for automation, with the documented help text for manual import.

When the partner's file, WPS build number, and OS locale arrive, reproduce, record the exact combination in the compatibility fixtures, and add that configuration to the compatibility test matrix so a regression is caught by fixtures rather than another support report.

#### Product changes

- Make `.xlsx` recommended/default template and export format.
- Offer explicit choices:
  - `Excel workbook (.xlsx) - recommended`
  - `CSV UTF-8 (.csv)`
- Provide downloadable XLSX sample, current-menu export, and error report where useful.
- Keep CSV for interoperability and automation.
- Add plain-language help: “If CSV columns open in one column, use the Excel workbook instead.”

#### CSV contract

- RFC 4180-style comma delimiter.
- CRLF line endings.
- UTF-8 with BOM for desktop-office compatibility.
- Properly quote commas, line breaks, quotes, and semicolon-containing list fields.
- Prevent spreadsheet formula injection by escaping cells beginning with `=`, `+`, `-`, or `@` where user-controlled text could be interpreted as formula.
- Import should strip BOM, detect supported delimiters, and reject ambiguous or malformed files with actionable errors.
- Surface Papa Parse errors instead of silently consuming `result.data`.

Semicolon-delimited CSV needs care because Hungr list cells also use semicolons. If supported, list cells must be quoted and compatibility tests must prove round trips.

#### XLSX contract

- First sheet contains documented fixed headers.
- Text and money cells have explicit types/formatting.
- No executable formulas or macros.
- Upload validates workbook size, row count, headers, and cell values server-side after client preview.
- Review current `xlsx` package maintenance, security advisories, and licensing before expanding production use. Replace it with a maintained alternative if audit fails. Enforce compressed-file, expanded-size, sheet, row, and cell-count limits for untrusted workbooks.

#### Reliability work

- Validate the full batch before writes, then make add, modify, and replace modes transactional through database functions/RPCs. Category creation, item writes, ordering, and pairing updates must not leave partial state.
- Prefer server-side canonical parsing or revalidation for final writes; client preview is not a trust boundary.
- Preserve item order and category hierarchy or explicitly document current limitations.
- Add fixture files generated by supported Excel, WPS Office, and LibreOffice versions.

#### Acceptance criteria

- XLSX sample opens into separate columns in supported WPS, Excel, and LibreOffice versions.
- CSV opens correctly under documented locale/import procedures.
- CSV and XLSX round-trip Unicode, commas, quotes, multiline descriptions, decimal prices, modifiers, allergens, labels, and pairings.
- Malformed rows show row/column errors.
- Failed replace leaves original menu unchanged.
- Import never executes spreadsheet formulas.

### 5.5 Specials ordering

#### Product behaviour

- Remove numeric Priority from special editor.
- Add drag handle to specials list.
- Label list: `Drag specials into the order you want them shown. Top item has highest priority.`
- Persist order immediately or through explicit `Save order`; use same interaction pattern as menu ordering where practical.
- Show deterministic tie-free order after refresh.

#### Data model

- Add `display_order integer not null` to `specials`.
- Backfill by current `priority desc`, then `created_at asc`, then `id`.
- Add index covering restaurant/menu/order query paths.
- Add atomic reorder RPC that validates every ID belongs to authorised restaurant and rejects duplicates.
- Keep `priority` temporarily during migration, then remove after all readers use `display_order`.

#### Conflict rule - DECIDED (2026-07-22, decision 4)

**Customer-best price.** List order controls display position only. Where multiple active specials apply to one item, the item's displayed and effective price is the lowest valid final price computed from each applicable special against the item's actual price - not a comparison of raw percentages against fixed amounts. Category- and item-level specials enter the same comparison. Implementation replaces the current heuristic (raw percentage vs scaled fixed-amount comparison, first-match category selection) with a single well-tested `bestPriceForItem(item, applicableSpecials)` function used by both dashboard preview and public menu.

Strict top-wins was rejected: card ordering must never cause a customer to pay more.

Order & Pay must honour every discounted price it displays. Before paid launch, move the existing customer-best special calculation into the server-authoritative quote path and store an immutable applied-special snapshot. Phase 7 still owns coupons, stacking, limits, reservations, and the general promotion engine; this minimum bridge prevents display/checkout price mismatch.

Before expanding specials, enforce tenant consistency: a special's menu and every target item/category must belong to the same restaurant, target replacement must be transactional, and public reads must be limited to publicly available restaurant/menu context. Specials scheduling must use `restaurants.timezone`, not a fixed Johannesburg default.

#### Acceptance criteria

- Manager reorders specials by drag-and-drop on desktop and accessible keyboard controls.
- Refresh and public menu preserve order.
- Concurrent reorder has deterministic last-write or conflict behaviour.
- Discount conflict behaviour has dedicated tests and user-facing documentation.

## 6. Order & Pay Feature-Control Model

### 6.1 Separate rollout from commercial entitlement

One checkbox cannot safely represent emergency shutdown, pilot access, future plan inclusion, and restaurant readiness.

Use four layers:

1. **Global commerce mode:** `off`, `pilot`, or `live`; includes emergency `accept_new=false` kill switch.
2. **Organisation override:** `inherit`, `allow`, or `deny`, with reason, actor, and optional expiry.
3. **Plan entitlement:** `plans.features.order_and_pay` when pricing/tier decision is made.
4. **Restaurant operating state:** configured, enabled, paused, or unavailable; restaurant managers may pause intake but cannot grant entitlement.

### 6.2 Recommended precedence

For creating new carts/orders/payments:

1. Global emergency kill or `off` blocks new activity.
2. In `pilot` mode, only an explicit, unexpired organisation `allow` grants access; `inherit`, `deny`, and plan entitlement all block.
3. In `live` mode, explicit organisation `deny` blocks and explicit `allow` grants access.
4. In `live` mode with `inherit`, valid plan entitlement decides.
5. Missing, malformed, expired, or unavailable state denies.
6. Restaurant must also be configured, enabled, open if hours are enforced, and connected to providers required by its current payment/POS mode.

For existing orders and support operations, use a separate capability check that remains available during shutdown.

### 6.3 Recommended records

- `platform_feature_controls`
  - `feature_key`
  - `mode`
  - `accept_new`
  - rollout metadata
  - timestamps and updater
- `organization_feature_overrides`
  - `org_id`
  - `feature_key`
  - `decision`
  - `reason`
  - `expires_at`
  - actor and timestamps
- `restaurant_ordering_settings`
  - `restaurant_id`
  - intake state
  - auto-accept setting
  - default prep time
  - ordering-hours policy
  - currency
  - timestamps

Do not store provider secrets in `platform_settings` or any publicly readable table.

### 6.4 Enforcement

- Central typed resolver, not scattered JSON checks.
- Enforce in server actions and route handlers.
- Critical create-cart, submit-order, and checkout mutations resolve feature state inside the same database transaction. Application checks alone are insufficient because the kill switch or restaurant intake state can change between check and write.
- Emergency disable bypasses stale application caches and has a documented propagation SLA.
- Plan entitlement uses the same explicit valid-subscription semantics as billing access; lookup failure denies rather than defaulting to Starter.
- UI visibility is convenience only.
- Include resolved decision source in audit/support output.
- Super-admin UI shows global mode, kill switch, plan result, organisation override, effective result, and restaurant readiness separately.
- Add a precedence-matrix test covering every global mode, kill-switch state, organisation decision/expiry, plan value, and restaurant readiness combination.

## 7. Order & Pay Domain Model

Names below are proposed and should be finalised in implementation design specs.

### 7.1 Patron identity

#### `patron_profiles`

- `user_id` linked to Supabase Auth.
- Display name, phone, locale, and account lifecycle fields.
- Global privacy/account preferences only.

Do not make every patron an organisation owner. A user may be both patron and operator, so patron/operator are capabilities and relationships, not mutually exclusive actor types. Refactor the new-user trigger to create only the profile. Authenticated, server-controlled operator onboarding creates organisations and ownership; client-editable Auth metadata never grants either capability.

#### `restaurant_patrons`

Tenant-scoped relationship between patron and restaurant/organisation:

- First/last order dates.
- Order count and lifetime value projections.
- Optional restaurant-visible notes/tags with audit trail.
- Suppression and pseudonymisation state.

Restaurant A cannot read relationship data from Restaurant B.

#### `marketing_consents`

Append or version consent evidence by restaurant, purpose, and channel:

- `patron_user_id`
- `restaurant_id`
- `channel` (`email`, `sms`, future push)
- purpose
- notice/version
- source
- granted/withdrawn timestamps
- request metadata retained only as legally justified

Marketing defaults off. Ordering never requires marketing opt-in.

### 7.2 Tables and QR sessions

#### `restaurant_tables`

- Stable UUID.
- Restaurant.
- Display label/number.
- Optional seat capacity.
- Active state.
- Pilot table and waiter mapping fields, preferably in provider-specific mapping table.
- Opaque QR token/version, never sequential IDs as proof of presence.

Migration from `restaurants.table_count`: the existing integer is a count, not table identity. When a restaurant is onboarded to Order & Pay, offer a one-time seeding action that generates `table_count` rows labelled `1..N` (labels editable afterwards, since real floors use names like `Patio 3`). Seeding is per-restaurant and manager-triggered from the ordering setup checklist, not a global backfill - most restaurants never enter the pilot and must not accumulate unused table rows and tokens. After tables exist for a restaurant, `restaurant_tables` is the source of truth for that restaurant; `table_count` remains a plain informational field for non-ordering restaurants and is eventually derived or retired once Order & Pay is generally available. Nothing may join QR/session/order logic to `table_count`.

#### `table_sessions`

- Restaurant and table.
- Opaque join code/token hash.
- Opened, expires, and closed timestamps.
- Status.
- Optional waiter assignment.

Scanning a signed/opaque table QR resolves table context and joins an already-active, short-lived table session. Token rotation invalidates old QR access without replacing table identity. Static QR identifies a table; it does not prove that the scanner is physically present.

DECIDED (2026-07-22, decision 17): staff-activated sessions. Static QR identifies the table but does not itself prove presence. Restaurant staff opens a time-limited table session before ordering; scans can join only while that session is active. A photographed code is blocked while the table is closed but can be reused remotely during a later active session, so this control reduces the abuse window rather than eliminating remote reuse. Add per-table/session rate limits, order-value limits, explicit restaurant acceptance, token rotation, support-visible revocation, and anomaly visibility. Phase 3 design must either accept and document this residual risk for the pilot or add stronger per-session presence proof such as a staff-displayed rotating code; geolocation alone is insufficient. Session lifetime default and limit values are set during Phase 3 design (starting point: session auto-expires after configurable idle period, staff can extend or close early; closing the session revokes the cart capabilities bound to it).

QR token contract for Phase 3 design: prefer a server-signed payload containing a non-sequential table UUID plus token version, rather than storing a reusable raw bearer token. Verification checks signature, current table version, active table, and active session; rotation increments the version and invalidates every old print. If provider or library constraints require random tokens instead, store a lookup hash plus an encrypted recoverable value only when reprinting demands it. Never store reusable QR secrets in plaintext or compose trusted payloads in the browser.

### 7.3 Orderable catalogue

Existing item modifier JSON lacks stable IDs and selection constraints. Order MVP needs:

- Per-item `orderable` and `available` flags.
- Stable modifier-group and modifier-option IDs.
- Required/optional groups.
- Min/max selections and repeatability.
- Price adjustments in cents.
- Availability.
- POS mapping identifiers.
- Tax/category metadata after accounting advice.

Migration can preserve existing menu-display JSON while introducing normalized order configuration. Never rely on modifier names as permanent external IDs.

### 7.4 Cart

Recommended server-backed records:

- `carts`
- `cart_items`
- `cart_item_modifiers`

Cart stores selected IDs and provisional totals. Every mutation revalidates restaurant, menu, availability, table session, feature state, and server pricing. Before order creation, calculate final quote and return changed-price/availability conflicts for patron confirmation.

Pre-authentication carts need an explicit ownership boundary:

- Issue a high-entropy opaque cart capability in an `HttpOnly`, `Secure`, `SameSite=Lax` cookie and store only its hash.
- Bind capability to cart and active table session; never authorise by cart UUID alone.
- Perform anonymous cart mutations through server routes/actions that verify capability hash and table-session validity.
- On login, transactionally claim cart for patron, rotate/delete anonymous capability, and prevent later reuse.
- Expire abandoned carts and revoke them when table session closes.

Alternative Supabase anonymous Auth requires trigger and authorization redesign because current new-user trigger creates organisations. Do not enable it without that work.

### 7.5 Orders

#### `orders`

- Restaurant, organisation, patron, and table session.
- Human-readable restaurant-scoped order number.
- Currency.
- Subtotal, discount, tax, service fee, tip, and total cents.
- Fulfilment status.
- Payment status.
- Version for optimistic concurrency.
- Submitted/accepted/ready/collected/cancelled timestamps.
- Patron note and restaurant note with strict visibility.

#### `order_items` and `order_item_modifiers`

Store both source IDs and immutable snapshots:

- Item/modifier names.
- Quantity.
- Unit and line amounts.
- Applied tax and discounts.
- Selected options.
- POS mapping snapshot where needed for troubleshooting.

Catalogue source foreign keys are nullable and use deletion behaviour that preserves financial history, normally `ON DELETE SET NULL`; immutable snapshots remain authoritative after a menu, item, modifier, patron link, or table is removed. Restaurant/account deletion follows the retention and pseudonymisation policy rather than cascading through paid order history.

Database invariants required in the Phase 3 design:

- Monetary columns are non-negative integer cents and each aggregate has exactly one currency.
- Human order numbers are unique within restaurant scope.
- Submitted item and modifier snapshots are immutable.
- Fulfilment status and milestone timestamps cannot contradict each other.
- Order `org_id` and `restaurant_id` satisfy a composite tenant-consistency constraint.
- Idempotency keys are unique within their documented restaurant/provider scope.

#### `order_events`

Append-only order timeline:

- Event type and sequence.
- Actor type/ID.
- Previous and next status.
- Safe metadata.
- Timestamp.

### 7.6 Fulfilment state machine

Recommended initial states:

- `draft`
- `submitted`
- `accepted`
- `preparing`
- `ready`
- `collected`
- `cancelled`
- `rejected`

Every transition uses one transactional function that validates current state, actor permissions, version, and allowed next state; then writes event and outbox records.

Auto-accept changes `submitted` to `accepted` through same transition path. Do not bypass audit/events.

### 7.7 Payments

Keep patron payments separate from current subscription `transactions` and invoices.

Recommended records:

- `order_payment_intents`
- `order_payment_attempts`
- `order_payment_reservations`
- `order_payment_allocations`
- `order_refunds`
- `payment_provider_events`
- `payment_reconciliation_issues`

Payment statuses:

- `not_required` for non-monetary development/order-only pilots only
- `unpaid`
- `pending`
- `partially_paid`
- `paid`
- `partially_refunded`
- `refunded`
- `failed`
- `disputed`

Payment database invariants required before Phase 4 implementation:

- Confirmed allocations never exceed the payable total and use the order currency.
- A paid status requires confirmed allocations to equal the payable total; refunds cannot exceed confirmed payment.
- Whole-order provider payment and manual whole-order settlement are mutually exclusive until mixed tender explicitly launches.
- Intent, attempt, provider-event, allocation, refund, and reconciliation idempotency scopes are enforced by unique constraints.
- Financial rows are append-only or transition through audited database functions; catalogue or account deletion never cascades them away.

Provider adapter contract:

- Create payment intent/checkout.
- Query/reconcile status.
- Capture or void where provider supports it.
- Refund.
- Verify and normalise webhook.
- Return stable provider account, payment, and event identifiers.

Every provider checkout, including single-payer whole-order checkout, first reserves payable amount under a row lock. Enforce at most one active full-balance reservation/intent for whole-order mode. Idempotency handles retries of same checkout request; reservation uniqueness prevents two different checkout attempts from both collecting full balance.

### 7.8 Split-payment model

Split payment needs database locking, expiring amount reservations, and transactionally allocated confirmed payments.

Recommended sequence:

1. Launch whole-order payment by one patron.
2. Add “pay my amount” split in cents.
3. Consider equal split helpers.
4. Add item claiming only after amount splits are stable.

Before provider checkout, one database function must lock payable aggregate, calculate `remaining = total - confirmed allocations - active reservations`, reserve exact payer amount, and reject over-reservation. Reservation has stable idempotency key, owner, amount, status, and expiry. Provider intent references reservation.

Webhook settlement locks same aggregate and reservation, accepts only expected amount/currency, converts reservation to confirmed allocation exactly once, releases/flags failed reservations, and marks order paid only when confirmed allocations equal payable total. Local expiry alone must not release reserved amount while provider intent remains capturable. Reuse amount only after provider reports terminal expiry/cancellation or authorised reconciliation closes exposure; late captures always enter reconciliation rather than silently overpaying order.

Decided (2026-07-22):

- **Split model is custom amount** with an equal-split helper that prefills amounts (decision 8). Item claiming deferred.
- **New items after first payment: no** (decision 11). The first confirmed allocation locks the order total; additional rounds are new orders on the same table session. The patron UI must make "start a new order" obvious once a split is in progress.
- **Restaurant can mark cash/manual payment: yes, audited** (decisions 10, 12). A manual allocation participates in the same locked remaining-balance arithmetic as provider payments and cannot exceed the remaining amount.

Still to decide before split implementation:

- Who covers rounding remainder on equal split (recommend: last payer's prefill absorbs the cents).
- Are tips split per payer or attached to one payer's amount?
- Can providers be mixed across payers of one order?
- How long can a partially paid order remain open, and what happens at expiry?
- How are partial refunds allocated across payers?
- What happens when one guest abandons payment (staff prompt, manual settle, cancel remainder)?

## 8. Patron Experience

### 8.1 Authentication and profile

DECIDED (2026-07-22, decision 5): magic link/OTP first, optional account-holder enrolment.

Flow:

- Scan table QR and browse without account.
- Email magic link/OTP required before submitting a paid order. This creates a real Supabase Auth patron user - "magic link" is the sign-in method, not a lesser account.
- Preserve table and cart context through authentication.
- **Account-holder enrolment:** after first order (post-checkout prompt and profile page), patron may add an optional password for cross-device sign-in and enrol in separately consented account-holder capabilities. Existing magic-link sessions already persist according to the normal Supabase session policy. This remains one identity - same `user_id`, same history, no migration.
- **Enrolment incentive:** account holders become eligible for prize draws and loyalty programmes (see 11 and decision on loyalty). Value-based incentive, never a gate on ordering. Draw/loyalty participation is consent-gated separately from the account itself; POPIA notices name the purposes.
- Profile supports name, phone, order history, consent controls, data export request, and account closure request.
- Session policy: patron sessions on personal devices may be long-lived; sign-out control is prominent; account closure and consent withdrawal remain one tap deep.

Password reset exists only for patrons who chose a password; magic link remains the universal recovery path.

Supabase magic-link sign-in already creates a full Auth identity and refresh-token session. “Upgrade” therefore means adding an optional password credential and enabling explicitly consented account-holder capabilities such as loyalty eligibility; it is not a second account class or a separate authorization tier. Phase 2 design must define shared-device session behaviour, remembered-device wording, credential timestamps, and sign-out/revocation semantics without inventing a weaker magic-link identity.

Patron closure removes or pseudonymises the patron relationship without deleting operator organisations. Full Auth-user deletion is allowed only when no ownership, billing, audit, or other operator obligation remains; otherwise ownership must first be transferred. Test patron-only, operator-only, and dual-role identities separately.

Current app supports restaurant-user email/password auth and redirects dashboard routes through `proxy.ts`. Patron implementation therefore includes dedicated sign-in/callback routes, safe `next`/context handling, patron-vs-operator account routing, and transactional anonymous-cart claim. Do not route patrons through organisation onboarding.

### 8.2 Cart and checkout

- Table context remains visible throughout.
- Patron chooses item, required modifiers, optional extras, quantity, and notes.
- Cart groups items and shows server-calculated totals.
- Checkout reconfirms table, contact/receipt destination, marketing choices, and payment method.
- Price or availability changes require explicit patron confirmation.
- Duplicate submit uses idempotency key and returns same order.

### 8.3 Order tracking

- Confirmation screen shows order number, restaurant, table, items, amount, payment state, and fulfilment timeline.
- Realtime updates are supplemented by reload/reconnect fetch.
- Patron receives transactional order confirmation, receipt, and ready notice according to available channels.
- History uses immutable order snapshots and tenant-safe access.

### 8.4 One-tap reorder ("order again")

The client requirement "last ordered history for returning patrons" implies acting on history, not only viewing it. Reorder is the highest-leverage returning-patron feature and is cheap once carts and snapshots exist. Target: Phase 3 if capacity allows, otherwise first fast-follow after Phase 3.

Behaviour:

- `Order again` appears on each order in patron history and on the confirmation screen of a completed order, for the same restaurant only.
- Reorder never trusts the historical snapshot for pricing or availability. It maps each historical `order_item` back to the **current** catalogue by stored item/modifier IDs, then rebuilds a fresh cart through the normal server-validated cart path at current prices.
- Resolution outcomes per line, surfaced before checkout in a reconciliation view:
  - Fully available: added with current price. Price differences from the historical order are shown, not silently absorbed.
  - Modifier changes: if a previously selected option no longer exists or violates current min/max rules, the item is added incomplete and flagged for re-selection, or omitted with a clear notice - never silently substituted.
  - Item unavailable or no longer orderable: listed as skipped with its name from the snapshot.
- Patron confirms the reconciled cart; nothing submits automatically. Reorder produces a cart, never an order.
- Reorder requires an active table session under the same presence rules as any new order (scan/join first, then reorder). It must not become a remote-ordering bypass.
- Feature-control checks apply exactly as for any new cart: reorder is unavailable when Order & Pay intake is off for the restaurant.
- Analytics: track reorder initiation, reconciliation conflicts shown, and conversion to submitted order - this is the measure of returning-patron value.

Acceptance criteria:

- Reorder of an untouched menu reproduces the same items at current prices in one tap plus one confirm.
- Renamed, repriced, deleted, and modifier-changed items each produce the documented reconciliation outcome; component tests cover all four.
- Reorder against a closed table session or disabled intake is rejected with the standard messaging.
- No historical snapshot value ever reaches a submitted order's pricing fields.

## 9. Restaurateur Experience

### 9.1 Ordering setup

Restaurant setup checklist:

- Feature access granted.
- Structured operating hours complete.
- Tables created and QR codes generated.
- Orderable items/modifiers configured.
- Payment provider configured when restaurant's current payment mode requires it.
- Auto-accept and default prep time set.
- Transactional sender settings complete.
- Pilot mapping status shown when integration phase begins.

#### Printable QR pack

"QR codes generated" needs a physical output, or every pilot restaurant improvises with screenshots. Provide a downloadable print pack from table management:

- One PDF per restaurant: one page (or configurable n-up layout for label sheets) per active table, containing the QR code, the table label in large type, the restaurant name/logo, and a one-line instruction ("Scan to view the menu and order").
- A5 and A6 page presets for table talkers and laminated cards; print margins safe for consumer printers.
- QR encodes the full patron URL with the table's opaque token, generated at sufficient error-correction level (Q or H) to survive lamination glare and wear.
- Each page footer carries the table label and token version in small print so staff can visually match a physical card to the table list when rotating tokens.
- Rotating a table's QR token immediately invalidates the old printed code; the UI must warn that reprint is required for affected tables and offer a partial pack containing only rotated tables.
- Single-table download also available (replace one damaged card without reprinting the floor).
- Generation is server-side or client-side as implementation prefers, but the QR payload always comes from the server-held token - never a client-composed URL.
- Deactivated tables are excluded from packs; regenerating a pack never silently reactivates a table.

Acceptance criteria:

- Pack renders every active table exactly once; scanning a printed code on a phone camera resolves the correct table.
- Post-rotation, old printed code lands on a clear "this code is no longer valid, ask staff" page rather than an error.
- Reprint-needed warning appears after rotation and clears after new pack download.

### 9.2 Live order management

Views:

- Incoming.
- Accepted/preparing.
- Ready.
- Completed/cancelled.
- Attention required: payment mismatch, POS failure, stale order.

Actions:

- Accept/reject.
- Start preparing.
- Mark ready/collected.
- Adjust prep estimate.
- Pause new orders.
- Mark items unavailable.
- Resend receipt/notification.
- Start authorised refund flow.

Realtime reconnect must fetch authoritative current rows. Audible alerts need explicit browser permission and deduplication.

### 9.3 Sales analytics

Recognised sales should derive from captured payments minus refunds, not mutable order totals or existing menu-view analytics.

Initial metrics:

- Gross and net captured revenue.
- Refunds.
- Order count and average order value.
- Orders by hour/day/table.
- Item/modifier units and revenue.
- Discount/coupon cost.
- Acceptance, preparation, and completion time.
- Payment failure rate.
- POS delivery success and latency.

Store order/payment facts required for reporting. Add aggregates only after query and scale evidence.

## 10. CRM, Consent, and Communications

### 10.1 Basic CRM

First release:

- Restaurant-scoped patron list.
- Search by permitted contact fields.
- Last order, order count, spend, opted-in channels, loyalty status.
- Manual tags and notes with audit trail.
- Patron order and communication history.
- Export restricted to authorised roles and audited.

Segmentation comes after consent and data-quality foundations.

### 10.2 Communications

Separate categories:

- **Transactional:** verification, password reset, order confirmation, receipt, order status, refund.
- **Operational staff:** incoming order, payment/POS failure.
- **Marketing:** campaigns, offers, loyalty reminders.

Marketing requires:

- Explicit per-restaurant, per-channel opt-in.
- Unsubscribe/STOP handling.
- Suppression list.
- Sender-domain and SMS-sender decisions.
- Rate limits and abuse controls.
- Template approval/versioning.
- Delivery, bounce, complaint, and opt-out events.
- Campaign audit and communication history.

Do not ship campaign sending in same milestone as basic CRM display.

## 11. Loyalty, Coupons, Promotions, and Specials

### 11.1 Architecture

Keep three concepts distinct:

- **Specials:** visual merchandising and discovery.
- **Promotions/coupons:** server-authoritative pricing rules.
- **Loyalty:** patron rewards earned and redeemed over time.

### 11.2 Loyalty foundation

Recommended records:

- `loyalty_programs`
- `loyalty_accounts`
- `loyalty_ledger_entries`
- `loyalty_rewards`
- `loyalty_redemptions`

Use append-only ledger entries. Balance derives from ledger or a reconciled cached balance. Award only after qualifying captured payment; reverse idempotently after refund.

### 11.3 First programme types - DECIDED (2026-07-22)

**Launch pair: digital stamps plus account-holder prize draws.**

- **Digital stamps** (core mechanic): buy N qualifying items/orders, receive reward. Restaurant configures the qualifying rule, N, and the reward. Stamp progress lives on the loyalty ledger; awards happen only after qualifying captured payment and reverse idempotently on refund per 11.2.
- **Prize draws** (account-holder incentive, per decision 5): enrolled patrons can opt into per-restaurant or platform draws. Entries recorded append-only with the qualifying action; draws executed with recorded method and winner audit. **Legal gate:** South African promotional competitions fall under CPA section 36 - published competition rules, entry terms, winner records, and oversight requirements apply, and POPIA purpose/consent covers entry data. Phase 0 legal checklist item; no draw ships before that clearance.
- Draw eligibility and marketing contact remain separate consents: entering a draw must not silently opt the patron into campaigns.

Remaining options on the same ledger foundation, not in first release:

- Spend points: points per rand spent.
- Visit rewards: one qualifying visit per configured period.
- Birthday reward only with explicit date-of-birth purpose and retention review.

Later experiments:

- Tiers.
- Limited-time multipliers.
- Category/item missions.
- Lapsed-patron offers.
- Referral rewards with fraud controls.

### 11.4 Promotion engine

Rules need:

- Scope: restaurant, menu, item, category, modifier.
- Date/time/timezone windows.
- Minimum spend/quantity.
- Coupon code.
- Per-patron, per-order, and global limits.
- Eligibility segments.
- Stack/exclusion policy.
- Reservation during checkout and final redemption on payment/order acceptance.
- Immutable applied-rule snapshot.

Do not turn current `specials.priority` into pricing logic without explicit conflict and stacking rules.

## 12. Pilot POS Integration

### 12.1 Timing

Start commercial/vendor discovery immediately, but implement Pilot after Hungr order and restaurant workflows are stable. This avoids shaping Hungr's core domain around assumptions made without API credentials or sandbox evidence.

### 12.2 Required from Pilot before implementation

- Sandbox account and API keys.
- Current Online Ordering API documentation.
- Authentication and key-rotation process.
- Rate limits and timeout expectations.
- Idempotency support.
- Order payload and modifier mapping rules.
- Table/waiter identifiers.
- Auto-accept semantics.
- Callback signatures, retries, ordering, and source IP guidance.
- Status vocabulary and cancellation/refund behaviour.
- Test store/product/table fixtures.
- Production onboarding and support escalation process.
- Whether payment can be taken on the POS side and how a POS-settled payment reports back to Hungr (decision 6 forward-note: the payment model must be able to represent externally settled orders).

### 12.3 Provider-neutral integration model

Create `PosProvider` adapter with:

- Validate connection.
- Fetch or validate configuration if supported.
- Map Hungr order to provider order.
- Submit order with idempotency key.
- Fetch/reconcile order.
- Verify/normalise callbacks.
- Map provider status to Hungr status.

#### Status vocabulary mapping

The client brief lists Pilot callbacks `received`, `accepted`, `ready`, `collected`. Hungr's fulfilment machine is richer (`submitted`, `accepted`, `preparing`, `ready`, `collected`, `cancelled`, `rejected`). The Pilot design spec must contain an explicit bidirectional mapping table before any integration code, with these constraints:

- Working assumption, to validate against real Pilot documentation: `received` maps to POS delivery confirmation (integration status), not a fulfilment transition; `accepted` maps to `accepted`; `ready` maps to `ready`; `collected` maps to `collected`. Hungr's `preparing` has no Pilot callback under the brief's vocabulary and is driven by restaurant UI or inferred; it must not block on POS.
- Every Pilot callback status must map to exactly one Hungr transition or be explicitly listed as ignored-with-log. Unknown statuses go to the attention queue, never silently dropped and never guessed.
- Out-of-order callbacks (e.g. `ready` arriving before `accepted`) are resolved by the state machine's allowed-transition rules plus reconciliation reads - the mapping table must state, per pair, whether to apply, skip, or queue.
- Rejection/cancellation vocabulary from Pilot (missing from the brief) must be confirmed with Pilot before Phase 8 starts; if Pilot cannot signal rejection, the auto-accept product decision changes materially.
- The mapping table lives in the adapter as data plus contract tests, one test per row, so a Pilot vocabulary change fails loudly.

Recommended records:

- `pos_connections`
- `pos_catalog_mappings`
- `integration_outbox`
- `integration_deliveries`
- `integration_inbox`
- dead-letter/replay metadata

Provider credentials belong in Supabase Vault or another approved encrypted secret manager. Private-schema isolation alone is not encryption. Database tables may retain only secret references and safe metadata unless encrypted values and key management receive dedicated security approval.

### 12.4 Delivery flow

1. Order transaction writes order, event, and POS outbox record.
2. Worker claims outbox record.
3. Adapter sends stable idempotency key.
4. Response is recorded and status updated.
5. Retry transient failures with backoff.
6. Permanent mapping/config failures enter attention queue.
7. Signed callbacks insert unique provider event before applying status transition.
8. Reconciliation finds missing or divergent statuses.

### 12.5 Source-of-truth decision

Before launch, decide whether Hungr or Pilot controls:

- Menu catalogue and prices.
- Item availability/stock.
- Order acceptance.
- Table and waiter assignment.
- Fulfilment status.
- Cancellation and refunds.

Additional POS providers should implement same adapter after Pilot contract tests are stable.

## 13. Payments and Commercial Decisions

### Decided (2026-07-22)

- **Merchant of record: each restaurant** (decision 6). Restaurants connect their own provider accounts; funds settle directly to the restaurant; Hungr never holds patron order funds and avoids aggregator/payout licensing exposure. Refunds and chargebacks land on the restaurant's provider account; Hungr provides the tooling and audit trail. Platform revenue comes from the plan/bolt-on subscription, not from sitting in the money flow - any future per-transaction fee is a separate commercial decision with its own compliance review.
- **Provider selection: structured Phase 0 evaluation of PayFast, Zapper, and SnapScan** (decision 7). Request from each in parallel: API documentation, sandbox access, per-restaurant onboarding/KYC model, settlement timing, webhook signing and retry behaviour, refund API completeness, and fee structure. Score against a fixed rubric; the Phase 4 launch provider is the evaluation winner. The adapter contract in 7.7 is provider-neutral so the choice does not reshape the domain.
- **Capture timing: per-restaurant configuration; pay-first ships first** (decision 9). `restaurant_ordering_settings` gains a `capture_mode` with values planned as `pay_first` (Phase 4), `accept_then_pay` (later phase), `tab` (deferred indefinitely). Phase 4 exposes the setting with only `pay_first` selectable so the configuration surface, analytics dimensions, and support tooling exist before the second mode arrives. Each later mode ships with its own limbo/expiry/nag design - no mode is enabled by config flag alone.
- **Tips: in MVP checkout** (decision 10). Presets 10/15/20% plus custom amount, stored in `tip_cents` as its own total line, included in the provider charge, settled to the restaurant, reported separately in analytics. Tip handling in refunds: default full-refund includes tip, partial refunds require explicit tip decision in the refund UI.
- **Manual settlement: audited mark-paid** (decision 10). Staff with restaurant access can mark an order paid by cash or external card terminal within configured amount/risk limits. Records actor, method, reason, and timestamp as a manual allocation; reconciliation and analytics distinguish manual-paid from provider-paid. Managers are notified and can reverse a mistaken manual mark within an audited window.
- **Roles for money actions** (decision 12): owner/admin/restaurant-manager refund and cancel; staff accept, reject unpaid orders, and mark manual-paid within configured controls; super admin audited support override. Paid rejection requires manager approval or moves to `refund_required`; it never lets staff trigger money movement indirectly.

### Still requiring commercial/vendor closure before Phase 4 code

- Restaurant onboarding/KYC flow per evaluated provider.
- VAT and service-charge treatment (accounting advice).
- PayFast product/account support for per-restaurant patron payments (their subscription product is not assumed suitable).
- Zapper and SnapScan API availability, settlement model, webhooks, and refund support (TBC status from client brief).
- Future POS-side payment: how a Pilot-settled payment reports into Hungr's payment model (decision 6 note; Pilot question 22).

Existing PayFast subscription integration must not be assumed suitable for restaurant order funds.

Payment webhook minimum requirements:

- Verify signature against correct restaurant/provider account.
- Persist unique provider event atomically.
- Validate expected amount, currency, order, and legal payment transition.
- Apply allocations transactionally.
- Return quickly; queue email, POS, analytics, and callbacks.
- Reconcile provider status independently of webhooks.
- Alert on amount/currency mismatch or impossible state.

## 14. POPIA and Security Workstream

Legal review must confirm responsible-party/operator roles, notices, contracts, retention, and lawful bases. Engineering baseline:

- Data minimisation and purpose-specific fields.
- Tenant-scoped consent evidence.
- Marketing default off and independently revocable.
- Transactional messages not incorrectly governed by marketing opt-in.
- Patron access/export, correction, account closure, and consent withdrawal flows.
- Retention schedule for carts, sessions, orders, payments, provider payloads, CRM, communications, notification inboxes, table service requests, and audit logs.
- Pseudonymise patron links when deletion is required while retaining legally required financial records.
- Audit staff access/export, consent changes, refunds, manual payments, and CRM notes.
- Encrypt POS/payment credentials and rotate secrets.
- Redact sensitive provider payloads and logs.
- Rate-limit auth, QR session, cart, checkout, coupon, and webhook endpoints.
- Protect against IDOR/BOLA through ownership predicates, not `TO authenticated` alone.
- Never use user-editable auth metadata for authorization.
- All public-schema tables get explicit grants and RLS policies; deny by default.
- Views use `security_invoker` where supported or remain inaccessible to public API roles.
- Security-definer functions live outside exposed schema where possible, verify `auth.uid()`, fix `search_path`, and have minimal execute grants.

No raw card data should pass through or be stored by Hungr.

## 15. Delivery Phases and Estimates

Estimates are sequential engineering ranges for one experienced full-time engineer, excluding external vendor/legal waiting time. Parallel product, design, QA, and engineering can reduce calendar time but not total work.

### Planning depth and design gates

This roadmap owns product outcomes, cross-domain invariants, sequencing, and launch gates. It should not grow into one file-level implementation plan. Before code starts on any non-trivial group, create a focused design specification under `docs/superpowers/specs/`; create an implementation plan under `docs/superpowers/plans/` only after that design is accepted.

Each design specification must define:

- Context, goal, exclusions, product behaviour, and measurable success criteria.
- Exact schema, constraints, grants, RLS, tenant boundary, role matrix, and privileged-operation checks.
- State transitions, idempotency scopes, concurrency rules, external effects, and failure recovery.
- Data migration/backfill, deletion/retention behaviour, rollback, and compatibility requirements.
- Affected routes/files, cache revalidation, observability, operational ownership, and rollout.
- Unit, component, RLS, transaction/concurrency, E2E, and manual verification with exact commands.

Acceptance is explicit, not implied by document existence. Engineering accepts technical feasibility and safety; product accepts behaviour and scope; security, accounting, legal, or vendor owners accept their gated concerns. Record approver names/roles and date in the specification and `docs/ROADMAP_STATE.md`. A group is not READY and implementation steps do not start until its required design checkpoint is accepted.

Priority design queue:

1. P0-E1 database bootstrap and migration-history repair.
2. P0-E3 existing PayFast webhook hardening.
3. P0-E4 durable worker and queue runtime.
4. P0-E5 dual-role identity and account lifecycle.
5. P1-2 notification schema, review event, abuse protection, and delivery architecture.
6. Phase 3 commerce model, table-session security, catalogue normalization, order invariants, and deletion semantics.
7. Phase 4 provider contract, payment invariants, reconciliation, refund permissions, and accounting decisions.

Later Phase 5-9 designs wait for vendor, legal, accounting, and pilot evidence. Premature file-level detail there would create false certainty.

### Phase 0: Discovery and decision closure (1-2 weeks)

Core product decisions were taken 2026-07-22 (section 20). Remaining Phase 0 work:

- Obtain failing CSV/WPS sample, build number, OS locale; set compatibility targets (decision 3).
- Run the three-provider payment evaluation: PayFast, Zapper, SnapScan - docs, sandbox, KYC model, settlement, webhooks, refunds, fees; score against fixed rubric and select Phase 4 provider (decision 7).
- Start Pilot sandbox/key/documentation request, including POS-side payment question (Pilot question 22).
- Draft POPIA data map, lawful-basis matrix, retention policy, and notices with legal counsel.
- Add CPA section 36 promotional-competition review for prize draws to the legal checklist (loyalty decision).
- Close remaining split-payment semantics: rounding remainder, tips per payer, mixed providers, partial-payment expiry, partial-refund allocation, abandonment handling (7.8).
- Confirm proposed defaults for pilot-override expiry and open-cart behaviour on global disable (decisions 15, 16).
- Set table-session lifetime default and per-table rate/value limit values (decision 17 follow-through, finalised in Phase 3 design).
- Make fresh database creation reproducible from one documented command; verify baseline plus migrations from an empty local environment.
- Add CI for lint, `tsc --noEmit`, unit/component tests, clean database bootstrap, RLS tests, schema drift, production build, and selected E2E smoke tests.
- Harden the existing subscription PayFast webhook: atomically claim each provider event, stop on duplicate claims, validate expected merchant/account/amount/currency/state, and queue post-commit side effects.
- Select and document durable worker/queue infrastructure, leases, retry/backoff, dead-letter replay, monitoring, hosted-plan requirements, and crash recovery.
- Approve the dual-role identity and patron-closure design before changing the Auth trigger.
- Audit the current `xlsx` dependency before expanding spreadsheet support.

**Exit:** decision log fully closed or explicitly deferred per item, provider evaluation scored, vendor access requests in progress, and engineering prerequisites above have passing verification.

### Phase 1: Platform improvements (3-5 weeks)

- Structured hours/timezone/seat capacity.
- Public "Open now / Closed" badge derived from structured hours.
- Review notification producer, bell fixes, and timeline.
- `team.invite_accepted` notification event (honest empty-state copy).
- Realtime bell badge updates with reconnect refetch and polling fallback.
- Notification retention configuration and scheduled prune job.
- Unsaved item-sheet confirmation.
- XLSX dependency decision, downloads, CSV hardening, WPS fixtures, and atomic import modes.
- Specials tenant-integrity fixes, restaurant-timezone scheduling, drag ordering, and customer-best pricing.

**Exit:** all Track A acceptance criteria pass; no commerce tables required except shared event foundations if chosen.

### Phase 2: Commerce foundations and feature controls (2-4 weeks)

- Typed entitlement resolver and admin controls.
- Global mode/kill switch, organisation override, future plan bridge, restaurant intake state.
- Profile-only Auth trigger, server-controlled operator onboarding, dual-role patron/operator model, dedicated passwordless auth/callback routes, proxy rules, safe return-context contract, and non-destructive patron closure.
- Minimum tenant-scoped marketing-consent evidence, grant/withdraw service, and patron controls; campaign tooling remains deferred.
- Domain event/outbox and the selected durable delivery worker pattern.
- Private provider connection/secret model.
- Audit, idempotency, and RLS foundations.

**Exit:** direct API bypass cannot use disabled features; test organisation can be enabled safely.

### Phase 3: Order-only pilot without online payment or POS (4-6 weeks)

- Restaurant tables and rotatable QR codes.
- Table seeding from `table_count` and printable QR pack with rotation reprint warnings.
- Table sessions.
- Orderable items and stable modifiers.
- Capability-protected anonymous cart, transactional login claim, and server price quote.
- Order snapshots and fulfilment state machine.
- Server-authoritative customer-best special pricing with immutable applied-special snapshots; displayed and quoted prices match.
- Patron confirmation/history.
- One-tap reorder with reconciliation view, if capacity allows; otherwise first fast-follow.
- Restaurateur live order board and pause controls.
- Transactional order confirmation and idempotent ready notification.
- Fake POS adapter contract, no Pilot network calls.

**Exit:** selected dev organisation completes a non-monetary table order from scan to collected with payment status `not_required`. QR scanning and auth continuity pass on a real mobile Safari device before any external patron pilot. No cash/manual settlement or payment provider is implied in this phase.

### Phase 4: Single-payer online payment (3-5 weeks)

- Adapter for the provider selected in the Phase 0 evaluation.
- `capture_mode` restaurant setting shipped with `pay_first` as the only selectable value (decision 9).
- Tips at checkout: presets plus custom, separate total line, refund-handling rules (decision 10).
- Audited manual-paid action for cash/external-terminal settlement with amount/risk limits, reason, manager notification, and reversal window (decisions 10, 12).
- Money-action role enforcement: managers+ refund/cancel or reject paid orders; staff accept/reject unpaid orders and mark-paid within controls; all audited (decision 12).
- Rejection/cancellation refund flow keeps refund as a separate idempotent manager-authorised command. Paid staff rejection enters `refund_required` rather than moving money.
- Intent, attempts, allocation, refund, provider event, reconciliation records.
- Locked full-balance reservation and one-active-intent invariant before provider checkout.
- Whole-order checkout.
- Idempotent webhook transaction.
- Receipt/refund communication.
- Reconciliation and support dashboard.
- Payment threat review, failure-injection and recovery tests, sensitive-data retention/redaction, provider-outage/refund/reconciliation runbooks, and payment alerts required before any real-money pilot.

**Exit:** duplicate/out-of-order events and provider timeouts cannot duplicate financial effects; real-money security and operational gates above pass. Proceed to Phase 4B before an approved-cohort MVP launch.

### Phase 4B: MVP beta hardening and launch (3-5 weeks)

- Load, concurrency, security, RLS, failure-injection, and recovery tests.
- Operational dashboards and alerts.
- Data retention jobs.
- Incident, refund, reconciliation, provider outage, and rollback runbooks.
- Pilot organisation training and feedback fixes.
- Commercial entitlement migration when tier/bolt-on decision is final.

**Exit:** one-provider, single-payer Order & Pay MVP can launch to its approved cohort after real-device mobile Safari QR/auth/checkout verification. Phases 5-8 remain independent post-MVP tracks.

### Phase 5: Split payments (3-5 weeks)

- Amount-based payment allocation.
- Equal-split helper.
- Transactional amount reservations before provider checkout.
- Concurrent final-payment locking and exact reservation settlement.
- Reservation and partial-payment expiry/recovery.
- Split refund and support rules.
- Concurrency/load tests.

**Exit:** concurrent captures never exceed payable total; abandonment and refunds have documented recovery.

### Phase 6: Sales analytics and CRM foundation (3-5 weeks)

- Payment/order fact queries and initial dashboards.
- Restaurant patron records.
- Expand tenant-scoped consent centre for restaurant visibility, audit, and CRM use.
- Search, tags, notes, history, audited export.
- POPIA export/closure workflows.

**Exit:** analytics reconcile to captures/refunds; tenant isolation and consent evidence pass tests.

### Phase 7: Promotions, loyalty, and marketing (4-7 weeks)

- Promotion/coupon rule MVP.
- Digital stamps ledger MVP plus legally cleared, separately consented prize draws. Points remain deferred.
- Earn/redeem/reverse flows.
- Segments and consented email campaign MVP.
- Suppression, unsubscribe, delivery events, rate limits, and audit.
- SMS only after provider, sender, cost, consent, and STOP handling are approved.

**Exit:** rewards and discounts remain correct under retry/refund; no opted-out patron receives marketing.

### Phase 8: Pilot POS integration (3-6 weeks after credentials)

- Implement Pilot adapter against contract.
- Connection setup and key validation.
- Catalogue/table/waiter mappings.
- Order push, auto-accept, callbacks, retries, replay, dead-letter, reconciliation.
- Pilot sandbox certification and selected-location rollout.

**Exit:** Pilot contract test matrix and live sandbox scenarios pass; support runbook exists.

### Phase 9: Full-scope hardening

Repeat cross-cutting security, load, recovery, retention, training, and runbook gates for whichever Phase 5-8 capabilities are selected for general availability. Phase 9 does not make every optional track mandatory for MVP launch.

**Sequential total:** roughly 29-50 engineering weeks for full requested scope, plus vendor/legal delays. MVP can stop after Phase 4B.

## 16. MVP Scope and Deferred Scope

### Recommended MVP

- Pilot organisations only.
- One currency: ZAR.
- Dine-in table QR only, staff-activated sessions.
- Authenticated patron using low-friction email flow, with optional password and account-holder enrolment (decision 5).
- One cart owner and one whole-order payment, pay-first capture mode only.
- Tips at checkout and audited manual-paid settlement.
- One payment provider (Phase 0 evaluation winner).
- Simple item/modifier availability; no inventory deduction.
- Fulfilment statuses through collected/cancelled.
- Live restaurant order board.
- Order confirmation, receipt, and ready notification.
- Order history.
- One-tap reorder from history if Phase 3 capacity allows; otherwise first fast-follow (see 8.4).
- No POS network integration initially.

### Defer

- Item-level bill claiming.
- Mixed cash/card/provider payments.
- Shared editable group cart.
- Open tabs and post-pay ordering.
- Delivery/takeaway.
- Inventory decrement.
- Advanced kitchen stations/course firing.
- Campaign automation.
- Tiered loyalty and referrals.
- Multiple POS providers.
- Multi-currency.
- Waiter call / service request button (see below).

### Deferred but pre-scoped: waiter call

A "call waiter" / "request service" button inside an active table session is a common Order & Pay companion and is cheap once table sessions and the live board exist. Deliberately deferred out of MVP to keep the pilot surface small, but pre-scoped so it can slot in without design churn:

- Only available inside an active table session; inherits the same presence and rate-limit controls as ordering (a photographed QR must not become a prank-the-kitchen vector - per-session and per-table request throttles, e.g. one open request per table, cooldown after resolution).
- Request types kept minimal at introduction: `Call waiter`, `Request bill`. No free text initially (moderation burden).
- Surfaces on the restaurateur live board as a distinct attention row with table label and elapsed time; staff resolve with one tap; resolution clears the patron's pending state.
- Realtime to the board with the same reconnect-refetch discipline as orders; audible alert reuses the order-alert permission/deduplication work.
- Data: a small `table_service_requests` table (restaurant, table session, type, created/resolved timestamps, resolver) - append-only, tenant-scoped RLS identical in shape to orders, retention aligned with table-session retention.
- Explicitly out: waiter-to-patron chat, request routing to specific staff, integration with POS waiter assignment (revisit after Pilot mapping exists).

## 17. Test Strategy

### Unit tests

- Entitlement precedence and fail-closed behaviour.
- Schedule intervals, overnight hours, timezone, and exceptions.
- Open/closed/closes-soon badge derivation, including midnight boundaries, split service, and no-data state.
- Notification prune eligibility (age cap, per-user cap, read-first ordering).
- Reorder reconciliation mapping: available, repriced, modifier-conflict, and removed items.
- Dirty-form canonical comparison.
- CSV/BOM/delimiter/parser errors and XLSX serializers.
- Specials reorder and conflict rule.
- Pricing, modifiers, discounts, tax/fee rounding.
- Order/payment/POS state transitions.
- Idempotency keys and event normalisation.
- Loyalty earn/redeem/reverse.
- Consent eligibility and suppression.

### Component tests

- Notification bell/timeline/read states.
- Bell realtime insert, cross-tab read sync, and reconnect refetch.
- Public open/closed badge states.
- Item close confirmation for every close source.
- Spreadsheet format choices and errors.
- Drag ordering and keyboard controls.
- Patron cart/checkout conflicts.
- Reorder reconciliation view for each conflict outcome.
- QR pack rotation reprint warning.
- Live order board transitions and reconnect reload.
- Consent controls and unsubscribe state.

### RLS integration tests

- Patron owns only own profile, cart, orders, and payments.
- Restaurant roles see only authorised restaurant commerce data.
- Restaurant-scoped staff semantics remain intact.
- Public menu readers cannot mutate commerce data.
- Super-admin support operations are explicit and audited.
- New public-schema tables have correct grants plus RLS.
- Storage/secrets remain inaccessible to public clients.

RLS tests must target local Supabase unless deliberate remote override is approved.

### Transaction and concurrency tests

- Duplicate order submission.
- Concurrent last-item availability updates.
- Duplicate/out-of-order payment webhooks.
- Concurrent split allocations.
- Concurrent amount reservations, expiry, late capture, and reuse prevention.
- Anonymous-cart capability hijack, expiry, login claim, and post-claim replay.
- Coupon redemption limits.
- Loyalty retries and refund reversals.
- POS callback before/after push response.
- Outbox worker crash after provider success but before local acknowledgement.

### End-to-end tests

- Restaurant setup to table QR generation and printable pack download.
- Patron scan, login, cart, submit, pay, track, and history.
- Reorder from history through reconciliation to submitted order.
- Restaurant accept, prepare, ready, collect.
- Failed payment and retry.
- Refund.
- Split payment once phase launches.
- Global kill switch during open order.
- Organisation allow/deny override.
- Marketing opt-in, withdrawal, and suppression.
- Pilot sandbox scenarios.

### Compatibility tests

- Current supported Chrome plus Playwright WebKit/mobile viewport coverage. Real-device mobile Safari remains a release gate for QR scanning and auth continuity.
- Excel, WPS Office, and LibreOffice spreadsheet fixtures.
- QR scan and auth continuity on real mobile devices.
- Slow/reconnecting networks.

## 18. Observability and Operations

Track:

- Feature decision and denial reason.
- QR scan to cart conversion.
- Checkout completion and payment failure reason.
- Duplicate/idempotent request counts.
- Order age by fulfilment state.
- Restaurant acceptance/preparation latency.
- Provider webhook verification failures.
- Payment mismatch/reconciliation queue size.
- Outbox retry/dead-letter counts.
- POS delivery success/latency.
- Notification/email/SMS delivery failures.
- Consent withdrawals and marketing suppression failures.
- Loyalty ledger reconciliation differences.

Alerts:

- Confirmed allocations exceed payable total, or confirmed total equals payable total while order remains not paid.
- Paid order not delivered to restaurant/POS within threshold.
- Repeated webhook signature failures.
- Growing dead-letter queue.
- Tenant/RLS test regression in CI.
- Order intake enabled without payment/POS configuration where required.

## 19. Rollout Plan

1. Development mode, seeded fake payment/POS providers.
2. Internal organisation with synthetic orders.
3. One pilot organisation in non-monetary order-only mode.
4. One pilot restaurant with online whole-order payment.
5. Small multi-restaurant cohort.
6. Split-payment opt-in cohort.
7. Pilot POS cohort.
8. Commercial plan/bolt-on launch after support and unit economics are proven.

Every stage needs:

- Named owners and support contacts.
- Success/error thresholds.
- Rollback/kill-switch procedure.
- Open-order handling procedure.
- Data migration/backout plan.
- Feedback review before expanding cohort.

## 20. Decision Log

Product-owner decisions recorded 2026-07-22. Remaining open items listed at the end.

### Platform improvements

1. **Seat capacity - DECIDED: future bookings foundation.** Static informational number ships now, but the client intends reservations/live availability later. Field design must not paint us into a corner: keep restaurant-level `seat_capacity` informational, keep per-table `capacity` on `restaurant_tables`, and treat any future bookings feature as its own bounded context reading these fields - do not overload either field with availability semantics now.
2. **Operating hours - DECIDED: display now, enforce later.** Phase 1 ships hours as public information plus the open/closed badge. Order & Pay later enforces intake from the same structured data. No forever-display-only and no day-one enforcement.
3. **WPS reproduction - OPEN.** Awaiting partner's failing file, WPS build number, and OS locale. Phase 0 item.
4. **Specials conflict - DECIDED: customer-best price.** Drag order controls display position only. Where multiple specials apply to one item, the lowest valid final price is authoritative. Nobody ever pays more because of card ordering. Strict top-wins rejected.

### Order and Pay

5. **Patron auth - DECIDED: magic link plus optional account-holder enrolment.** First order uses low-friction email magic link/OTP, which already creates the permanent Auth identity and normal refresh-token session. Patrons may later add a password for cross-device sign-in and enrol in separately consented account-holder capabilities without changing `user_id`. Account holders become eligible for prize draws and loyalty programmes - signup incentive by value, not coercion. Ordering never requires marketing opt-in; draws/loyalty eligibility is consent-gated separately.
6. **Merchant of record - DECIDED: restaurant.** Each restaurant connects its own provider account; funds settle directly to the restaurant; Hungr never holds patron order funds. Forward-looking note: with future POS integration, payment may also be taken on the POS side (e.g. Pilot-driven payment) - the payment-provider adapter and payment-status model must treat "settled externally via POS" as a representable payment source, not an impossible state.
7. **First provider - DECIDED: evaluate all three in Phase 0.** Request API documentation, sandbox access, webhook/refund/settlement details from PayFast, Zapper, and SnapScan in parallel during Phase 0; select the Phase 4 launch provider from that comparison. No provider is pre-committed.
8. **Split meaning - DECIDED: custom amount.** Each guest pays a chosen amount until the total is covered; equal-split offered as a helper that prefills amounts. Item claiming, mixed tender, and settlement splitting deferred.
9. **Capture timing - DECIDED: per-restaurant setting; Phase 4 ships pay-first only.** Capture timing becomes a restaurant-level configuration so restaurants choose what they are comfortable with. Phase 4 implements only "pay before kitchen sees it"; the setting exists from day one with one selectable value. Accept-then-pay is added in a later phase with its own unpaid-limbo, nag, and expiry handling. Open tabs remain deferred.
10. **Tips/cash scope - DECIDED: tips in MVP checkout; audited manual-paid in scope; takeaway/delivery deferred.** Tips: percentage presets (10/15/20%) plus custom amount at payment, stored as a separate line in order totals and analytics, settling to the restaurant with the order funds. Manual settlement: staff can mark an order paid by cash/external terminal with actor and audit trail; reconciliation and analytics flag manual-paid orders distinctly. Service-charge policy still requires accounting advice.
11. **Items after partial payment - DECIDED: no.** First confirmed split payment locks the order total. Further rounds are new orders on the same table session. Reservation arithmetic stays simple; matches paper-bill behaviour.
12. **Money-action roles - DECIDED: managers and above move provider money; controlled staff mark-paid.** Organisation owner/admin and restaurant manager: refunds, paid-order rejection, and cancellations. Staff with restaurant access: accept, reject unpaid orders, and mark manual-paid within configured controls. Paid staff rejection enters `refund_required`. Every money action records initiating and approving actors where distinct. Super admin retains an audited support override.
13. **Specials at checkout - DECIDED: honour displayed prices before paid launch.** Existing customer-best specials enter the server-authoritative quote and immutable order snapshot before Phase 4. Phase 7 remains responsible for coupons, stacking, limits, reservations, and the general promotion engine.
14. **Modifier constraints for MVP - OPEN.** Define required/optional groups, min/max, and repeatability minimums during Phase 3 design against real pilot menus.
15. **Pilot override vs plan entitlement - PROPOSED DEFAULT.** Organisation `allow` override grants access regardless of plan (that is its purpose), supports optional expiry, and is audited. Confirm at Phase 2 design review.
16. **Open carts on global disable - PROPOSED DEFAULT.** Per section 4.5: new cart creation and checkout blocked with clear messaging; existing carts remain visible but cannot submit; open orders complete normally. Confirm at Phase 2 design review.
17. **QR presence - DECIDED: staff-activated sessions.** Static printed QR identifies the table; ordering works only while staff have an active time-limited session open for that table. Photographed codes are blocked while closed but remain reusable during a later active session, so staff activation narrows rather than eliminates remote abuse. Phase 3 design records pilot risk acceptance or adds stronger per-session proof, then sets session lifetime and per-table rate/value limits.

### Loyalty (decided early because it shapes patron accounts)

- **First programmes - DECIDED: digital stamps plus account-holder prize draws.** Stamp card (buy N qualifying items/orders, receive reward) is the core mechanic. Prize draws for enrolled account holders act as the incentive per decision 5. Legal note: South African prize draws are promotional competitions under CPA section 36 - competition rules, independent oversight of draws, winner records, and entry terms are required; add to the Phase 0 legal checklist alongside POPIA. Points-per-rand and visit rewards remain later options on the same ledger foundation.

### Pilot - OPEN (blocked on vendor contact)

18. Is Pilot or Hungr source of truth for menu, price, stock, status, tables, waiters, cancellation, and refunds?
19. Does Pilot support required modifiers, idempotency, signed callbacks, and reconciliation reads?
20. Does each restaurant location receive a distinct API key?
21. What sandbox certification and production onboarding does Pilot require?
22. Can payment be taken on the POS side, and how would POS-settled payment report back to Hungr (see decision 6 note)?

### POPIA and communications - OPEN (blocked on legal/vendor)

23. Confirm responsible-party/operator roles and contractual terms.
24. Confirm retention periods by data category.
25. Confirm lawful bases and notice versions for transactional and marketing channels.
26. Choose email/SMS providers, sender identities, unsubscribe/STOP handling, and abuse controls.
27. CPA section 36 promotional-competition compliance for prize draws (rules, oversight, winner records, entry terms).

## 21. Definition of Done for Each Phase

A phase is complete only when:

- Product decisions and acceptance criteria are documented.
- Schema migration exists; documentation baseline is not edited as a substitute.
- Generated database types are current.
- Grants and RLS policies are explicit and tested.
- Server and client enforce feature/access rules.
- Targeted unit, component, RLS, and E2E tests pass.
- Lint, type check, and production build pass for release candidates.
- CI recreates a clean database and runs schema-drift and tenant-boundary checks.
- Observability and audit events exist.
- Error, empty, retry, timeout, and disabled states are designed.
- Accessibility and mobile behaviour are verified.
- Data migration/backfill and rollback are documented.
- Support/admin tooling exists for financial or integration failures.
- Security and POPIA review is complete where personal/financial data changed.
- Runbook and release notes are updated.

## 22. Expected Code Areas

Exact files should be finalised in phase-specific design specs after current-code inspection.

Likely existing areas:

- `app/(dashboard)/restaurants/[restaurantId]/settings/`
- `app/(dashboard)/restaurants/[restaurantId]/reviews/`
- `app/(dashboard)/admin/settings/`
- `app/(dashboard)/admin/orgs/`
- `app/m/[restaurantSlug]/`
- `components/dashboard/NotificationBell.tsx`
- `components/menu/ItemEditSheet.tsx`
- `components/menu/BulkUploadModal.tsx`
- `components/menu/ExportMenuButton.tsx`
- `components/dashboard/SpecialsList.tsx`
- `components/dashboard/SpecialEditor.tsx`
- `lib/data/notification-actions.ts`
- `lib/data/review-actions.ts`
- `lib/menu/bulk-upload.ts`
- `lib/data/menu-actions.ts`
- `lib/data/special-actions.ts`
- `lib/billing/features.ts`
- `lib/data/platform-settings.ts`
- `supabase/migrations/`
- `tests/unit/`, `tests/components/`, `tests/rls/`, `tests/e2e/`

Likely new bounded areas:

- `app/(patron)/` or clearly separated patron routes.
- `app/api/webhooks/payments/[provider]/`
- `app/api/webhooks/pos/[provider]/`
- `components/orders/`
- `components/patron/`
- `lib/commerce/`
- `lib/payments/`
- `lib/pos/`
- `lib/loyalty/`
- `lib/consent/`
- `lib/notifications/`

Avoid generic modules that mix subscription billing with restaurant-order commerce.

## 23. Project Skills Added With This Roadmap

Future sessions should load relevant project skills from `.agents/skills/`:

- `hungr-roadmap-execution`: **start here every roadmap session** - loads `docs/ROADMAP_STATE.md` (the cross-session board of done and required steps), selects the next unblocked step, and enforces state updates at session end. Mirrored in `.claude/skills/` for Claude Code discovery.
- `hungr-project-workflow`: source precedence, planning format, repository map, and verification matrix.
- `hungr-next-ui-work`: Next.js 16 and current Hungr UI/component rules.
- `hungr-supabase-actions`: tenant-safe server actions, migrations, RLS, types, and database verification.

These complement existing `supabase` and `supabase-postgres-best-practices` skills. Restart OpenCode after adding or changing skills so new sessions load them.
