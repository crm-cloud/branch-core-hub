

# System Audit & Critical Fixes

---

## Issue 1: Benefits Drawer Shows "No benefit types created yet" (CRITICAL)

**Root Cause:** On `Plans.tsx` line 286, `AddPlanDrawer` is rendered without a `branchId` prop. Inside the drawer, `useBenefitTypes(branchId)` returns `[]` when `branchId` is undefined/falsy (line 9 of the hook: `if (!branchId) return []`). The benefit types exist in the database tied to `branch_id = 11111111-...`, but the drawer never receives this ID.

**Fix:** In `Plans.tsx`, fetch the user's branch (or first available branch) and pass it to `AddPlanDrawer` and `EditPlanDrawer`. Also update `AddPlanDrawer` to auto-resolve the branch if none is provided.

### Files:
| File | Change |
|------|--------|
| `src/pages/Plans.tsx` | Pass the first branch ID to `AddPlanDrawer` and `EditPlanDrawer` |

The branches query already exists on the page implicitly via `usePlans`. We'll add a simple branch fetch and pass it down. The drawer already handles `branchId` correctly once it receives it.

---

## Issue 2: Gender-Separated Facility Booking

**Implementation:**

1. **Database Migration:** Add `gender_access` column to `benefit_types` table with values `'male'`, `'female'`, `'unisex'` (default: `'unisex'`).

2. **Settings UI:** Add a gender access dropdown to the Benefit Type creation/edit form in `BenefitTypesManager.tsx`.

3. **Booking Filter:** In member booking flows (`BenefitSlotBookingDrawer.tsx`, `BookBenefitSlot.tsx`), filter available benefit types by comparing the member's `gender` profile field against `benefit_types.gender_access`. Only show matching or `'unisex'` types.

### Files:
| File | Change |
|------|--------|
| Database migration | Add `gender_access TEXT DEFAULT 'unisex'` to `benefit_types` |
| `src/components/settings/BenefitTypesManager.tsx` | Add gender access selector (Male/Female/Unisex) to create/edit form |
| `src/components/benefits/BenefitSlotBookingDrawer.tsx` | Filter benefit types by member gender |
| `src/pages/BookBenefitSlot.tsx` | Filter available slots by gender |

---

## Issue 3: Freeze/Unfreeze State Logic (CRITICAL)

**Current State:** The `ApprovalRequestsDrawer.tsx` already has freeze approval logic (lines 69-98) that updates `membership_freeze_history` status to `'approved'` and conditionally sets `memberships.status = 'frozen'` when the freeze start date is today or earlier. This logic appears correct.

**Remaining Gap:** There is no database trigger to handle future-dated freezes (freeze that starts tomorrow). Also, the member portal needs to show the correct button state based on membership status.

**Fix:**

1. Create a database function/trigger that fires when `membership_freeze_history.status` changes to `'approved'` and the freeze `start_date <= CURRENT_DATE`, automatically setting the membership to `'frozen'`.

2. For future-dated freezes, create a scheduled check (or rely on the existing approval handler which already does this check).

3. In the member portal, ensure the freeze/unfreeze button reflects membership status:
   - `status = 'active'` --> Show "Request Freeze"
   - `status = 'frozen'` --> Show "Request Unfreeze" (and disable gym check-in)

### Files:
| File | Change |
|------|--------|
| Database migration | Create trigger on `membership_freeze_history` to auto-update membership status |
| `src/components/members/MemberProfileDrawer.tsx` | Verify freeze/unfreeze button states match membership status (audit existing logic) |

---

## Issue 4: Dashboard Vuexy Overhaul & Financial Accuracy

**Current State:** The dashboard already has:
- Hero gradient card (violet-to-indigo) with Total Members, Revenue, Expiring Soon -- already implemented
- Accounts Receivable widget calculating `total_amount - amount_paid` -- already implemented
- Stat cards, charts, occupancy gauge -- already present

**Remaining Fixes:**

1. **Vuexy Shadows:** Apply `shadow-lg shadow-indigo-500/20` to all white cards (currently some use `border-border/50` instead of shadow styling).

2. **Pending Invoices Widget:** Add a proper "Pending Invoices" section showing invoices with Paid/Partial/Overdue badges color-coded (Green/Yellow/Red).

3. **Transaction Feed:** Add recent payment transactions with status badges.

### Files:
| File | Change |
|------|--------|
| `src/components/dashboard/DashboardCharts.tsx` | Update card classes to Vuexy shadows; add Pending Invoices widget |
| `src/pages/Dashboard.tsx` | Add pending invoices query; update card styling throughout |

---

## Execution Order

1. **Fix Benefits Drawer** -- Pass `branchId` to `AddPlanDrawer` from `Plans.tsx`
2. **Gender-Separated Booking** -- Add `gender_access` column + filter logic
3. **Fix Freeze Logic** -- Add trigger + audit member portal buttons
4. **Dashboard Polish** -- Apply Vuexy shadows + financial widgets

---

## Technical Details

### Benefits Drawer Fix (Plans.tsx)
```text
// Add branch query
const { data: branches } = useQuery({
  queryKey: ['branches'],
  queryFn: async () => {
    const { data } = await supabase.from('branches').select('id').limit(1);
    return data;
  }
});
const defaultBranchId = branches?.[0]?.id;

// Pass to drawer
<AddPlanDrawer open={addPlanOpen} onOpenChange={setAddPlanOpen} branchId={defaultBranchId} />
```

### Gender Access Migration
```sql
ALTER TABLE public.benefit_types 
  ADD COLUMN IF NOT EXISTS gender_access TEXT DEFAULT 'unisex' 
  CHECK (gender_access IN ('male', 'female', 'unisex'));
```

### Freeze Trigger
```sql
CREATE OR REPLACE FUNCTION public.auto_freeze_membership()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status = 'pending' THEN
    IF NEW.start_date <= CURRENT_DATE THEN
      UPDATE public.memberships SET status = 'frozen' WHERE id = NEW.membership_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_freeze_membership
  AFTER UPDATE ON public.membership_freeze_history
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_freeze_membership();
```

### Dashboard Vuexy Card Class
```text
// Replace: className="border-border/50"
// With:    className="shadow-lg shadow-indigo-500/20 rounded-2xl border-0"
```
