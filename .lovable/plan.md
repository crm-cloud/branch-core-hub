

# Fix: Freeze Not Applying + Member Checkout with Wallet/Promo Codes

---

## Issue 1: Freeze Approval Not Updating Membership (CRITICAL)

**Root Cause:** The approval handler in `ApprovalQueue.tsx` (line 171) reads `requestData.membershipId` (camelCase). However, the OLD freeze requests (submitted before the recent fix) stored the key as `membership_id` (snake_case). These old requests were approved but the membership update silently failed because `requestData.membershipId` was `undefined`.

Looking at the DB data:
- Arjun's two approved freeze requests have `request_data: { membership_id: "57c0968a..." }` (snake_case)
- His membership (id: `57c0968a...`) still shows `status: active`

**Fix (ApprovalQueue.tsx line 171):**
Change the membershipId extraction to handle both key formats:
```
const membershipId = requestData.membershipId || requestData.membership_id;
```
Apply this same fix at lines 171, 179, 184, and 212 -- everywhere `requestData.membershipId` is used.

**Data Fix:** Run a one-time SQL update to freeze Arjun's membership since the approval was already recorded:
```sql
UPDATE memberships SET status = 'frozen' WHERE id = '57c0968a-9e31-45cd-8576-2f26ec5fcede';
```

---

## Issue 2: Member Store Checkout Page with Wallet + Promo Codes

**Current State:** The store has a basic cart that creates an invoice and redirects to `/my-invoices`. No discount codes or wallet balance usage.

**Existing Infrastructure:**
- `wallets` table exists (balance, total_credited, total_debited)
- `wallet_transactions` table exists
- `referral_rewards` table exists (reward_value, is_claimed)
- `walletService.ts` has full credit/debit/payWithWallet functions
- `useWallet.ts` hook exists

**Plan:** Enhance the cart/checkout section of `MemberStore.tsx` to add:

1. **Promo/Discount Code Input:**
   - Add a text input + "Apply" button in the cart section
   - Create a new `discount_codes` table via migration with columns: `id, code, discount_type (percentage/fixed), discount_value, min_purchase, max_uses, times_used, valid_from, valid_until, is_active, branch_id`
   - Validate the code against this table (active, not expired, usage not exceeded, min purchase met)
   - Show discount line item in cart summary

2. **Wallet Balance Display & Usage:**
   - Show wallet balance in the cart section using `useWallet` hook
   - Add a toggle/checkbox: "Use Wallet Balance (Rs X available)"
   - Calculate: `finalAmount = cartTotal - discount - walletAmount`
   - On checkout, debit wallet first, then create invoice for remaining balance

3. **Referral Rewards Redemption:**
   - Check for unclaimed referral rewards for this member
   - Show available rewards with "Redeem" option
   - Redeeming credits the reward value to the wallet, then it can be used at checkout

---

## Files to Modify

| File | Change |
|------|--------|
| `src/pages/ApprovalQueue.tsx` | Fix membershipId extraction to handle both camelCase and snake_case |
| `src/pages/MemberStore.tsx` | Add wallet balance display, promo code input, discount calculation, wallet payment at checkout |
| **Database migration** | Create `discount_codes` table; fix Arjun's membership status |

---

## Technical Details

### ApprovalQueue.tsx Fix
At every occurrence of `requestData.membershipId` (lines 171, 179, 184, 212):
```
const membershipId = requestData.membershipId || requestData.membership_id;
```
Then use `membershipId` variable instead of `requestData.membershipId`.

### Migration SQL
```sql
-- Fix Arjun's stuck membership
UPDATE memberships SET status = 'frozen' WHERE id = '57c0968a-9e31-45cd-8576-2f26ec5fcede';

-- Create discount_codes table
CREATE TABLE public.discount_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  discount_type TEXT NOT NULL DEFAULT 'percentage' CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value NUMERIC NOT NULL DEFAULT 0,
  min_purchase NUMERIC DEFAULT 0,
  max_uses INTEGER,
  times_used INTEGER DEFAULT 0,
  valid_from DATE DEFAULT CURRENT_DATE,
  valid_until DATE,
  is_active BOOLEAN DEFAULT true,
  branch_id UUID REFERENCES branches(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE discount_codes ENABLE ROW LEVEL SECURITY;

-- Staff can manage discount codes
CREATE POLICY "Staff can manage discount codes" ON discount_codes
  FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['owner','admin','manager']::app_role[]));

-- Members can read active codes (for validation)
CREATE POLICY "Members can read active discount codes" ON discount_codes
  FOR SELECT TO authenticated
  USING (is_active = true);
```

### MemberStore.tsx Checkout Enhancements
Add to the cart section:
1. Wallet balance display (query via `useWallet(member.id)`)
2. Promo code input field with "Apply" button
3. Discount summary line (shows applied discount)
4. "Use Wallet Balance" checkbox with amount input
5. Updated total calculation: `Total - Discount - Wallet = Amount Due`
6. On place order: debit wallet amount, create invoice for remainder (or mark paid if fully covered)

