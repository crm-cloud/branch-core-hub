

# Operational Robustness & Premium Polish Plan

## Problem Summary

Three critical issues and several UX gaps across the codebase:

1. **Payment recording is duplicated in 4 places** — `billingService.recordPayment()`, `paymentService.recordManualPayment()`, `walletService.payWithWallet()`, and inline mutation in `Payments.tsx` (lines 96-121). Each independently calculates `amount_paid` and `status`, creating race conditions and inconsistency risks.

2. **Reminders work but are loosely structured** — the `send-reminders` edge function handles 7 reminder types in one monolith. No issues per se, but reminder types aren't easily configurable or extendable.

3. **Attendance, rewards, and invoice UX** have minor gaps — no loading skeletons in some places, inconsistent empty states, and the rewards/wallet systems are separate but overlapping concepts.

---

## Phase 1: Unify Payment Recording (Critical)

### 1A. Create `record_payment` Database Function (RPC)

A single SECURITY DEFINER function that atomically:
- Inserts into `payments`
- Updates `invoices.amount_paid` and `invoices.status`
- If wallet payment: validates balance, debits wallet, creates wallet transaction
- If fully paid: activates linked memberships
- Returns the payment record

This eliminates all 4 client-side implementations doing the same thing with subtle differences.

```sql
CREATE OR REPLACE FUNCTION public.record_payment(
  p_branch_id uuid, p_invoice_id uuid, p_member_id uuid,
  p_amount numeric, p_payment_method text,
  p_transaction_id text DEFAULT NULL, p_notes text DEFAULT NULL,
  p_received_by uuid DEFAULT NULL, p_income_category_id uuid DEFAULT NULL
) RETURNS jsonb ...
```

### 1B. Refactor Service Layer

- **`billingService.ts`**: `recordPayment()` calls the new RPC instead of doing manual inserts + updates
- **`walletService.ts`**: `payWithWallet()` calls the same RPC with `p_payment_method = 'wallet'`
- **`paymentService.ts`**: `recordManualPayment()` becomes a thin wrapper around `billingService.recordPayment()`
- **`Payments.tsx`**: Replace inline mutation (lines 96-121) with `billingService.recordPayment()`

### 1C. Void Payment Consistency

The void mutation in `Payments.tsx` (lines 150-170) doesn't reverse the invoice `amount_paid`. Create a `void_payment` RPC that atomically:
- Marks payment as voided
- Subtracts amount from invoice's `amount_paid`
- Recalculates invoice status (paid → partial → pending)
- If wallet payment: refunds wallet balance

---

## Phase 2: Invoice & Payment UX Improvements

### 2A. Invoices Page Polish
- Add proper empty state with illustration when no invoices
- Add invoice type icons (membership, PT, POS, manual)
- Show balance due prominently with color coding (green = paid, red = overdue, amber = partial)
- Add CSV export button

### 2B. Payments Page Polish
- Replace inline record-payment form with proper `RecordPaymentDrawer` component (already exists, just wire it)
- Add running total footer in payments table
- Better void confirmation with impact preview ("This will revert ₹X on invoice INV-XXX")
- Add proper loading skeleton

### 2C. RecordPaymentDrawer Improvements
- Show invoice line items summary before recording
- Pre-select income category based on invoice type
- Better wallet balance display with "Use Wallet" toggle

---

## Phase 3: Reminder System Hardening

### 3A. Add `reminder_types` Configuration
Add a `reminder_configurations` table so gym owners can toggle and customize reminder windows:

```sql
CREATE TABLE reminder_configurations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id uuid REFERENCES branches(id),
  reminder_type text NOT NULL, -- payment_due, membership_expiry, birthday, inactive_member, etc.
  is_enabled boolean DEFAULT true,
  days_before integer[], -- e.g. [7, 3, 1] for expiry
  channel text DEFAULT 'notification', -- notification, sms, whatsapp
  created_at timestamptz DEFAULT now()
);
```

### 3B. Update `send-reminders` Edge Function
- Read from `reminder_configurations` to determine which reminders are active per branch
- Use configured `days_before` arrays instead of hardcoded values
- Add summary logging for operational visibility

---

## Phase 4: Attendance UX Polish

### 4A. AttendanceDashboard Improvements
- Add proper skeleton loading for all tabs
- Better "no results" state for search
- Improve the rapid-entry search with keyboard navigation (arrow keys to select, Enter to check in)
- Show member photo larger in the flash confirmation

### 4B. Bulk Check-Out Enhancement
- Add confirmation dialog showing count of members to check out
- Show duration summary after bulk check-out

---

## Phase 5: Rewards & Wallet Consolidation

### 5A. Unified Points Display
- In `RewardsWalletCard`, show both reward points AND wallet balance side by side
- Add "Convert Points to Wallet Credit" action if configured
- Show combined transaction timeline (rewards + wallet) in member profile

### 5B. Redemption Improvements
- Make `RedeemPointsDrawer` show available redemption options from a configurable list
- Track redemption as both a rewards_ledger debit AND meaningful action (e.g., create a discount invoice, add wallet credit, extend membership)

---

## Files Modified/Created

| File | Action |
|---|---|
| DB Migration | `record_payment` RPC, `void_payment` RPC, `reminder_configurations` table |
| `src/services/billingService.ts` | Refactor `recordPayment` to use RPC |
| `src/services/walletService.ts` | Refactor `payWithWallet` to use billing RPC |
| `src/services/paymentService.ts` | Deprecate `recordManualPayment`, forward to billing |
| `src/pages/Payments.tsx` | Use shared service, improve UX, add skeleton |
| `src/pages/Invoices.tsx` | Better empty states, balance display, CSV export |
| `src/components/invoices/RecordPaymentDrawer.tsx` | Invoice summary, income category auto-select |
| `supabase/functions/send-reminders/index.ts` | Read from reminder_configurations |
| `src/pages/AttendanceDashboard.tsx` | Skeleton, keyboard nav, better flash |
| `src/components/members/RewardsWalletCard.tsx` | Unified points + wallet view |
| `src/components/members/RedeemPointsDrawer.tsx` | Configurable redemption options |

## Implementation Order

1. `record_payment` and `void_payment` RPCs (database migration)
2. Service layer refactor (billingService, walletService, paymentService)
3. Payments.tsx and Invoices.tsx UX improvements
4. RecordPaymentDrawer improvements
5. `reminder_configurations` table + send-reminders update
6. Attendance UX polish
7. Rewards/wallet consolidation

