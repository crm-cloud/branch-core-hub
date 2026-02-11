

# Member Dashboard Audit: Fixes for Store Checkout, Requests, and RLS

---

## Issue 1: Store Checkout 403 Error (CRITICAL)

**Root Cause:** The `invoices` table RLS policies only allow INSERT for staff/admin/manager roles. Members have only a SELECT policy. When a member clicks "Place Order" in the store, the INSERT into `invoices` is blocked with a 403 Forbidden error. The same issue applies to `invoice_items` -- members cannot insert line items either.

**Fix:** Add two new RLS policies via a database migration:

```text
Policy 1: "Members can create store invoices"
  Table: invoices
  Operation: INSERT
  Condition: member_id matches the authenticated member's ID

Policy 2: "Members can create invoice items for own invoices"
  Table: invoice_items
  Operation: INSERT
  Condition: invoice_id belongs to an invoice owned by the authenticated member
```

Additionally, the `MemberStore.tsx` checkout code manually generates invoice numbers (line 95), but the database has a trigger (`generate_invoice_number`) that auto-generates them. The manual generation should be removed -- just pass `invoice_number: ''` and let the trigger handle it.

---

## Issue 2: Request Dialogs Use Dialog Instead of Sheet

**Current:** `MemberRequests.tsx` uses `<Dialog>` for both "Request Freeze" and "Request Trainer Change" forms. This violates the system-wide side-drawer policy.

**Fix:** Replace both `<Dialog>` components with `<Sheet>` (side drawer) components:
- Import `Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter` from `@/components/ui/sheet`
- Remove Dialog imports
- Convert both freeze and trainer change forms to right-side sheets
- Keep all form logic (state, mutation handlers) unchanged

---

## Issue 3: Member Store -- Additional Checkout Improvements

The checkout flow currently just creates an invoice and redirects to `/my-invoices`. For a better experience:
- After placing the order, show a success message with the invoice number
- The "Pay at the front desk" note is already there (good)
- No payment gateway integration needed for in-store pickup orders

---

## Files to Modify

| File | Change |
|------|--------|
| **Database migration** | Add INSERT policies for `invoices` and `invoice_items` for members |
| `src/pages/MemberRequests.tsx` | Replace Dialog with Sheet for freeze and trainer change forms |
| `src/pages/MemberStore.tsx` | Remove manual invoice number generation (let DB trigger handle it) |

---

## Technical Details

### Migration SQL

```text
-- Allow members to create invoices for themselves (store purchases)
CREATE POLICY "Members can create store invoices" ON public.invoices
  FOR INSERT TO authenticated
  WITH CHECK (
    member_id = public.get_member_id(auth.uid())
  );

-- Allow members to add items to their own invoices
CREATE POLICY "Members can create own invoice items" ON public.invoice_items
  FOR INSERT TO authenticated
  WITH CHECK (
    invoice_id IN (
      SELECT id FROM public.invoices
      WHERE member_id = public.get_member_id(auth.uid())
    )
  );
```

### MemberRequests.tsx Changes
- Replace `Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter` with `Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter`
- Change `side="right"` on SheetContent
- Rename state variables: `freezeDialogOpen` to `freezeSheetOpen`, `trainerDialogOpen` to `trainerSheetOpen`

### MemberStore.tsx Changes
- Line 95: Remove manual invoice number generation
- Pass empty string for `invoice_number` so the database trigger generates it automatically
