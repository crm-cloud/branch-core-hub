# P4 — Application-Layer Scoping & Transaction Semantics

The remaining risk is **not** in RLS primitives — those are solid. It's in three application-layer patterns:

1. **Branch scoping is client-applied** (`.eq('branch_id', branchFilter)` in 100+ call sites). A bug, missing filter, or compromised client could leak cross-branch data even with RLS passing.
2. **A few sensitive writes still bypass server RPCs** (e.g. `CancelMembershipDrawer` inserts `payments` directly; refund / cancel paths not all routed through `record_payment` / `reverse_payment`).
3. **Role gating is ad-hoc** (`hasAnyRole(['owner','admin'])` repeated across pages with slight variations) — easy to drift, hard to audit.

This wave makes the **server** the source of truth for branch scoping, transaction atomicity, and role policy — not the client.

---

## 5.1 Server-enforced branch scoping

**Problem:** RLS today permits a privileged user (owner/admin/manager) to read any branch they have access to. The actual "current branch" filter is applied in the client. Forgetting `.eq('branch_id', X)` silently widens reads.

**Plan:**
- Add `app.current_branch_id` GUC support via two new SECURITY DEFINER RPCs:
  - `set_active_branch(p_branch_id uuid)` — validates membership in `user_branch_assignments` (or owner role), sets a session-local GUC.
  - `clear_active_branch()` — for owners viewing "All branches".
- Augment RLS policies on the high-value tables (`members`, `memberships`, `invoices`, `payments`, `member_benefits`, `attendance`, `wallet_transactions`, `whatsapp_messages`, `communication_logs`) with an **additional** branch predicate:
  ```
  (current_setting('app.current_branch_id', true) IS NULL
     OR branch_id::text = current_setting('app.current_branch_id', true))
  ```
- Owners can opt out by clearing the GUC; managers/staff cannot — we additionally enforce `branch_id = ANY(get_user_branch_ids(auth.uid()))` for non-owner roles via existing `has_role`.
- `BranchContext` calls `set_active_branch` whenever the user switches branches; `supabase` client `onAuthStateChange` re-applies on session refresh.
- Frontend `.eq('branch_id', …)` filters become **defense in depth**, not the only line.

**Outcome:** A missing client filter no longer leaks data. Cross-branch access requires explicit GUC clearing by an owner.

## 5.2 Eliminate remaining direct financial writes

Audit located one outstanding direct insert and gaps in cancel/refund:

- `src/components/members/CancelMembershipDrawer.tsx:129` writes to `payments` directly — must route through `record_payment` (positive refund leg via `reverse_payment`).
- New RPC `cancel_membership(p_membership_id, p_reason, p_refund_amount, p_refund_method, p_idempotency_key)`:
  - Single txn: status → `cancelled`, `cancelled_at = now()`, optional `reverse_payment` for refund leg, lifecycle transition, `pg_notify('membership_cancelled', …)`.
- New RPC `freeze_membership(p_membership_id, p_freeze_days, p_reason)` to mirror `purchase_membership` semantics; existing client code that mutates `freeze_*` fields directly switches to RPC.
- CI guard extended (regex in `.github/workflows/ci.yml`): block direct `from('payments').insert` / `from('memberships').update` outside `src/services/membershipService.ts` and edge functions.

## 5.3 Centralize role policy

**Problem:** `hasAnyRole(['owner','admin'])` vs `['owner','admin','manager']` vs raw `roles.includes('staff')` scattered across 60+ files.

**Plan:**
- New `src/lib/auth/permissions.ts` exporting named capabilities:
  ```
  can.viewFinancials, can.manageStaff, can.recordPayment,
  can.bookFacility, can.approveDiscount, can.crossBranchView, ...
  ```
- Each capability is a pure function `(roles, context) => boolean`. Single source of truth; matches an authoritative table in the same file.
- Mirror table on the server: `public.permissions(role app_role, capability text)` populated by migration; `has_capability(_user_id, _capability)` SECURITY DEFINER function for RLS / RPC use.
- Codemod existing `hasAnyRole([...])` call sites to `can.X(roles)`. ESLint rule (custom) flags raw role-array checks outside `permissions.ts`.

## 5.4 RLS audit & monotonic policy tests

- Add `supabase/tests/rls/` with pgTAP-style assertions runnable in CI:
  - For each role × table × operation, assert expected pass/fail with synthetic JWTs.
  - Specifically cover the cross-branch leak class (manager of branch A trying to SELECT branch B rows).
- One-off Supabase linter pass + `security--run_security_scan`; document accepted exceptions in `mem://security/security-memory`.
- Add `policy_audit` view: lists every table, RLS enabled flag, policy count per command — surfaced in `SystemHealth` for owners.

## 5.5 Transaction-semantics regressions catcher

- Postgres `event trigger` on `ddl_command_end` rejects new tables in `public` without RLS enabled (already partially in place — extend to also require at least one SELECT policy).
- Migration linting script in CI: greps new migrations for `CREATE TABLE public.` and asserts a matching `ENABLE ROW LEVEL SECURITY` + policy block.
- For service-role edge functions, add a shared `assertBranchScopedQuery(query, branchId)` wrapper used by sensitive functions (`reconcile-payments`, `process-whatsapp-retry-queue`, `notify-booking-event`) so server-side code also can't accidentally run cross-branch.

---

## Files / artifacts

```text
supabase/migrations/<ts>_p4_app_layer_hardening.sql
  ├─ set_active_branch / clear_active_branch RPCs + app.current_branch_id GUC
  ├─ RLS additive predicate on 9 high-value tables
  ├─ permissions table + has_capability() function
  ├─ cancel_membership() + freeze_membership() RPCs
  ├─ event trigger: require_rls_on_new_public_tables
  └─ policy_audit view

supabase/tests/rls/
  ├─ cross_branch_isolation.sql
  ├─ role_capability_matrix.sql
  └─ rpc_idempotency.sql

src/
  ├─ lib/auth/permissions.ts            (capability registry)
  ├─ contexts/BranchContext.tsx         (call set_active_branch on switch)
  ├─ services/membershipService.ts      (cancel_membership / freeze_membership)
  ├─ components/members/CancelMembershipDrawer.tsx  (use RPC, drop direct insert)
  └─ pages/SystemHealth.tsx             (+ PolicyAuditCard)

.github/workflows/ci.yml
  ├─ migration-linter step (RLS required)
  └─ extended direct-write regex guard (memberships/payments outside services)

mem://security/security-memory          (refresh: branch GUC model + accepted exceptions)
mem://architecture/p4-app-layer-hardening  (new)
```

## Out of scope
- Rewriting working RLS on tables that already have correct branch + role policies (we only **add** the GUC predicate).
- Changing the existing `purchase_membership` / `record_payment` / `dispatch-communication` contracts — they are the reference pattern this wave extends to cancel/freeze.
- New UI surfaces beyond a `PolicyAuditCard` on SystemHealth.

## Outcome
- Cross-branch leakage requires an owner explicitly clearing the active branch GUC; client-side filter omissions are no longer sufficient.
- Every membership/payment state transition is a single server RPC with idempotency + audit.
- Role policy lives in **one** TS file and **one** SQL table; drift becomes a compile/CI failure.
- Readiness target moves from **9.6 → 9.8**, with the remaining 0.2 covering load testing & DR drills (separate wave).