
# Fix: Financial Sync, Class Booking Permissions & Facility Scheduling

## Problem 1: Pending Dues Shows ₹0

**Root cause:** `useMemberData.ts` line 130 filters invoices with `.eq('status', 'pending')`. The actual invoices in the database have status `'partial'` (₹15,000 paid of ₹29,999). Partial invoices are excluded, so the dashboard shows ₹0.

**Fix in `src/hooks/useMemberData.ts`:**
- Change the pending invoices query from `.eq('status', 'pending')` to `.in('status', ['pending', 'partial', 'overdue'])` -- any status that is NOT 'paid', 'cancelled', or 'refunded'.
- This ensures partial payments (like the ₹14,999 due) are included in the total.

## Problem 2: "Plan does not include group classes"

**Root cause:** The database function `validate_class_booking` checks `pb.benefit_type = 'group_classes'`. But the plan stores the class benefit as a **custom benefit type** with `benefit_type = 'other'` and a `benefit_type_id` pointing to a row named "CLASS" (code: `class`). The strict enum check always fails.

**Fix: Update the `validate_class_booking` database function:**
- Change the benefit lookup from `pb.benefit_type = 'group_classes'` to also check for custom benefit types where the linked `benefit_types.code` matches 'class' or 'group_classes'.
- Updated query:
  ```sql
  SELECT pb.limit_count, pb.frequency INTO v_limit, v_frequency
  FROM plan_benefits pb
  LEFT JOIN benefit_types bt ON pb.benefit_type_id = bt.id
  WHERE pb.plan_id = _membership.plan_id
    AND (
      pb.benefit_type = 'group_classes'
      OR bt.code IN ('class', 'group_classes')
    )
  LIMIT 1;
  ```
- This covers both the legacy enum path AND the custom benefit type path.
- Same fix applied to the usage count query below it.

## Problem 3: Facility Scheduling (Available Days)

**Database migration:**
- Add `available_days TEXT[] DEFAULT ARRAY['mon','tue','wed','thu','fri','sat','sun']` to the `facilities` table.
- Add `under_maintenance BOOLEAN DEFAULT false` to the `facilities` table.

**Fix in `src/services/benefitBookingService.ts` (`ensureSlotsForDateRange`):**
- Fetch `available_days` and `under_maintenance` along with other facility fields.
- Before generating slots for a date, check:
  1. If `facility.under_maintenance = true`, skip.
  2. If the day-of-week abbreviation (mon/tue/wed...) is NOT in `facility.available_days`, skip.

**Admin UI (`src/components/settings/FacilitiesManager.tsx`):**
- Add a "Weekly Schedule" row of 7 toggle buttons (Mon-Sun) for each facility.
- Add an "Under Maintenance" switch toggle.
- Save these fields when updating a facility.

---

## Files Summary

| File | Change |
|------|--------|
| Database migration | Add `available_days` and `under_maintenance` columns to `facilities`; update `validate_class_booking` and `book_class` functions to support custom class benefit types |
| `src/hooks/useMemberData.ts` | Change pending invoices filter from `eq('status','pending')` to `in('status', ['pending','partial','overdue'])` |
| `src/services/benefitBookingService.ts` | Add day-of-week and maintenance checks in `ensureSlotsForDateRange` |
| `src/components/settings/FacilitiesManager.tsx` | Add weekly schedule toggles and maintenance switch to facility management UI |
