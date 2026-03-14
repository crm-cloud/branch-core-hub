

# Fix: Pending Dues Bug, System Health Clear, and Benefit Purchase Audit

## 1. Fix "No Pending Dues" Bug (Payments Page)

**Root cause found**: The `handleCollectFromDues` function (line 223) sets `selectedMember.id` to `undefined` instead of the actual member UUID from the invoice:

```js
// BROKEN (current)
id: invoice.members?.member_code ? undefined : null
```

The invoice object does not carry `member_id` in the destructured join — it only has `members(member_code, profiles)`. Because `id` is `undefined`, the `memberInvoices` query never fires (`enabled: !!selectedMember?.id` evaluates to false), so the drawer always shows "No pending dues."

**Fix**:
| File | Change |
|------|--------|
| `src/pages/Payments.tsx` | In the Dues Collection query (line 80), add `member_id` to the select fields. In `handleCollectFromDues`, set `selectedMember.id` to `invoice.member_id`. Also pre-select the invoice so the amount auto-fills correctly. |

The member search path should also be verified — when selecting from the dropdown, `search_members` returns `m.id` which is correct. No change needed there.

---

## 2. Add "Clear All Resolved" to System Health

**Current state**: No way to clear old errors. The page shows up to 200 logs with no bulk action.

**Fix**:
| File | Change |
|------|--------|
| `src/pages/SystemHealth.tsx` | Add a "Clear Resolved" button next to the source filter. On click, delete all `error_logs` where `status = 'resolved'`. Add confirmation dialog. Also add a "Resolve All Open" bulk action for convenience. |

---

## 3. Benefit Add-on Purchase: Invoice/Payment Gap

**Current state**: The `purchaseBenefitCredits` function in `benefitBookingService.ts` (line 463) inserts credits into `member_benefit_credits` but does **NOT** create an invoice or payment record. The `invoiceId` parameter is accepted but only stored as a reference — no invoice is auto-generated.

This means add-on purchases (Ice Bath, Sauna) bypass the financial system entirely — they don't appear in Payments, Finance, or Invoices.

**Fix**:
| File | Change |
|------|--------|
| `src/services/benefitBookingService.ts` | Update `purchaseBenefitCredits` to auto-generate an invoice and payment record when no `invoiceId` is provided. Insert into `invoices` (type: `benefit_addon`, status: `paid`), `invoice_items`, and `payments` tables. Use the package price from the fetched package data. |
| `src/components/benefits/PurchaseBenefitDrawer.tsx` | Pass `branchId` to the purchase mutation so the invoice can be scoped to a branch. After success, invalidate `['invoices']`, `['payments']`, and `['all-overdue-invoices']` query keys. |
| `src/hooks/useBenefitBookings.ts` | Update `usePurchaseBenefitCredits` mutation to accept `branchId` and invalidate financial query keys on success. |

---

## Execution Order

1. Fix the Payments "No pending dues" bug (immediate data flow fix)
2. Add "Clear Resolved" to System Health
3. Wire benefit purchase to invoices/payments

