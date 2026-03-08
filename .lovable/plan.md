

# Fix Plan: "All Branches" Empty Data, PT Notification, Pay Tab Dues

## Issue 1: "All Branches" Shows No Data

**Root cause:** When owner selects "All Branches", `branchFilter` returns `undefined` and `effectiveBranchId` returns the first branch's ID. However, in `PTSessions.tsx` line 48-49:

```ts
const branchId = effectiveBranchId || "";
const queryBranchId = branchFilter || branchId;
```

When `branchFilter` is `undefined`, it falls back to `effectiveBranchId` (first branch only) — so "All Branches" actually shows data for ONE branch, not all. But if `effectiveBranchId` is also undefined (no branches loaded yet), `queryBranchId` is `""` and `enabled: !!branchId` is `false` — no data at all.

This same pattern exists across many pages. The fix needs to happen at the **service layer** — when `branchId` is empty/undefined, omit the `.eq("branch_id", branchId)` filter.

**Fix approach:**
- Update `fetchPTPackages`, `fetchActiveMemberPackages` in `ptService.ts` to accept optional `branchId` — when undefined/empty, skip the branch filter
- Update `usePTPackages`, `useActiveMemberPackages` hooks to pass `branchFilter` (undefined for all) and always be enabled
- Update `PTSessions.tsx` to pass `branchFilter` directly (undefined = all branches)
- Apply same pattern to `useTrainers` hook call

## Issue 2: No Notification for PT Purchase

**Root cause:** The `purchase_pt_package` RPC function creates the package, commission, invoice, and payment — but never inserts into the `notifications` table. The `createNotification` service is only called for benefit bookings.

**Fix:** In the `PurchasePTDrawer.tsx` `handleSubmit` success path (after `purchasePT.mutateAsync`), call `createNotification` for the member with title "PT Package Purchased" and for admins/owner with "New PT Sale".

## Issue 3: Pay Tab — Show Pending/Partial Invoices with Pay Action

**Current state:** The Pay tab only shows completed `payments` records. It doesn't show **unpaid/partial invoices** that need action.

**Fix:** Add a section above the payment history that queries `invoices` where `status IN ('pending', 'partial', 'overdue')` for the member. Each invoice card shows total, paid, due amount, and a "Record Payment" button that opens the existing `RecordPaymentDrawer`.

## Files to Change

| File | Change |
|------|--------|
| `src/services/ptService.ts` | Make `branchId` optional in `fetchPTPackages` and `fetchActiveMemberPackages` — skip `.eq('branch_id')` when empty |
| `src/hooks/usePTPackages.ts` | Remove `enabled: !!branchId` guard, always enable queries |
| `src/pages/PTSessions.tsx` | Pass `branchFilter` (undefined for all) instead of `queryBranchId` |
| `src/components/members/PurchasePTDrawer.tsx` | Add `createNotification` calls after successful purchase |
| `src/components/members/MemberProfileDrawer.tsx` | Add pending invoices section in Pay tab with due amounts and "Record Payment" action |

## Execution Order
1. Fix "All Branches" data loading in PT service + hooks + page
2. Add PT purchase notifications
3. Add pending invoices with pay action in member profile Pay tab

