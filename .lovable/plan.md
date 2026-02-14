
# System-Wide Audit: Locker, Benefits, Plan Display & Booking Fixes

## 1. Fix Plan Benefits Displaying as "Other" (Priority: HIGH)

**Root Cause:** Two issues compound:
- `plan_benefits` stores `benefit_type = 'other'` for custom benefits (by design via `safeBenefitEnum`)
- The `fetchPlans` query in `planService.ts` uses `select('*, plan_benefits(*)')` which does NOT join the `benefit_types` table
- The Plan Card in `Plans.tsx` uses `getBenefitLabel(benefit.benefit_type)` which only has a static map and returns `'other'` for unknown codes

**Fix (3 files):**

**a. `src/services/planService.ts`** - Update the `fetchPlans` and `fetchPlan` queries to join `benefit_types`:
```
.select('*, plan_benefits(*, benefit_types:benefit_type_id(id, name, code, icon))')
```

**b. `src/pages/Plans.tsx`** - Update `getBenefitLabel` to use the joined `benefit_types` name:
```typescript
// Line 242-245: Change benefit display
{plan.plan_benefits.slice(0, 4).map((benefit) => (
  <div key={benefit.id} className="flex items-center gap-2 text-sm">
    <Check className="h-3.5 w-3.5 text-primary" />
    <span>{benefit.benefit_types?.name || getBenefitLabel(benefit.benefit_type)}</span>
  </div>
))}
```

**c. `src/types/membership.ts`** - Update `PlanBenefit` type to include the joined `benefit_types` field.

---

## 2. Convert "Add Locker" Dialog to Drawer (Priority: MEDIUM)

**Current State:** `Lockers.tsx` lines 125-206 use a `Dialog` for "Add Locker". The "Quick Freeze" at `QuickFreezeDialog.tsx` also uses a `Dialog`.

**Fix:**

**a. `src/pages/Lockers.tsx`** - Replace the inline `Dialog` for "Add Locker" with a `Sheet` (right-side drawer) matching the Vuexy standard. Add an `is_chargeable` toggle with conditional `monthly_fee` input.

**b. `src/components/members/QuickFreezeDialog.tsx`** - Convert from `Dialog` to `Sheet` component. Rename to `QuickFreezeDrawer.tsx`. Update imports in `Members.tsx`.

**c. Database:** The `lockers` table already has `monthly_fee` (decimal). No `is_chargeable` column needed -- it can be inferred (`monthly_fee > 0`). No migration required.

---

## 3. Add "Benefits & Usage" Tab to Member Profile Drawer (Priority: MEDIUM)

**Current State:** `MemberProfileDrawer.tsx` has 6 tabs (Overview, Plan, Body, Pay, Rewards, Activity). Benefit tracking is a standalone page.

**Fix:**

**a. `src/components/members/MemberProfileDrawer.tsx`** - Add a 7th tab: "Benefits". This tab will:
- Show entitlements from the member's active plan (read from `plan_benefits` joined with `benefit_types`)
- Show usage history from `benefit_usage` table
- Include a "Log Usage" button that opens the existing `RecordBenefitUsageDrawer`

**b. `src/config/menu.ts`** - Remove "Benefit Tracking" from the admin sidebar (`adminMenuConfig` line 164) and staff sidebar (line 117). The standalone page stays accessible via URL for backward compatibility but is no longer in navigation.

---

## 4. Fix Empty Booking Page (Priority: HIGH)

**Current State:** The `MemberClassBooking.tsx` page already has 3 tabs: Group Classes, Recovery Zone, and PT Sessions. The Recovery Zone tab queries `benefit_slots` with gender filtering. The Group Classes tab queries `classes` filtered by date.

**Diagnosis:** The "No classes scheduled" message appears because:
- Classes are filtered by the selected date (defaults to today)
- If no classes are scheduled for today at the member's branch, the page shows empty
- The Recovery Zone tab requires `benefit_slots` to be pre-created for each date

**Fix:**

**a. `src/pages/MemberClassBooking.tsx`** - Improve the Group Classes empty state to be more helpful (show "No classes for [date]. Try another day." instead of generic message). Also ensure the tab defaults intelligently -- if no classes exist but slots do, default to Recovery Zone tab.

**b. Recovery Zone enhancement:** Currently filters slots correctly by gender. Add a fallback message when no slots exist: "No recovery slots available. Contact staff to schedule." Also show the member's remaining benefit credits above the slots list so they know their balance before booking.

---

## Files Summary

| Priority | File | Change |
|----------|------|--------|
| 1 | `src/services/planService.ts` | Join `benefit_types` in plan queries |
| 1 | `src/pages/Plans.tsx` | Display real benefit names instead of enum codes |
| 1 | `src/types/membership.ts` | Add `benefit_types` to PlanBenefit type |
| 2 | `src/pages/Lockers.tsx` | Convert Add Locker Dialog to Sheet drawer |
| 2 | `src/components/members/QuickFreezeDialog.tsx` | Convert to Sheet, rename to QuickFreezeDrawer |
| 2 | `src/pages/Members.tsx` | Update QuickFreezeDialog import |
| 3 | `src/components/members/MemberProfileDrawer.tsx` | Add Benefits & Usage tab |
| 3 | `src/config/menu.ts` | Remove Benefit Tracking from sidebars |
| 4 | `src/pages/MemberClassBooking.tsx` | Better empty states, show benefit credits, smarter default tab |
