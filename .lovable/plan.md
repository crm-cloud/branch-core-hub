## Production Hardening — P0.2 / P0.3 / P1.x

Score target after this wave: **8.0 → 8.7 / 10**

Findings reconciled with the codebase before planning:

- `record_payment`, `void_payment`, `reverse_payment`, `purchase_member_membership`, `assign_locker_with_billing`, `release_locker`, `purchase_pt_package` already exist as atomic RPCs and are correctly wired into the main drawers. The remaining non-atomic flows are: legacy `purchaseMembership()` in `membershipService.ts` (still exported, still used by `useMembership.ts`), `createManualInvoice` in `billingService.ts`, `createLockerInvoice` in `lockerService.ts`, and `CreateInvoiceDrawer`.
- `fetchTemplates(branchId?)`, `fetchCommunicationLogs(branchId?)`, and `fetchDevices(branchId?)` accept an **optional** branch argument and silently return all rows when omitted — this is the over-broadening fallback.
- `as any` is concentrated in `fitnessService` (12), `ptService` (11), `paymentService` (6), plus `lockerService`, `mipsService`, `storeService`, `billingService`.
- Six routes have no menu entry: `/admin-roles`, `/book-benefit`, `/employees`, `/equipment`, `/my-plans`, `/my-pt-sessions`.

---

### P0.2 — Atomicity for the remaining client-side multi-write flows

1. **Retire legacy `purchaseMembership()`**
   - Replace the body in `src/services/membershipService.ts` with a thin wrapper that calls `purchase_member_membership` RPC (same idempotency-key pattern as the drawer).
   - Update `src/hooks/useMembership.ts` to use the wrapper. Mark the old multi-write code path deleted.

2. **`create_manual_invoice` RPC** (new migration)
   - Accepts `p_branch_id`, `p_member_id`, `p_items jsonb[]`, `p_notes`, `p_due_date`. Inserts invoice + items in one transaction, returns `{ invoice_id, invoice_number }`.
   - Refactor `billingService.createManualInvoice` and `CreateInvoiceDrawer.tsx` to call it.

3. **Fold `createLockerInvoice` into `assign_locker_with_billing`**
   - `assign_locker_with_billing` already creates the GST invoice atomically. Delete `lockerService.createLockerInvoice` and update `useLockers.createInvoice` to call `assignLocker` (or expose a new `bill_locker_period` RPC if billing is for an existing assignment renewal).

4. **CI guard tightening**
   - Extend `.github/workflows/ci.yml` direct-write guard to include `invoice_items`, `locker_assignments`, and `membership_freeze_history` (currently miss invoice_items in some patterns).

### P0.3 — Fail-closed branch scoping

5. **Make `branchId` required on scoped reads**
   - In `communicationService.fetchTemplates`, `fetchCommunicationLogs`, `fetchMessages`; in `deviceService.fetchDevices`; in `biometricService` device queries — change signature from `(branchId?: string)` to `(branchId: string)` and remove the "no-filter when undefined" branch.
   - For Owner "All branches" mode, add an explicit `fetchAllTemplatesForOwner()` variant gated by an `is_owner()` SQL check. Non-owner callers that pass `undefined` will be a TypeScript error.

6. **RLS reinforcement (defense-in-depth)**
   - New migration: ensure RLS on `templates`, `communication_logs`, `messages`, `mips_devices`, `access_devices`, `biometric_sync_queue` enforces `is_branch_member(branch_id)` for non-owner roles (audit each policy and tighten where missing).

7. **UI fail-closed states**
   - When `currentBranch` is `null` for restricted roles, scoped pages must render the "Select a branch" empty state instead of issuing the unscoped query. Add an assertion helper `useRequiredBranch()` that throws into an ErrorBoundary if a restricted role lands on a scoped page without a branch.

### P1.1 — Route discoverability

8. **Menu topology audit**
   - Add menu entries: `/admin-roles` (under Settings → Access Control), `/employees` (HR), `/equipment` (Operations), `/book-benefit` + `/my-plans` (Member portal), and redirect `/my-pt-sessions` is already a `Navigate` so document it as intentional in `docs/route-topology.md`.
   - Generate a CI-checked `routes.json` from `App.tsx` and assert every authenticated route is either in the sidebar config or in an "intentional-hidden" allow-list.

### P1.2 — Reduce `as any` and silent failures (top-impact services)

9. **Type-safe pass on the 4 highest-impact services**
   - `paymentService`, `billingService`, `lockerService`, `biometricService`: replace `as any` with `Database['public']['Tables'][...]['Row']`/`Insert`/`Update` and the typed RPC return shapes.
   - Wrap each `console.error` in operational services with `reportError()` (the existing `log_error_event` helper) so silent failures show up in System Health.

### P1.3 — Session/branch context resilience

10. **Explicit fallback states**
    - Extend `useDrMode`, `useBranch`, and `useAuth` consumers to expose `{ status: 'loading' | 'ready' | 'unavailable', retry }` instead of `null`.
    - Use the new `<DataState>` component to render `unavailable` with a Retry button. Restricted roles default to "no access" rather than "all data" when context is `unavailable`.

---

### Migrations summary

```text
20260502_p02_atomic_writes.sql
  - create_manual_invoice(p_branch_id, p_member_id, p_items, p_notes, p_due_date)
  - bill_locker_period(p_assignment_id, p_months) [optional]
  - drop legacy: noop (purchaseMembership is client-side only)

20260502_p03_branch_rls_tighten.sql
  - tighten policies on templates, communication_logs, messages,
    mips_devices, access_devices, biometric_sync_queue using
    is_branch_member(branch_id)
```

### Files to edit (high-level)

```text
src/services/membershipService.ts        # legacy -> RPC wrapper
src/services/billingService.ts           # createManualInvoice -> RPC
src/services/lockerService.ts            # drop createLockerInvoice
src/services/communicationService.ts     # branchId required
src/services/deviceService.ts            # branchId required
src/services/biometricService.ts         # branchId required + types
src/services/paymentService.ts           # types + telemetry
src/hooks/useMembership.ts               # wire to wrapper
src/hooks/useLockers.ts                  # wire to assign_locker
src/hooks/useRequiredBranch.ts           # NEW assertion hook
src/components/invoices/CreateInvoiceDrawer.tsx  # RPC
src/components/layout/Sidebar.tsx        # menu entries (5 routes)
src/App.tsx                              # no route changes
docs/route-topology.md                   # NEW intentional-hidden list
.github/workflows/ci.yml                 # extend guard tables + routes assertion
```

### Out of scope for this wave

- `fitnessService` / `ptService` `as any` cleanup (largest counts) — scheduled for the next P1 follow-up to keep this PR reviewable.
- DR drill execution (operational, not code).
- Storage bucket policy tightening (separate security pass).

Ready to implement on approval.