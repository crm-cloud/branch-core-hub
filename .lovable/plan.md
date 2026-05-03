## Goals

1. Show a richer payment breakdown on every invoice (Subtotal, Wallet Used, Discount, Total, Amount Paid, Remaining Balance).
2. Clarify Store Management — explain what "Store Orders" means and either populate it from member online purchases or hide if not applicable.
3. Fix the bug where cancelling a membership leaves its original unpaid invoice in "Pending Dues".

---

## 1. Invoice viewer — fuller breakdown

**File:** `src/components/invoices/InvoiceViewDrawer.tsx` (totals section, ~lines 230–275)

Today it shows: Subtotal → Discount → CGST/SGST → Total → Paid → Balance Due.

Add the following derived rows (only when value > 0):

- **Wallet Used** — parsed from `invoice.notes` (regex `/Wallet applied: ?₹?([\d.,]+)/i`). Falls back to a payments-table lookup for `payment_method = 'wallet'`. Show with a small "Wallet" badge.
- **Other Payment** — sum of non-wallet `payments.amount` for the invoice.
- **Amount Paid** — keep, relabel as "Total Paid" for clarity.
- **Remaining Balance** — `total_amount - amount_paid`. Hide when 0; tint red when > 0; show "Refunded" when total is negative.
- **Status pill** at the top of the totals card (Paid / Partial / Pending / Cancelled / Refunded) with matching color.

Apply the same enriched layout to `src/components/members/InvoiceDetailDrawer.tsx` so the member-facing view matches.

No DB migration needed — all data is already on `invoices`, `payments`, `invoice_items`.

---

## 2. Store Management page — clarity & data

**File:** `src/pages/Store.tsx`

Issues from screenshot:
- "Store Orders (0)" tab is empty and unexplained.
- Header "POS, products & online store overview" is vague.

Changes:
- Update header copy: **"In-store POS sales and member online store orders."**
- For the **Store Orders** tab:
  - Show an inline helper: *"Orders placed by members from their member portal/online store. POS counter sales appear in POS History."*
  - Currently the query filters invoices by `source IN ('member_store','ecommerce')` or notes containing `store purchase`. Verify by also widening the filter to invoices linked to `pos_sales.sale_type = 'online'` if such rows exist; otherwise keep the current filter and just show a clearer empty state with a CTA "Open Member Store".
- Add two small KPI chips inside the Store Orders tab: **Open Orders / Fulfilled Today**.
- Make the existing "Open POS" / "Manage Products" buttons in the hero card visually consistent (icon + label, indigo gradient secondary buttons).

No schema changes.

---

## 3. Cancelled membership leaves invoice in Pending Dues (BUG)

**Root cause (verified via DB):**
Memberships `INV-INC-26-0007` (₹10,800) and `INV-INC-26-0005` (₹4,000) — both linked to cancelled memberships — still have `invoices.status = 'pending'` and `amount_paid = 0`. The `public.cancel_membership` RPC (migration `20260502094706_…`) only writes a *negative refund invoice* when refund > 0; it never touches the original unpaid invoice.

**Fix — new migration** (recreate `cancel_membership`):

Inside the RPC, after marking the membership cancelled, add:

```sql
-- Void any unpaid/partially-paid original invoice tied to this membership
UPDATE public.invoices i
   SET status = 'cancelled',
       notes  = COALESCE(i.notes,'') ||
                E'\nCancelled with membership on ' || now()::date ||
                '. Reason: ' || p_reason
 WHERE i.id IN (
   SELECT ii.invoice_id
   FROM public.invoice_items ii
   WHERE ii.reference_id = p_membership_id
     AND ii.reference_type = 'membership'
 )
   AND i.status IN ('pending','partial','overdue')
   AND COALESCE(i.amount_paid,0) = 0;
```

For invoices that were already partially paid we **don't** auto-cancel — staff handles via the existing refund flow (`p_refund_amount`).

Also surface this in the UI:
- `src/components/members/MemberProfileDrawer.tsx` — in the Pay tab "Pending Dues" list, exclude invoices whose `status = 'cancelled'`.
- Show a small "Cancelled with membership" badge in Membership History → Invoices.

**Backfill** (one-shot, in the same migration):

```sql
UPDATE public.invoices i
   SET status = 'cancelled',
       notes = COALESCE(i.notes,'') || E'\nAuto-cancelled: linked membership cancelled.'
 WHERE i.status IN ('pending','partial','overdue')
   AND COALESCE(i.amount_paid,0) = 0
   AND EXISTS (
     SELECT 1 FROM public.invoice_items ii
     JOIN public.memberships m ON m.id = ii.reference_id
     WHERE ii.invoice_id = i.id
       AND ii.reference_type = 'membership'
       AND m.status = 'cancelled'
   );
```

This resolves Ryan Lekhari's two stuck pending dues immediately.

---

## Files to edit / create

- `src/components/invoices/InvoiceViewDrawer.tsx` — richer totals section
- `src/components/members/InvoiceDetailDrawer.tsx` — same breakdown for member view
- `src/pages/Store.tsx` — copy + helper + empty state + KPI chips
- `src/components/members/MemberProfileDrawer.tsx` — filter cancelled invoices from Pending Dues; "Cancelled with membership" badge
- New migration: recreate `public.cancel_membership` (auto-void unpaid invoices) + one-shot backfill

## Out of scope
- No payment-engine refactor. The `record_payment` RPC stays the source of truth.
- No changes to wallet ledger logic.
