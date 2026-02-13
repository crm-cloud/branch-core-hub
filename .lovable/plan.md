

# UI/UX Consistency and Logic Repairs

## Issue 1: Locker Bulk Create - Dialog to Drawer Conversion

**File:** `src/components/lockers/BulkCreateLockersDialog.tsx`

Replace the `Dialog` component with a right-side `Sheet` (drawer) to match the design standard. Add an "Is Chargeable?" toggle switch:
- When ON: show the Monthly Fee input (required)
- When OFF: hide the fee input, set fee to 0

The existing `lockers` table already has a `monthly_fee` column. We will add an `is_chargeable` boolean to the insert logic (derived from `monthlyFee > 0`). No database migration needed since `monthly_fee` already exists and `is_chargeable` can be inferred.

**Changes:**
- Replace `Dialog/DialogContent/DialogHeader/DialogTitle/DialogFooter` imports with `Sheet/SheetContent/SheetHeader/SheetTitle/SheetFooter`
- Add `isChargeable` state toggle
- Conditionally show/hide Monthly Fee input based on toggle
- Rename component to `BulkCreateLockersDrawer` (update import in `src/pages/Lockers.tsx`)

---

## Issue 2: Frozen Member Status Display

**File:** `src/pages/Members.tsx`

**Root Cause:** Lines 95-108 calculate member status as either `'active'` or `'inactive'`. Members with a frozen membership are shown as `'inactive'` because the code only looks for `status === 'active'` memberships.

**Fix:**
- Update the status calculation (line 95-108) to also check for `status === 'frozen'` memberships. If found, set member status to `'frozen'`.
- Update `getStatusColor` (line 171-178) to add a blue badge style for `'frozen'`.
- Update the status indicator dot (line 398-400) to handle `'frozen'` with a blue color.
- Update the dropdown menu (line 463-484): when a member has a frozen membership, show an "Unfreeze" option that opens the existing unfreeze flow.
- Adjust the `filteredMembers` filter to include `'frozen'` status when the frozen stat card is clicked (currently not clickable, needs onClick handler).

---

## Issue 3: Plan Benefits "Ghosting" - EditPlanDrawer

**File:** `src/components/plans/EditPlanDrawer.tsx`

**Root Cause:** The benefit list uses `benefit.id` = `bt.code` (e.g., `ice_bath_access`) as the key. But when loading existing plan_benefits from DB, `benefit.benefit_type` is stored as `'other'` (via safeBenefitEnum). So line 113 tries to match `benefitMap['other']` which doesn't correspond to any specific benefit -- it falls through to the `else` block and creates a generic "Other" entry.

**Fix:** Refactor EditPlanDrawer to match the AddPlanDrawer pattern:
- Change the benefit initialization to match by `benefit_type_id` (UUID) instead of `benefit_type` (enum code)
- When iterating `plan.plan_benefits`, find the matching benefit option by `benefitTypeId` match, not by enum code
- This ensures "Ice Bath Access" config appears under the correct card, not under a phantom "Other" card

Specifically:
1. In the `useEffect` that initializes benefits (line 96-135), change the matching logic:
   - Instead of `const benefitKey = benefit.benefit_type`, look up the matching benefit option by `benefit_type_id`
   - Use `benefitOptions.find(b => b.benefitTypeId === benefit.benefit_type_id)?.id` to get the correct key
2. Remove the fallback `else` block (lines 121-129) that creates orphaned "Other" entries
3. Remove the `allBenefitsToShow` merging logic (lines 242-255) that adds phantom entries from plan_benefits

---

## Technical Summary

| Priority | File | Change |
|----------|------|--------|
| 1 | `src/components/lockers/BulkCreateLockersDialog.tsx` | Dialog to Sheet, add Is Chargeable toggle |
| 1 | `src/pages/Lockers.tsx` | Update import for renamed component |
| 2 | `src/pages/Members.tsx` | Add frozen status detection, blue badge, unfreeze action, filter click |
| 3 | `src/components/plans/EditPlanDrawer.tsx` | Fix benefit init to match by benefit_type_id, remove "Other" ghost |

