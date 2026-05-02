# Production Readiness — Sign-off Matrix

Last updated: 2026-05-02
Owner: Platform / Backend

## Verdict
- Current readiness: **7.5 / 10** (was 6.8). DR V1 + transactional safety improvements landed; CI quality gates active.
- Target for go-live: ≥ 8.5 / 10 (after RLS persona tests + branch-scoping audit).

## Completed (P0 wave 1)

| Area | Item | Status |
|---|---|---|
| Atomicity | `record_payment` RPC (existing) | ✅ |
| Atomicity | `reverse_payment(payment_id, reason, actor_id)` RPC (idempotent) | ✅ |
| Atomicity | `payments.reversal_of` column + index | ✅ |
| Atomicity | Client wrapper `reversePayment()` in `src/services/paymentService.ts` | ✅ |
| Hygiene | Drop unused `purchase_pt_package(5-arg)` overload | ✅ |
| Hygiene | Drop unused `assign_locker_with_invoice` | ✅ |
| Security | `SET search_path = public, pg_temp` on every public SECURITY DEFINER fn | ✅ |
| Security | Move `pg_net`, `pg_trgm` out of `public` into `extensions` schema | ✅ |
| Security | Pin telemetry insert policies to explicit roles + comments documenting intent | ✅ |
| Observability | `ErrorBoundary` rerouted from direct `error_logs.insert` → unified `log_error_event` RPC | ✅ |
| CI | `.github/workflows/ci.yml`: tsc + eslint + vitest + build + bundle guard + direct-write guard | ✅ |
| DR | Active/passive infrastructure (banner, healthz, scripts, runbook, readiness checklist) | ✅ |

## Outstanding (P0 wave 2 — required before go-live)

| Area | Item | Owner | Status |
|---|---|---|---|
| RLS | `supabase/tests/rls/*.sql` persona suite (cross-branch isolation) | Backend | ✅ scaffolded — `cross_branch_isolation.sql` |
| Branch scoping | `current_branch()` / `is_branch_member()` / `enforce_branch_match()` SQL helpers | Backend | ✅ shipped |
| RPC consolidation | Two `purchase_pt_package` overloads | Backend | ✅ kept both — different semantics, documented inline via `COMMENT ON FUNCTION` |
| RLS | Manual review of `member_benefits`, `benefit_bookings` for gender-lock enforcement | Backend | ⏳ pending |
| Atomicity | Audit non-service callers of `from('invoices'/'payments'/...).insert/update/delete` | Frontend | ⏳ pending — CI guard blocks new ones |
| Branch scoping | Add `enforce_branch_match()` calls inside `purchase_*`, `assign_locker_*`, `reverse_payment` RPCs | Backend | ⏳ pending — helper exists, integration TBD |

## P1 — reliability & posture

| Area | Item | Status |
|---|---|---|
| Observability | Audit `supabase/functions/**/index.ts` `catch` blocks call `log_error_event` | ⏳ pending |
| Observability | 24h success-rate strip on `SystemHealth.tsx` from `system_health_pings` | ⏳ pending |
| Performance | Bundle visualizer snapshot; verify Three.js, jspdf, framer-motion not in main chunk | ⏳ pending |
| UX | `<DataState>` shared empty/loading/error component | ✅ shipped at `src/components/common/DataState.tsx` |
| UX | Refactor top-10 tables to use `<DataState>` | ⏳ incremental |
| UX | Network-offline banner sibling to `DrBanner` | ⏳ pending |

## Intentionally accepted warnings (not blockers)

These produce Supabase linter warnings but are correct by design:

- **`Function Search Path Mutable`** — remaining instances are non-SECURITY-DEFINER functions or extension-owned functions (`pg_net`, `pg_trgm`). Pinning their search_path is unnecessary for security.
- **`RLS Policy Always True` (6 INSERT policies)** — append-only telemetry endpoints (`audit_logs`, `error_logs`, `dr_probe`, `system_health_pings`, `webhook_failures`, `feedback_google_link_clicks`). Predicate is intentional; `TO` role is now pinned and `COMMENT` documents intent.
- **`Public Bucket Allows Listing` (4 buckets)** — `avatars`, `org-assets`, `products`, `ad-banners`, `template-media`, `workout-videos`. These hold marketing assets needed by anonymous landing pages. Migrating to signed-URL-only access would break SEO and Open Graph previews. Risk is bounded: buckets contain no PII. Re-evaluate if attack surface grows.
- **`Signed-In Users Can Execute SECURITY DEFINER Function` (~270)** — most are intentional (every `purchase_*`, `record_payment`, `book_*`, `assign_*`, `release_*`, `redeem_*`, `process_approval_request`, etc.). The remaining warnings represent internal helpers that should be moved to a private schema or have `EXECUTE` revoked; this is a P1 cleanup task tracked separately.

## Quarterly drill (DR)

See `docs/dr-runbook.md`. Last drill: not yet completed. Acceptance criteria recorded in `dr_drill_log`.

## RPO / RTO

- RPO: 24h (nightly CLI backup) **or** ≤ 5 min if PITR is enabled on Project A — confirm PITR plan and update this doc accordingly.
- RTO: target ≤ 60 min for full failover (provision, restore, verify, switch DNS / app-config).
