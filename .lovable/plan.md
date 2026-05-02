# Audit & Plan — Classes, Lockers, GST, Group Discounts

## Audit Findings

### 1. Classes & Class Bookings
**Current state:** `classes` table has no pricing fields (no `price`, `is_free`, `requires_benefit`). `book_class` RPC only checks capacity — any active member can book any class for free. There is no link between a class and `benefit_types` / `plan_benefits`. So today **every class is implicitly free for every active member** with no entitlement gating, no quota enforcement, and no charging path for paid/special classes.

**Gap:** No way to mark a class as "Group Class included in Plan A" vs "Special Workshop ₹500" vs "Trainer-led HIIT — 4 sessions/month included".

### 2. Lockers
**Current state:** Two separate paths exist but they don't talk to each other:
- `membership_plans.includes_free_locker` + `free_locker_size` → handled inside `purchase_member_membership` RPC (assigns a locker on plan purchase).
- `lockers.monthly_fee` + `assign_locker_with_billing` RPC → standalone paid rental with its own GST invoice.

There is **no `locker_access` benefit_type linkage**, no expiry sync between locker assignment and membership end_date, and no clear UI distinction between "free with plan" vs "paid add-on" in the assignment drawer.

### 3. GST on Memberships
**Current state:** `membership_plans.is_gst_inclusive = true` and `gst_rate = 18` exist on the plan, but the purchase drawer treats GST as an **opt-in toggle** (`includeGst` defaults to `false`). When unchecked, GST is simply not added — but the plan price already includes GST. So:
- GST-skip case: invoice shows the inclusive price with no tax breakup → fine for non-GST customers but **the gym still over-collects** because the inclusive 18% is buried in the price with no offset.
- GST-include case: GST is **added on top** of an already-inclusive price → double tax.

This is a real billing bug, not just a UX gap.

### 4. Group / Couple Discounts
**Current state:** `discount_codes` + `validate_coupon`/`redeem_coupon` RPCs exist, but they are single-member, single-invoice. There is no concept of a "group", no shared coupon per booking, no auto-split of a bulk discount across N members, and no way to record "these 4 members joined together → 15% off each."

---

## Proposed Plan

### Part A — Classes as Benefits (recommended: yes, route through Benefits)

1. **Schema additions to `classes`:**
   - `is_paid boolean default false`
   - `price numeric(10,2) default 0`
   - `gst_rate numeric default 18`, `is_gst_inclusive boolean default true`
   - `benefit_type_id uuid null` → links class to a bookable benefit (e.g. "Group Classes", "Yoga"); when set and member has quota, booking is free.
   - `requires_benefit boolean default false` → if true, members without the benefit can't book unless they pay `price`.

2. **Booking flow (`book_class` RPC v2):**
   ```text
   if class.benefit_type_id is set:
     if member has remaining benefit quota → consume quota, book free
     elif class.requires_benefit and not class.is_paid → reject
     else → create unpaid invoice for class.price, then book
   elif class.is_paid → invoice + book
   else → free book (legacy behaviour)
   ```

3. **UI:** Add Class drawer gets three toggles — *Free*, *Included in Benefit*, *Paid Workshop*. Member booking screen shows badge: "Included in your plan", "1 of 4 remaining this month", or "₹500 to book".

### Part B — Lockers: unify free vs paid via Benefits

1. **Create canonical `locker_access` benefit_type** (seeded per branch). Plans that include a free locker get a `plan_benefits` row with `benefit_type_id = locker_access` and a `description` holding the size.

2. **Deprecate `membership_plans.includes_free_locker` / `free_locker_size`** in favour of the benefit row (keep columns for one release as read-only, with a migration that backfills rows).

3. **`assign_locker_with_billing` v2:** accept `p_source: 'plan' | 'addon'`. When `'plan'`, set `p_chargeable=false`, sync `end_date` to membership end, skip invoice. When `'addon'`, current behaviour (monthly fee + GST invoice).

4. **UI:** Locker assignment drawer shows two tabs — "Included with Plan" (auto-picks size, no fee) and "Paid Rental" (monthly fee, billing months, GST). Member profile shows "Locker #12 — included with Premium plan, expires 31 Dec".

### Part C — GST Inclusive / Skip-GST handling (bug fix)

1. **Stop the double-tax.** Treat plan price as the **gross** (consumer-facing) price always. Compute taxable base on the fly:
   ```text
   if include_gst (B2B / customer wants tax invoice):
       taxable_base = price / (1 + gst_rate/100)
       gst_amount   = price - taxable_base
       invoice line: base + CGST/SGST split
       total = price (unchanged)
   else (skip GST / non-tax invoice):
       invoice line: lump-sum price, no tax breakup
       total = price (unchanged)
   ```
   Net result: **member pays the same ₹** in both cases; only the invoice presentation and the GSTR-1 reporting differs.

2. **Update `purchase_member_membership` RPC** to accept `p_include_gst` as a *presentation flag*, not a price-modifier. Apply same logic to `assign_locker_with_billing` and `create_manual_invoice`.

3. **Purchase drawer UX:**
   - Replace "Include GST" toggle with a clearer **"Invoice Type"** radio: *Tax Invoice (with GSTIN)* vs *Receipt (no GST breakup)*.
   - Total stays identical; only the breakdown card changes.
   - When *Tax Invoice* selected, require customer GSTIN field (optional for B2C tax invoices).

4. **Reporting:** GST report (GSTR-1 export) only pulls invoices with `gst_breakup_recorded = true`. Skip-GST invoices are excluded — accountant-clean.

### Part D — Group / Couple Discounts

1. **New table `member_groups`:**
   ```text
   id, branch_id, group_name, group_type ('couple'|'family'|'corporate'|'friends'),
   discount_type ('percentage'|'fixed'), discount_value, created_at, created_by, is_active
   ```
   With `member_group_members(group_id, member_id, role)` join table.

2. **Group purchase flow:** New "Group Purchase" drawer (Owner/Manager only) that:
   - Selects 2–N members already in the system (or registers them inline).
   - Picks a single plan (or per-member plans).
   - Applies group discount % once → auto-splits across each member's invoice.
   - Creates one `member_groups` row + one membership + one invoice per member, all sharing a `group_purchase_id` for reporting.

3. **Coupon extension (lighter alternative):** Add `discount_codes.is_group_coupon boolean` and `min_members int`. A code like `COUPLE15` only validates if redeemed with ≥2 member IDs in the same transaction. `redeem_coupon` accepts an array of member_ids and records N redemption rows sharing one `group_redemption_id`.

4. **Reporting:** Group revenue dashboard — total groups, avg group size, group-attributed MRR, retention vs. solo members.

---

## Technical Details

**Migrations:**
- `classes`: add `is_paid`, `price`, `gst_rate`, `is_gst_inclusive`, `benefit_type_id`, `requires_benefit`.
- New: `member_groups`, `member_group_members`, `group_purchases`.
- Backfill: convert `membership_plans.includes_free_locker=true` rows into `plan_benefits(benefit_type_id=locker_access)`.

**RPC changes:**
- `book_class` → quota-aware, paid-class-aware.
- `purchase_member_membership` → fix GST math (inclusive-base), accept `p_invoice_type`.
- `assign_locker_with_billing` → accept `p_source`, sync to membership end when `'plan'`.
- New: `purchase_group_membership(p_member_ids[], p_plan_id, p_group_discount, p_group_type, ...)`.
- `redeem_coupon` → optional `p_member_ids[]` for group coupons.

**UI files:**
- `src/components/classes/AddClassDrawer.tsx`, `EditClassDrawer.tsx` — pricing/benefit fields.
- `src/components/lockers/AssignLockerDrawer.tsx` — Plan vs Add-on tabs.
- `src/components/members/PurchaseMembershipDrawer.tsx` — Invoice Type radio replaces GST toggle.
- New: `src/components/members/GroupPurchaseDrawer.tsx`.
- New: `src/pages/MemberGroups.tsx` (under Members menu).
- Member booking UI shows entitlement badges.

**Phasing suggestion (4 separate turns):**
1. **Phase 1 (critical bug):** Fix GST inclusive double-tax in purchase + locker + manual invoice RPCs and the drawer UX.
2. **Phase 2:** Classes-as-benefits — schema + book_class v2 + Add/Edit drawer + member booking badges.
3. **Phase 3:** Lockers unification — `locker_access` benefit + assign drawer tabs + RPC source param.
4. **Phase 4:** Group/Couple discounts — `member_groups` + group purchase drawer + coupon extension.

Approve to start with **Phase 1 (GST fix)** since it's a live billing correctness issue, or tell me a different order.
