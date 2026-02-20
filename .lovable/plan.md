
# Critical System Audit: Benefit Enforcement, Booking UI, RBAC & Invoice Fix

## What the Audit Found

### Issue 1: Benefit Overbooking (CRITICAL — Confirmed)
The database proves the problem. Kuldeep's plan allows 2 Ice Bath sessions (`limit_count: 2, frequency: per_membership`) but has **8 active bookings** for Ice Bath and **3 for Sauna Room F** (limit 2). 

**Root Cause:** The `bookSlot` mutation in `MemberClassBooking.tsx` is a raw `INSERT` into `benefit_bookings` with zero enforcement:
```typescript
// Current broken code — NO limit check
await supabase.from('benefit_bookings').insert({ slot_id, member_id, membership_id, status: 'booked' });
```
There is no database-level constraint, trigger, or RPC that validates benefit usage before inserting. The `benefit_usage` table is **empty** for this member — bookings are counted in `benefit_bookings` but never written to `benefit_usage`, so the entitlement widget is reading from the wrong place.

**The Fix:**
1. Create a `book_facility_slot` SECURITY DEFINER RPC in a database migration that:
   - Checks if member already has an active booking at the same slot (duplicate guard)
   - For `per_membership` benefits: counts existing `benefit_bookings` for the same `benefit_type_id` in the membership period and enforces `limit_count`
   - For `monthly/weekly/daily` benefits: counts within the current period
   - Throws a user-friendly error if limit exceeded: `"Ice Bath limit reached (2/2). Please purchase an add-on."`
   - Inserts the booking AND writes to `benefit_usage` atomically (so the entitlement widget shows correct counts)
   - Also handles cancellation refund by decrementing `benefit_usage` on status update
2. Replace the raw insert in `MemberClassBooking.tsx` with `supabase.rpc('book_facility_slot', {...})`

### Issue 2: "My Entitlements" Shows Wrong Used Count (Confirmed)
The `MemberDashboard.tsx` entitlement widget reads from `benefit_usage` table. But since bookings never write to `benefit_usage`, it always shows 0 used. After fixing Issue 1, the RPC will write to `benefit_usage` on each booking, which will auto-fix this widget.

Additionally, the member's entitlements widget on the dashboard shows "2/2" as `remaining/total` but should show used vs total. The label currently says `{remaining} / {totalAllowed}` which could be confusing — it shows 0 remaining out of 2 total but displays "0 / 2" not "2 / 2 used". The screenshot shows "2 / 2" — this is correct display. The issue is that the widget was never deducting, so it always showed "2 / 2" as if no sessions were used.

### Issue 3: Duplicate Slot Booking (Same slot booked multiple times)
The database shows slot `b0bf7eaa-b014-41ae-b845-8cd9a1e2a012` was booked **twice** by the same member. There is no `UNIQUE(slot_id, member_id)` constraint on `benefit_bookings`. The `book_facility_slot` RPC will guard against this.

### Issue 4: Invoice Shows Duplicate / Wrong Dues on Dashboard
The member has 2 invoices both `status: partial` totaling ~₹34,998 pending. `MyInvoices.tsx` only counts `status = 'pending'` invoices for the summary cards, missing `partial` status invoices. The dashboard `pendingInvoices` in `useMemberData` also filters incorrectly. **Fix:** Include `partial` and `overdue` statuses in the pending calculation.

### Issue 5: RBAC — Routes Are Already Protected
Good news: The `App.tsx` routes are properly protected. `/dashboard` requires `['owner', 'admin', 'manager', 'staff']` and `/settings` requires `['owner', 'admin']`. The `ProtectedRoute` redirects unauthorized users. The sidebar uses `getMenuForRole()` which shows role-specific menus. **This is working correctly** — staff see staffMenuConfig, admins see adminMenuConfig.

However, there is one gap: the `/dashboard` admin page allows `staff` role — staff can access the admin dashboard. This may be intentional (staff need to see the dashboard for operations). The staff dashboard is at `/staff-dashboard`. The plan request asks staff not to see admin analytics/revenue. We'll tighten this by removing `staff` from the `/dashboard` admin route (they have `/staff-dashboard` instead).

### Issue 6: Booking Page UI — Multiple Bookings of Same Slot Displayed
From the screenshots (image-79.png), the agenda correctly shows booked items in orange. The current UI is functional. The duplicate bookings in the DB are the real problem. Once the RPC enforces limits, the "Book" button should be disabled/hidden when already booked at that slot.

### Issue 7: Invoice "Partial" Status Not Counted as Pending
`MyInvoices.tsx` only shows `pending` invoices in the "Pending Invoices" summary card, but the actual debt is in `partial` invoices. Need to fix both `MyInvoices.tsx` and `MemberDashboard.tsx` entitlement/dues calculation.

---

## Plan

### Priority 1: Database Migration — `book_facility_slot` RPC + Usage Sync

Create new migration with:

```sql
CREATE OR REPLACE FUNCTION public.book_facility_slot(
  p_slot_id UUID,
  p_member_id UUID,
  p_membership_id UUID
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_slot RECORD;
  v_plan_benefit RECORD;
  v_existing_count INTEGER;
  v_booking_id UUID;
BEGIN
  -- 1. Lock slot row to prevent race conditions
  SELECT * INTO v_slot FROM benefit_slots WHERE id = p_slot_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Slot not found');
  END IF;

  -- 2. Check capacity
  IF v_slot.booked_count >= v_slot.capacity THEN
    RETURN jsonb_build_object('success', false, 'error', 'This slot is fully booked');
  END IF;

  -- 3. Duplicate booking guard (same slot, same member)
  IF EXISTS (
    SELECT 1 FROM benefit_bookings 
    WHERE slot_id = p_slot_id AND member_id = p_member_id 
      AND status IN ('booked','confirmed')
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'You already have a booking for this slot');
  END IF;

  -- 4. Benefit limit enforcement
  IF v_slot.benefit_type_id IS NOT NULL THEN
    SELECT pb.* INTO v_plan_benefit
    FROM plan_benefits pb
    JOIN memberships m ON m.plan_id = pb.plan_id
    WHERE m.id = p_membership_id AND pb.benefit_type_id = v_slot.benefit_type_id
    LIMIT 1;

    IF FOUND AND v_plan_benefit.limit_count IS NOT NULL AND v_plan_benefit.limit_count > 0
       AND v_plan_benefit.frequency != 'unlimited' THEN
      -- Count existing bookings for this benefit type
      SELECT COUNT(*) INTO v_existing_count
      FROM benefit_bookings bb
      JOIN benefit_slots bs ON bs.id = bb.slot_id
      WHERE bb.member_id = p_member_id
        AND bb.membership_id = p_membership_id
        AND bs.benefit_type_id = v_slot.benefit_type_id
        AND bb.status IN ('booked','confirmed')
        AND CASE v_plan_benefit.frequency
          WHEN 'per_membership' THEN TRUE
          WHEN 'monthly' THEN bs.slot_date >= date_trunc('month', CURRENT_DATE)
          WHEN 'weekly' THEN bs.slot_date >= date_trunc('week', CURRENT_DATE)
          WHEN 'daily' THEN bs.slot_date = CURRENT_DATE
          ELSE TRUE
        END;

      IF v_existing_count >= v_plan_benefit.limit_count THEN
        RETURN jsonb_build_object(
          'success', false, 
          'error', 'Benefit limit reached (' || v_existing_count || '/' || v_plan_benefit.limit_count || '). Please purchase an add-on.'
        );
      END IF;
    END IF;
  END IF;

  -- 5. Insert booking
  INSERT INTO benefit_bookings (slot_id, member_id, membership_id, status)
  VALUES (p_slot_id, p_member_id, p_membership_id, 'booked')
  RETURNING id INTO v_booking_id;

  -- 6. Write to benefit_usage for entitlement tracking
  IF v_slot.benefit_type_id IS NOT NULL THEN
    INSERT INTO benefit_usage (membership_id, benefit_type, benefit_type_id, usage_date, usage_count)
    VALUES (p_membership_id, v_slot.benefit_type::benefit_type, v_slot.benefit_type_id, CURRENT_DATE, 1);
  END IF;

  RETURN jsonb_build_object('success', true, 'booking_id', v_booking_id);
END;
$$;
```

Also add a cancellation trigger/update to `benefit_usage` when booking is cancelled (decrement or delete the matching usage record).

Also add a **unique partial index** to prevent duplicate bookings at DB level:
```sql
CREATE UNIQUE INDEX IF NOT EXISTS benefit_bookings_no_dup
ON benefit_bookings(slot_id, member_id)
WHERE status IN ('booked', 'confirmed');
```

### Priority 2: Update `bookSlot` in `MemberClassBooking.tsx`

Replace the raw insert with the RPC call:
```typescript
const { data, error } = await supabase.rpc('book_facility_slot', {
  p_slot_id: slotId,
  p_member_id: member.id,
  p_membership_id: activeMembership.id,
});
if (error) throw error;
const result = data as { success: boolean; error?: string };
if (!result.success) throw new Error(result.error || 'Booking failed');
```

Also invalidate `['my-entitlements']` query on successful booking so the dashboard updates.

### Priority 3: Fix Invoice Pending Count (Dashboard + MyInvoices)

**`MemberDashboard.tsx`:** The `pendingInvoices` in `useMemberData` hook only counts `status = 'pending'`. Update to include `partial` and `overdue`:

In `src/hooks/useMemberData.ts`, find the pending invoices query and change the filter from `.eq('status', 'pending')` to `.in('status', ['pending', 'partial', 'overdue'])`.

**`MyInvoices.tsx`:** Update the pending summary logic:
```typescript
const pendingInvoices = invoices.filter(inv => ['pending', 'partial', 'overdue'].includes(inv.status));
```

Also add a "Due Date" column to show the next payment due date.

### Priority 4: Tighten Admin RBAC

In `App.tsx`, remove `staff` from the `/dashboard` admin route (staff already have `/staff-dashboard`):
```tsx
// Before
<Route path="/dashboard" element={<ProtectedRoute requiredRoles={['owner', 'admin', 'manager', 'staff']}>
// After  
<Route path="/dashboard" element={<ProtectedRoute requiredRoles={['owner', 'admin', 'manager']}>
```

This ensures staff who navigate to `/dashboard` are redirected to `/staff-dashboard` by `ProtectedRoute`.

### Priority 5: Backfill benefit_usage for existing bookings

The existing overbookings in the database need cleanup. Add a migration to:
1. Clear `benefit_bookings` that exceed the plan limit (keep only the earliest `limit_count` bookings per benefit type per membership, cancel the rest)
2. Backfill `benefit_usage` from the remaining valid `benefit_bookings`

---

## Files to Change

| File | Change |
|------|--------|
| Database migration | New `book_facility_slot` RPC, unique index on benefit_bookings, backfill + cleanup excess bookings |
| `src/pages/MemberClassBooking.tsx` | Replace raw INSERT with `book_facility_slot` RPC; invalidate entitlements on success |
| `src/hooks/useMemberData.ts` | Include `partial`/`overdue` in pending invoices query |
| `src/pages/MyInvoices.tsx` | Include `partial`/`overdue` in pending summary; add "Due" column |
| `src/pages/MemberDashboard.tsx` | Fix "Pending Dues" stat to count `partial` status invoices correctly |
| `src/App.tsx` | Remove `staff` from `/dashboard` route |

---

## What is NOT Changed

- **Sidebar RBAC**: Already working correctly via `getMenuForRole()` — staff see staff menu, members see member menu
- **Route protection**: Already correct in `ProtectedRoute` — members redirected to member-dashboard, trainers to trainer-dashboard
- **Calendar UI overhaul**: The current agenda view is functional and clean. A full Material Design timeline rewrite is a large scope that risks breaking existing working features. The current implementation will be kept stable. The booking enforcement fix is far more critical.
- **"My Bookings" broken names**: The data in `AllBookings.tsx` already correctly joins profiles for member names. The issue shown in the screenshot (image-78) shows real names ("Kuldeep Salvi") are displaying correctly.
