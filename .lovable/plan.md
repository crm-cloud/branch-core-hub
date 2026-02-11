

# Member Dashboard Audit: Request History, Pay Invoice, and Button State Fixes

---

## Bug 1: Request History Shows "No requests yet" (CRITICAL)

**Root Cause:** Two issues combine to hide requests:

1. **`requested_by` is never set.** The INSERT mutations in `MemberRequests.tsx` do not include `requested_by: user.id`. The column defaults to NULL. The RLS SELECT policy requires `requested_by = auth.uid()`, so the member can never see their own requests -- the WHERE clause `NULL = auth.uid()` always evaluates to false.

2. **Wrong label mapping.** Trainer change requests are stored with `approval_type: 'complimentary'` (because `trainer_change` is not in the DB enum). The `getRequestTypeLabel` function checks for `'trainer_change'` which never matches the stored value.

**Fix:**
- Add `requested_by: user!.id` to both `submitFreezeRequest` and `submitTrainerChangeRequest` mutations.
- Fix `getRequestTypeLabel` to also check `reference_type` field (which IS set to `'trainer_change'`), or map `'complimentary'` with `reference_type === 'trainer_change'` to the correct label.

---

## Bug 2: "Request Trainer Change" Button Not Disabled When Pending

**Current:** The button has no disabled logic at all (line 230). It should be disabled when a pending trainer change request already exists.

**Fix:** Check `requests` array for any item with `reference_type === 'trainer_change'` and `status === 'pending'`. If found, disable the button and show "Request Pending" text.

---

## Bug 3: Pay Invoice Uses Dialog Instead of Side Drawer

**Current:** `MyInvoices.tsx` (line 265) uses `<Dialog>` for the payment flow. This violates the system-wide side-drawer policy.

**Fix:** Replace `Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter` with `Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter` (right-side drawer). Keep all payment logic (Razorpay + pay-at-desk options) unchanged.

---

## Bug 4: No Rewards Points Redemption

This is a **new feature** that does not currently exist in the system. The `wallet_transactions` and `loyalty_points` tables would need to be checked/created. This is out of scope for the current audit fix but noted for a future implementation pass.

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/MemberRequests.tsx` | Add `requested_by` to both mutations; disable trainer button on pending; fix label mapping |
| `src/pages/MyInvoices.tsx` | Replace Dialog with Sheet for pay invoice flow |

---

## Technical Details

### MemberRequests.tsx

```text
1. Both mutations: add `requested_by: user!.id` (get `user` from useAuth())
2. Trainer button: add `disabled` prop checking for pending trainer request
3. getRequestTypeLabel: use request object's reference_type when approval_type is 'complimentary'
   - Pass full request to label function, or check reference_type alongside approval_type
```

### MyInvoices.tsx

```text
1. Replace Dialog imports with Sheet imports
2. Rename payDialogOpen -> paySheetOpen
3. DialogContent -> SheetContent side="right"
4. DialogHeader/Title/Description/Footer -> Sheet equivalents
5. All payment logic stays identical
```

