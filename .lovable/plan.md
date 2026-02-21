

# Fix: Ghost Bookings, Benefits Tab UI, and Top-Up Workflow

## Issue 1: Ghost Bookings in Admin "All Bookings" (CRITICAL)

**Root Cause Confirmed:** Two problems found in `ConciergeBookingDrawer.tsx`:

1. **Raw INSERT bypasses enforcement** (line 201-208): The `handleBookSlot` function does a raw `supabase.from('benefit_bookings').insert(...)` instead of using the `book_facility_slot` RPC. This means:
   - No benefit limit enforcement
   - No `benefit_usage` record written
   - No duplicate guard
   
2. **No query invalidation after booking**: After a successful concierge booking, the drawer calls `onOpenChange(false)` but never invalidates the `all-benefit-bookings` query. The All Bookings page still shows stale cached data (0 bookings) until a manual refresh.

**Fix:**
- Replace the raw INSERT in `handleBookSlot` with `supabase.rpc('book_facility_slot', {...})` (same as member booking page)
- When `forceAdd` is checked, keep the raw insert as override but still write `benefit_usage`
- Accept an `onSuccess` callback prop to invalidate queries from the parent (`AllBookingsPage`)
- In `AllBookingsPage`, pass `onSuccess` that invalidates `['all-benefit-bookings']` and `['all-class-bookings']`

**Files:** `src/components/bookings/ConciergeBookingDrawer.tsx`, `src/pages/AllBookings.tsx`

---

## Issue 2: Benefits Tab - No Used/Remaining, No Progress Bars

**Root Cause:** In `MemberProfileDrawer.tsx` line 78, the `BenefitsUsageTab` hardcodes `used: 0` and `remaining: b.limit_count`. It never queries actual usage from `benefit_usage` or `benefit_bookings`.

**Fix:** Update the `BenefitsUsageTab` component to:
- Query `benefit_usage` grouped by `benefit_type_id` to get actual used counts
- Also query `benefit_bookings` (active) to include booked-but-not-yet-used sessions
- Compute `remaining = limit_count - used` (or "Unlimited" for unlimited benefits)
- Add visual progress bars (green when remaining > 0, red when 0, blue/infinity for unlimited)
- Color-code each entitlement row:
  - Green border/accent: has remaining sessions
  - Red/alert: 0 remaining
  - Blue with infinity icon: unlimited
- Show "Recent Usage" with booking details: facility name, date, time slot, status (Booked/Attended/Cancelled) by joining `benefit_bookings` with `benefit_slots` and `facilities`

**File:** `src/components/members/MemberProfileDrawer.tsx` (the `BenefitsUsageTab` function, lines 32-167)

---

## Issue 3: Top-Up / Add-On Purchase Workflow (New Feature)

**Current state:** When a member exhausts their benefit sessions (e.g., 2/2 Ice Bath used), there is no way to purchase additional sessions. The system just blocks further bookings.

**Implementation:**

### Admin Side (Member Profile > Benefits Tab):
- Add a "+ Top Up" button next to each limited benefit that has 0 remaining
- Opens a drawer with: benefit name, quantity input, price input
- On submit:
  1. Creates an `invoice` for the top-up amount (status: pending)
  2. Inserts a `member_benefit_credits` record (or updates `plan_benefits` allocation)
  3. The additional credits are checked during `book_facility_slot` RPC

### Member Side (Booking Page):
- When `book_facility_slot` returns "Benefit limit reached", show a user-friendly message with a "Buy More" button
- The "Buy More" button navigates to `/my-benefits` or opens the existing `PurchaseBenefitDrawer`

**New file:** `src/components/benefits/TopUpBenefitDrawer.tsx`
**Modified files:** `src/components/members/MemberProfileDrawer.tsx`, `src/pages/MemberClassBooking.tsx`

---

## Issue 4: Invoice "-10000" display (Minor Polish)

From the screenshots, the Pay tab shows "Rs -10,000" which looks like a refund/credit note but is confusing. This is existing data and not a code bug, but the display should clarify negative amounts as "Refund" or "Credit Note".

**File:** `src/components/members/MemberProfileDrawer.tsx` (Pay tab section)

---

## Files Summary

| Priority | File | Change |
|----------|------|--------|
| 1 | `src/components/bookings/ConciergeBookingDrawer.tsx` | Use `book_facility_slot` RPC instead of raw INSERT; add `onSuccess` callback for query invalidation |
| 1 | `src/pages/AllBookings.tsx` | Pass `onSuccess` to ConciergeBookingDrawer that invalidates booking queries |
| 2 | `src/components/members/MemberProfileDrawer.tsx` | Compute real used/remaining counts; add progress bars with color coding; improve Recent Usage to show booking details with facility/time/status; add Top-Up button; polish Pay tab negative amounts |
| 3 | `src/components/benefits/TopUpBenefitDrawer.tsx` | New drawer: select benefit, enter qty + price, creates invoice + credits |
| 3 | `src/pages/MemberClassBooking.tsx` | Show "Buy More Sessions" prompt when limit reached error is returned |

---

## Technical Details

### Concierge RPC Integration
```typescript
// Replace raw insert with RPC call
const { data, error } = await supabase.rpc('book_facility_slot', {
  p_slot_id: slotId,
  p_member_id: selectedMember.id,
  p_membership_id: membership.id,
});
const result = data as { success: boolean; error?: string };
if (!result.success && !forceAdd) {
  toast.error(result.error);
  return;
}
// Force-add fallback: raw insert only when override is checked
```

### Benefits Progress Bar Logic
```typescript
// For each plan benefit:
const usedCount = usageRecords
  .filter(u => u.benefit_type_id === benefit.benefit_type_id)
  .reduce((sum, u) => sum + (u.usage_count || 1), 0);
const remaining = benefit.limit_count ? Math.max(0, benefit.limit_count - usedCount) : null;
const progressPct = benefit.limit_count ? (usedCount / benefit.limit_count) * 100 : 0;
// Color: remaining === 0 -> red, unlimited -> blue, else green
```

### Recent Usage from Bookings
```sql
SELECT bb.*, bs.slot_date, bs.start_time, bs.end_time, f.name as facility_name
FROM benefit_bookings bb
JOIN benefit_slots bs ON bs.id = bb.slot_id
LEFT JOIN facilities f ON f.id = bs.facility_id
WHERE bb.member_id = ? AND bb.membership_id = ?
ORDER BY bs.slot_date DESC, bs.start_time DESC
LIMIT 20
```

