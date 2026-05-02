# Production Hardening Plan — Path to "Error-Free"

Target: lift readiness from 6.8/10 → 9/10 by closing transactional, security, CI and performance gaps. Active/passive DR (V1) already shipped — this plan does **not** revisit it.

## Scope summary

```text
P0 (blockers, ~1 sprint)   →  Transaction atomicity, lint/CI gates, RLS hot-spots
P1 (1–2 sprints)           →  Branch-scoping audit, observability, perf budgets
P2 (background)            →  Bundle trim, test coverage, drill automation
```

---

## P0 — Release blockers

### 1. Transaction atomicity sweep
Audit every multi-write client path and convert to a single SECURITY DEFINER RPC with `BEGIN/EXCEPTION/ROLLBACK`. Reuse the proven `record_payment` pattern.

In-scope paths (verified missing or partial today):
- `purchase_pt_package` — three overloads exist; collapse to one canonical signature, deprecate the others.
- `purchase_member_membership` — wrap renewal + invoice + wallet credit + benefit grant in one txn.
- `assign_locker_with_invoice` / `assign_locker_with_billing` — pick one, drop the other.
- Refund / commission reversal — currently spread across services; introduce `reverse_payment(payment_id, reason)` RPC.
- Class attendance bulk mark — `mark_class_attendance` exists but client loop bypasses it in places; route all callers through it.
- Coupon flows already atomic (`validate_coupon` / `redeem_coupon`) — leave as is.

Client side:
- Every mutating service call must use `useStableIdempotencyKey` (already present, under-used). Enforce via lint rule (custom or grep-based pre-commit).

Acceptance: `rg "from\\('(invoices|payments|memberships|attendance|wallet_transactions|lockers)'\\)\\.(insert|update|delete)" src/services` returns zero results outside the corresponding service module.

### 2. Lint & CI quality gates
Today: `eslint.config.js` has most rules downgraded to `off`/`warn`; only one CI workflow exists (`dr-backup.yml`). No typecheck/lint/test gate on PRs.

Add `.github/workflows/ci.yml`:
- `tsc --noEmit`
- `eslint .` with re-promoted rules: `@typescript-eslint/no-unused-vars: error`, `no-explicit-any: error` (allow per-file overrides), `react-hooks/exhaustive-deps: error`.
- `bunx vitest run`
- Bundle-size check via `vite build` + `size-limit` (budget below).
- Supabase linter snapshot (fail on new ERRORs only, warn-allowlist for current 280 warns).

Block merges on red.

### 3. Database linter triage
Supabase linter reports 280 warnings, dominated by:
- ~270 `Signed-In Users Can Execute SECURITY DEFINER Function` (#0029)
- Several `Function Search Path Mutable` (#0011)
- 3+ `RLS Policy Always True` (#0024) on UPDATE/INSERT/DELETE
- 4+ `Public Bucket Allows Listing` (#0025)
- 1 `Extension in Public` (#0014)

Migration `20260502_lint_hardening.sql`:
- Add `SET search_path = public, pg_temp` to every `SECURITY DEFINER` function flagged.
- For each authenticated-callable SECURITY DEFINER function: either (a) `REVOKE EXECUTE … FROM authenticated; GRANT EXECUTE … TO authenticated` only on the small whitelist (`record_payment`, `book_facility_slot`, `validate_coupon`, `redeem_coupon`, `purchase_*`, `assign_locker_*`, `release_locker`, `mark_class_attendance`, `process_approval_request`, `log_error_event`, `is_dr_readonly`, `dr_is_operational`), or (b) move internal helpers to a private schema (`internal`) not exposed via PostgREST.
- Replace `USING (true)` write policies on the 3 flagged tables with proper `has_role(...)` or owner-scoped predicates.
- Tighten storage SELECT policies on the 4 public buckets to require either (a) signed URL access only, or (b) `owner = auth.uid()`.
- Move `pg_*` extensions out of `public` into `extensions` schema.

Acceptance: linter ERROR count = 0; warn count cut by ≥80%.

### 4. RLS hot-spot manual review
Linter cannot catch logic flaws. Review and add fixtures for:
- `invoices`, `payments`, `wallet_transactions` — confirm members cannot read other members' rows; managers limited to their `branch_id`.
- `attendance`, `staff_attendance` — same.
- `member_benefits`, `benefit_bookings` — confirm gender-locked facility rules enforced server-side, not just client.
- `dr_readiness_checklist`, `system_health_pings` — owner/admin only.

Add a `supabase/tests/rls/*.sql` directory with `pgTAP`-style assertions; runs in CI under three personas (owner, branch_manager, member).

---

## P1 — Reliability & posture

### 5. Branch scoping consistency audit
Only 5 of 35 service files reference `branch_id` filtering today. Some rely entirely on RLS, which is correct **only if** every table has a tight branch policy.

Action:
- Enumerate every table with a `branch_id` column; verify each has an RLS policy comparing it to `current_branch()` (or equivalent helper) for non-owners.
- Add a `current_branch()` SQL helper backed by `request.jwt.claims->>'branch_id'` (settable via session) so RPCs can defend in depth.
- Add integration test: a `branch_manager` of branch A querying branch B's invoices returns 0 rows.

### 6. Observability completeness
- Confirm `log_error_event` is called from every edge function `catch` block (current standard memory). Audit by `rg "catch.*\\{" supabase/functions` and grep for missing call.
- Add a `system_health_pings` dashboard row to `SystemHealth.tsx` showing last 24h success rate per probe.
- Wire `errorReporter.ts` to call `log_error_event` for unhandled React errors via an `ErrorBoundary` at `App.tsx`.

### 7. Performance & bundle health
- Establish budget: initial JS ≤ 350 KB gzip, route-chunks ≤ 120 KB.
- Code-split heavy routes already using `lazy()` — verify Three.js (`@react-three/*`), `jspdf`, `@emoji-mart/*`, `framer-motion` are not in the main chunk.
- Add `vite-bundle-visualizer` script and snapshot under `docs/perf/`.
- Convert any lingering `useEffect` data fetches to TanStack Query (project rule).

### 8. UX failure-state resilience
- Standardize empty / error / loading triplet via shared `<DataState>` component; refactor top-10 most-used tables to use it.
- Network-offline banner sibling to `DrBanner`.
- Toast-on-mutation-error wrapper around `useMutation` factory.

---

## P2 — Hygiene & drills

- Convert `scripts/dr/*.sh` smoke flow into a `dr-drill.yml` GitHub Action triggered manually + quarterly cron; auto-insert a row into `dr_drill_log`.
- Replace duplicate `purchase_pt_package` overloads (3 today) with one + migration to drop the others.
- Add `eslint-plugin-tailwindcss` to enforce Vuexy class ordering.
- Document the deprecated tables/columns memory in `docs/deprecated.md` and add a CI guard that fails if new code references them.

---

## Technical notes

**Custom CI lint rule (P0.1):**
```text
ban: from('invoices'|'payments'|'memberships'|...).insert/update/delete
allow only inside: src/services/{billing,payment,membership,...}Service.ts
implementation: simple ripgrep step in ci.yml
```

**Search-path migration template (P0.3):**
```sql
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) args
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.prosecdef
      AND NOT EXISTS (SELECT 1 FROM unnest(p.proconfig) c WHERE c LIKE 'search_path=%')
  LOOP
    EXECUTE format('ALTER FUNCTION %I.%I(%s) SET search_path = public, pg_temp',
                   r.nspname, r.proname, r.args);
  END LOOP;
END $$;
```

**RPC whitelist enforcement (P0.3):**
```sql
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM authenticated, anon;
GRANT EXECUTE ON FUNCTION public.record_payment(...)        TO authenticated;
GRANT EXECUTE ON FUNCTION public.book_facility_slot(...)    TO authenticated;
-- ...one GRANT per whitelisted RPC
```

---

## Deliverables checklist

- [ ] Migration: `lint_hardening` (search_path, revokes, RLS tightening, storage policies, extension move)
- [ ] Migration: `rpc_consolidation` (drop duplicate `purchase_pt_package` overloads, rename `assign_locker_*` to one canonical)
- [ ] New RPC: `reverse_payment`
- [ ] `.github/workflows/ci.yml` with tsc + eslint + vitest + bundle-size + supabase-linter snapshot
- [ ] `.github/workflows/dr-drill.yml` (P2)
- [ ] Re-promoted `eslint.config.js` rules
- [ ] `supabase/tests/rls/*.sql` persona suite
- [ ] `<DataState>` shared component + refactor of top-10 tables
- [ ] `ErrorBoundary` wired to `log_error_event`
- [ ] `docs/production-readiness.md` with go-live sign-off matrix

## Out of scope
- Active-active replication, automatic DB failover (explicitly deferred per DR V1 decision).
- Replacing TanStack Query, Shadcn, or any framework choice.
- New product features.

After P0 ships, re-score readiness; target ≥8.5/10 to declare production-ready, ≥9/10 after P1.