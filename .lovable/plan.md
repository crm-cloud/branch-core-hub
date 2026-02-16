
# Fix: Auto-Slot Generation (RLS), Recovery Zone Visibility & Staff Concierge Booking

## Root Cause: Why Recovery Zone is Empty

The `ensureSlotsForDateRange` function runs client-side in the member's browser. It tries to INSERT rows into `benefit_slots`, but RLS only allows staff roles to insert. The member's INSERT silently fails (caught by try-catch), so zero slots exist and the Recovery tab shows "No sessions available this week."

All 4 facilities exist. All 4 benefit_settings exist. The data is correct -- it just can't be written by members.

## Plan

### 1. Database: SECURITY DEFINER Function for Slot Generation

Create a PostgreSQL function `ensure_facility_slots(p_branch_id UUID, p_start_date DATE, p_end_date DATE)` with `SECURITY DEFINER` that:
- Reads facilities (checking `is_active`, `under_maintenance`, `available_days`)
- Reads benefit_settings for each facility
- Checks existing slots to avoid duplicates
- Inserts missing slots directly (bypasses RLS since SECURITY DEFINER)
- Returns void (fire-and-forget)

This is safe because the function only generates slots based on existing facility/settings config -- it doesn't accept arbitrary slot data from the caller.

### 2. Client Code: Call RPC Instead of Direct Inserts

Update `ensureSlotsForDateRange` in `src/services/benefitBookingService.ts` to call `supabase.rpc('ensure_facility_slots', {...})` instead of doing client-side loops with direct table inserts. This makes it work for both members and staff.

### 3. Staff Concierge Booking Drawer

Add a "New Booking" button to `src/pages/AllBookings.tsx` that opens a `ConciergeBookingDrawer`:
- Step 1: Search and select a member (using the existing `search_members` RPC)
- Step 2: Choose service type (Class or Recovery Facility)
- Step 3: Select available slot/class
- Step 4: Confirm booking (with an "Override Capacity" checkbox for staff)

The drawer will use the existing `book_class` RPC for classes and direct `benefit_bookings` insert for facilities (staff already has INSERT permission).

### 4. "My Entitlements" Widget

Already implemented in the previous iteration on MemberDashboard. No changes needed.

---

## Files Summary

| File | Change |
|------|--------|
| Database migration | Create `ensure_facility_slots` SECURITY DEFINER function |
| `src/services/benefitBookingService.ts` | Replace client-side slot generation loop with single RPC call |
| `src/components/bookings/ConciergeBookingDrawer.tsx` | New file: staff booking-on-behalf drawer |
| `src/pages/AllBookings.tsx` | Add "New Booking" button that opens concierge drawer |

---

## Technical Details

**The SECURITY DEFINER function** replaces the entire client-side `ensureSlotsForDateRange` logic. It runs as the function owner (postgres), so RLS doesn't block slot inserts. The function:

```sql
CREATE OR REPLACE FUNCTION ensure_facility_slots(
  p_branch_id UUID, p_start_date DATE, p_end_date DATE
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
```

- Loops over active, non-maintenance facilities for the branch
- Checks day-of-week against `available_days`
- Skips facility+date combos that already have slots
- Uses matched benefit_settings or sensible defaults (06:00-22:00, 30min)
- Bulk-inserts all generated slots

**ConciergeBookingDrawer** workflow:
1. Member search via `search_members` RPC (already exists)
2. Tabs for "Class" vs "Recovery"
3. For classes: fetch upcoming classes, show available ones, book via `book_class` RPC
4. For recovery: fetch `benefit_slots` for selected date/facility, insert `benefit_bookings`
5. "Force Add" toggle allows overbooking (skips capacity check)
