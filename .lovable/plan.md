

# Fix Plan: PT Invoice Gap, Frozen Plan Display, Duration PT UI, Payment Links

## 1. CRITICAL: PT Package Purchase Creates No Invoice or Payment

**Root Cause:** The `purchase_pt_package` RPC creates `member_pt_packages` and `trainer_commissions` but never creates an `invoice` or `payment` record. The UI toast says "Invoice created automatically" — that's a lie.

**Fix — Update the DB function** to also:
- Insert into `invoices` (branch_id, member_id, total_amount, amount_paid = price_paid, status = 'paid', subtotal, due_date)
- Insert into `invoice_items` (description = 'PT Package - [name]', reference_type = 'pt_package', reference_id = member_package_id)
- Insert into `payments` (invoice_id, member_id, branch_id, amount = price_paid, payment_method = 'cash', status = 'completed')

This mirrors how membership purchases work. The RPC already has all the data it needs.

## 2. Frozen Membership — Show Plan Name + Days

**Current:** `MemberProfileDrawer.tsx` line 628 shows "FROZEN" text but doesn't display the plan name. The "Days Left" label doesn't change.

**Fix in MemberProfileDrawer.tsx:**
- Line 628: Change from just "FROZEN" to "FROZEN" with plan name subtitle
- Show frozen days remaining (query `membership_freeze_history` for active freeze, calculate end_date - today)
- Add plan name display: `activeMembership?.membership_plans?.name`

## 3. Duration-Based PT Shows "0/0" Sessions

**Current:** `PTSessions.tsx` line 359 shows `sessions_remaining/sessions_total` for all packages. Duration packages have 0/0 which is confusing.

**Fix in PTSessions.tsx line 359:**
```
// If duration-based (sessions_total === 0), show days remaining instead
{pkg.sessions_total > 0 
  ? `${pkg.sessions_remaining}/${pkg.sessions_total}` 
  : `${differenceInDays(new Date(pkg.expiry_date), new Date())}d left`}
```

Also fix the column header from "Sessions" to "Progress" and apply same logic in `PurchasePTDrawer.tsx` package selection badge.

## 4. Ad Banner Tab — Already Exists, Improve Visibility

The banner tab IS present at `Store.tsx` line 312. The `AdBannerManager` component works. The issue is likely that user expected it elsewhere or the tab isn't prominent enough.

**Fix:** No structural change needed. The banner management UI already works with upload, toggle, delete. Just ensure the `BannerManager` renders even when `selectedBranch === 'all'` by picking the first branch or showing a branch selector prompt.

## 5. Invoice Payment Link — Send Razorpay Link via WhatsApp/Email

**Current state:** 
- `InvoiceShareDrawer.tsx` sends text-only messages via WhatsApp/Email/SMS — no payment link
- `Invoices.tsx` line 288 "Send" dropdown item does nothing (no onClick handler)
- Razorpay integration exists (`create-payment-order` edge function)

**Fix:**
- Add a **"Send Payment Link"** button to `InvoiceViewDrawer.tsx` (next to "Record Payment")
- Create a new `SendPaymentLinkDrawer.tsx` that:
  - Shows invoice summary (total, paid, due)
  - Lets staff choose: Full Payment / Partial Amount / Due Amount
  - Generates a payment link URL (using the existing payment page route with invoice_id parameter)
  - Pre-fills WhatsApp message template with the payment link
  - Opens WhatsApp/Email with the link embedded
- Wire the "Send" action in `Invoices.tsx` to open this drawer
- The payment link points to a member-facing payment page that calls the `create-payment-order` edge function

## DB Migration

```sql
-- Update purchase_pt_package to create invoice + payment
CREATE OR REPLACE FUNCTION public.purchase_pt_package(...)
  -- Add invoice creation after member_pt_packages insert
  -- Add invoice_items for the PT package
  -- Add payment record
```

## Files to Change

| File | Change |
|------|--------|
| **DB Migration** | Update `purchase_pt_package` RPC to create invoice + invoice_items + payment |
| `src/components/members/MemberProfileDrawer.tsx` | Show plan name when frozen; show freeze days remaining |
| `src/pages/PTSessions.tsx` | Show days remaining for duration-based packages instead of "0/0" |
| `src/components/members/PurchasePTDrawer.tsx` | Show duration info in package selection badge |
| **NEW** `src/components/invoices/SendPaymentLinkDrawer.tsx` | Payment link generation + WhatsApp/Email sharing |
| `src/components/invoices/InvoiceViewDrawer.tsx` | Add "Send Payment Link" button |
| `src/pages/Invoices.tsx` | Wire "Send" dropdown action + add RecordPaymentDrawer + SendPaymentLinkDrawer |

## Execution Order
1. DB migration — fix `purchase_pt_package` to create invoices/payments
2. Frozen membership plan name + days display
3. Duration-based PT "days left" instead of "0/0 sessions"
4. Payment link drawer + invoice page wiring

