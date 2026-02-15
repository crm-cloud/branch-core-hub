
# System Audit: Employee Onboarding, Locker Assignment & Benefit Visibility

## 1. Fix Add Employee Form (UI & Auth Logic)

**Current state:** The form has a password field (line 289-298) and text inputs for Department/Position (lines 337-354). The edge function `create-staff-user` already generates a temp password internally and sets `must_set_password: true`, so the UI password field is redundant.

**Changes to `src/components/employees/AddEmployeeDrawer.tsx`:**
- Remove the `password` field from `newUserFormData` state and the form UI
- Remove the password validation in `handleCreateNew` (line 154)
- Stop sending `password` to the edge function (the edge function already generates one)
- Replace Department text input with a Select dropdown: Management, Fitness, Sales, Operations, Maintenance
- Replace Position text input with a Select dropdown: Gym Manager, Personal Trainer, Receptionist, Sales Rep, Cleaner
- Apply the same Select dropdowns to the "Link Existing" tab's Department and Position fields
- Update the info box text to mention the user will receive a password setup prompt on first login

**No edge function changes needed** -- `create-staff-user` already handles temp password generation and `must_set_password` flow.

---

## 2. Refactor Locker Assignment Logic (Move Billing to Assignment)

**Current state:** The "Create Locker" drawer has `is_chargeable` toggle and `monthly_fee` input. The `AssignLockerDrawer` reads `locker.monthly_fee` to calculate charges. The fee lives on the locker itself.

**The fix:** Move the charging decision to assignment time, not locker creation time.

**Changes to `src/pages/Lockers.tsx`:**
- Remove `is_chargeable` and `monthly_fee` fields from `createLockerSchema` and the form UI
- Add an `area` field (text input, e.g., "Men's Changing Room", "Women's Area", "VIP Section")
- The `onCreateSubmit` function stops sending `monthly_fee`

**Changes to `src/components/lockers/AssignLockerDrawer.tsx`:**
- Add a "Charge Monthly Rental?" Switch toggle (currently the drawer reads `locker.monthly_fee` -- replace this with a user-controlled toggle)
- When toggled ON, show a "Rental Fee (per month)" input field, defaulting to 500
- The `handleAssignLocker` function uses this user-entered fee instead of `locker.monthly_fee`
- Keep the existing plan-based free locker check (if plan includes free locker, override to 0)
- Remove references to `locker.monthly_fee` for billing calculation

**Changes to `src/services/lockerService.ts`:**
- Update `createLocker` to accept `area` instead of `monthly_fee`

**Changes to `src/pages/Lockers.tsx` locker grid:**
- Stop showing the price badge on the locker tile (since price is now per-assignment, not per-locker)
- Show the area/location label instead

**Database:** The `lockers` table already has `notes` (can store area info) and `monthly_fee`. No migration needed -- we simply stop writing `monthly_fee` on the locker record and instead store the fee on the `locker_assignments.fee_amount` column (which already exists).

---

## 3. Benefits & Booking Visibility on Member Dashboard

**Current state:** The Member Dashboard (`MemberDashboard.tsx`) shows stats for membership, PT sessions, visits, and dues. It has no "My Entitlements" widget showing benefit balances (Ice Bath remaining, Sauna access, etc.).

**Part A: "My Entitlements" Widget on Member Dashboard**

**Changes to `src/pages/MemberDashboard.tsx`:**
- Add a new Card: "My Entitlements" in the grid alongside Membership Details and Upcoming Classes
- Query `plan_benefits` joined with `benefit_types` for the active membership's plan
- Query `benefit_usage` for the current membership to calculate remaining counts
- Display each benefit with icon, name, and usage fraction:
  - For "unlimited" frequency: show "Unlimited"
  - For "per_membership" (total pool): show "X / Y Remaining" where Y = limit_count * (duration / 30)
  - For periodic (daily/weekly/monthly): show "X / Y Remaining (resets [period])"
- Include a "Book Now" link to `/my-classes` for bookable benefits
- Show a friendly empty state if no benefits are configured

**Part B: Booking Engine (Already Implemented)**

The Smart Agenda feed (`MemberClassBooking.tsx`) already merges classes + recovery slots + PT sessions with gender filtering and auto-slot generation. The main gap was the empty Recovery Zone due to missing `benefit_slots` rows, which was fixed in the previous migration (auto-generation with fallback defaults).

No changes needed to the booking page itself -- the slot generation and unified feed are already working.

---

## Files Summary

| Priority | File | Change |
|----------|------|--------|
| 1 | `src/pages/MemberDashboard.tsx` | Add "My Entitlements" widget showing benefit balances |
| 2 | `src/pages/Lockers.tsx` | Remove is_chargeable/monthly_fee from Create form; add area field; remove price badge from tiles |
| 2 | `src/components/lockers/AssignLockerDrawer.tsx` | Add "Charge Monthly Rental?" toggle and fee input at assignment time |
| 2 | `src/services/lockerService.ts` | Update createLocker params (area instead of monthly_fee) |
| 3 | `src/components/employees/AddEmployeeDrawer.tsx` | Remove password field; replace Department/Position text inputs with Select dropdowns |

No database migrations required -- all existing columns support the new logic.

---

## Technical Notes

**Entitlements query pattern:**
```sql
-- Get plan benefits for active membership
SELECT pb.*, bt.name, bt.icon, bt.code
FROM plan_benefits pb
JOIN benefit_types bt ON pb.benefit_type_id = bt.id
JOIN memberships m ON m.plan_id = pb.plan_id
WHERE m.id = <active_membership_id>

-- Get usage for this membership
SELECT benefit_type, benefit_type_id, SUM(usage_count) as total_used
FROM benefit_usage
WHERE membership_id = <active_membership_id>
GROUP BY benefit_type, benefit_type_id
```

**Locker fee logic shift:**
- Before: `locker.monthly_fee` drives billing at assignment
- After: Admin sets fee per-assignment in the drawer; `locker_assignments.fee_amount` stores the actual charged amount (already exists in schema)
- This allows the same locker to be free for VIP and charged for Standard members
