

# Transfers, Class Roster, Staff Pricing & AI Fitness Refactor

## Module 1: Membership Transfer Bug Fix (Revenue Leak)

**The Bug**: Both the direct management transfer (line 100-103 in `TransferMembershipDrawer.tsx`) and the approval queue handler (line 230-233 in `ApprovalQueue.tsx`) only do `update({ member_id: toMemberId })` — they never deactivate the original membership or cap the sender's end date.

**The Fix** (3 locations):

1. **`TransferMembershipDrawer.tsx`** (management direct path, ~line 100): After the `update({ member_id })`, add a second query to fetch the membership's remaining days, then:
   - Calculate `remainingDays = membership.end_date - today`
   - Update the original membership: `status = 'transferred', end_date = today`
   - Insert a NEW membership for the recipient with `start_date = today, end_date = today + remainingDays, status = 'active'`
   - Remove the simple `update({ member_id })` approach entirely

2. **`ApprovalQueue.tsx`** (approval handler, ~line 225-276): Same atomic logic — deactivate old, create new with remaining days.

3. **Store remaining days in approval payload**: Update the staff approval insert to include `remaining_days` and `plan_id` so the approval handler can create the new membership correctly.

## Module 2: Class Attendees Roster Drawer

**Current state**: Classes page already has an "Attendance" tab that shows bookings for a selected class. But there's no quick "View Attendees" button on each class card.

**The Fix** in `src/pages/Classes.tsx`:
- Add a "View Attendees" `Button` on each class card (next to the Edit button)
- Clicking it opens a `Sheet` drawer that queries `class_bookings` joined with member profiles (avatar, name, phone)
- Display a clean roster list with attendance status badges and action buttons
- Reuse existing `useClassBookings` hook

## Module 3: Staff Dashboard Pricing with Benefits

**Current state**: `PricingDrawer` (line 413-463 in `StaffDashboard.tsx`) only selects `id, name, duration_days, price, is_active` — no benefits.

**The Fix** in `src/pages/StaffDashboard.tsx`:
- Update the query to join `plan_benefits` with `benefit_types`: `select('id, name, duration_days, price, is_active, plan_benefits(id, benefit_type, frequency, limit_count, benefit_types(name, code))')`
- Replace the simple table with cards showing plan name, price, duration, and a bulleted list of benefits under each plan
- Format benefits as "Benefit Name — frequency (limit)" entries

## Module 4: AI Fitness Planner Template Library

**Current state**: AIFitness.tsx (913 lines) already has tabs for Generate/Templates/Assign, uses `fitness_plan_templates` table, has CRUD for templates, and has an `AssignPlanDrawer`. It already supports Global Templates vs. saved templates with delete.

**What's actually missing**: Edit functionality and a cleaner "Global Templates" vs "Member Plans" tab split.

**The Fix** in `src/pages/AIFitness.tsx`:
- Rename existing tabs: "Generate" → "Generate", "Templates" → "Template Library" (combine default + saved)
- Add an "Edit" button on saved templates that loads the template content back into the Generate form for modification (re-save overwrites)
- Ensure "Download PDF" button exists on every template card (already partially implemented)
- Add "Member Plans" tab that queries `member_fitness_plans` and shows assigned plans with member name, plan type, validity

## Files to Modify

| File | Change |
|------|--------|
| `src/components/members/TransferMembershipDrawer.tsx` | Atomic transfer: deactivate old + create new membership |
| `src/pages/ApprovalQueue.tsx` | Same atomic transfer logic on approval |
| `src/pages/Classes.tsx` | Add "View Attendees" button + roster Sheet drawer |
| `src/pages/StaffDashboard.tsx` | Join plan_benefits in pricing query, render benefits list |
| `src/pages/AIFitness.tsx` | Add Edit button, rename tabs, add Member Plans tab |

## Execution Order
1. Transfer bug fix (TransferMembershipDrawer + ApprovalQueue)
2. Class attendees roster drawer
3. Staff pricing benefits
4. AI Fitness template library refinements

