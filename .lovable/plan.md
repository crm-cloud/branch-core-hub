

# Discount Coupons Management Page

---

## Overview

A new **Discount Coupons** page under E-Commerce and Sales for admins/managers to create, edit, view usage analytics, and share coupons via broadcast. The page uses the existing `discount_codes` table and follows the Vuexy-inspired design with side drawers for create/edit.

---

## Page Layout

### Top Section: Stats Cards
Four stat cards showing:
- **Total Coupons** (active count)
- **Total Redemptions** (sum of `times_used`)
- **Active Coupons** (is_active = true and not expired)
- **Expired Coupons** (valid_until < today)

### Main Section: Coupons Table
A data table with columns:
- **Code** (bold, monospace styled)
- **Type** (percentage / fixed badge)
- **Value** (e.g., "20%" or "Rs 500")
- **Usage** (times_used / max_uses or "Unlimited")
- **Valid Until** (date with color coding: red if expired, amber if expiring within 7 days)
- **Status** (Active / Inactive / Expired badge)
- **Actions** (Edit, Share, Toggle Active)

Search bar + filter by status (All / Active / Expired / Inactive).

### Side Drawers
1. **Add Coupon Drawer** - Create new discount code with fields:
   - Code (auto-generate option + manual entry)
   - Discount Type (Percentage / Fixed Amount)
   - Discount Value
   - Minimum Purchase Amount
   - Maximum Uses (optional, blank = unlimited)
   - Valid From / Valid Until dates
   - Branch (optional, blank = all branches)
   - Active toggle

2. **Edit Coupon Drawer** - Same fields, pre-filled with existing data

3. **Coupon Detail Drawer** - Shows:
   - Coupon info summary
   - Usage history (who used it, when) -- uses `invoice_items` or `invoices` where the discount was applied
   - Share button that opens BroadcastDrawer with pre-filled coupon message

### Share via Broadcast
A "Share" button on each coupon row opens the existing `BroadcastDrawer` with a pre-filled message like:
> "Use code **SUMMER20** to get 20% off your next purchase! Valid until July 31."

---

## Database Changes

Add a `description` column and a `created_by` column to `discount_codes` for better tracking:

```sql
ALTER TABLE public.discount_codes
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);
```

No new tables needed -- the existing `discount_codes` table covers all requirements.

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/pages/DiscountCoupons.tsx` | **Create** | Main page with stats, table, search, filters |
| `src/components/coupons/AddCouponDrawer.tsx` | **Create** | Side drawer for creating new coupons |
| `src/components/coupons/EditCouponDrawer.tsx` | **Create** | Side drawer for editing existing coupons |
| `src/components/coupons/CouponDetailDrawer.tsx` | **Create** | Side drawer showing usage details + share button |
| `src/config/menu.ts` | **Edit** | Add "Discount Coupons" entry under E-Commerce and Sales |
| `src/App.tsx` | **Edit** | Add route `/discount-coupons` |

---

## Technical Details

### Menu Entry (menu.ts)
Add to `E-Commerce & Sales` section (after Store Orders):
```
{ label: 'Discount Coupons', href: '/discount-coupons', icon: Tags, roles: ['owner', 'admin', 'manager'] }
```

### Route (App.tsx)
```
import DiscountCouponsPage from "./pages/DiscountCoupons";
// In routes:
<Route path="/discount-coupons" element={<ProtectedRoute ...><DiscountCouponsPage /></ProtectedRoute>} />
```

### AddCouponDrawer
- Auto-generate code: random 8-char alphanumeric (e.g., `SAVE20XY`)
- Validation: code uniqueness check via DB query before insert
- Insert into `discount_codes` with `created_by: user.id`

### CouponDetailDrawer - Usage Tracking
Query invoices where `discount_code` matches the coupon code (the `MemberStore.tsx` checkout stores the applied discount info). Display a timeline of:
- Member name (from profiles via member)
- Date used
- Order total and discount amount

### Share Button
Opens `BroadcastDrawer` with `initialMessage` set to a formatted coupon promo message including code, value, and expiry.

### POS Integration
The POS page (`POS.tsx`) currently has no discount code input. Add a promo code field to the POS cart section (similar to MemberStore) so staff can apply coupons for walk-in customers. This reuses the same `discount_codes` table validation logic.

