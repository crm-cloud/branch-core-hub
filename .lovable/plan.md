

# Fix: Plan Benefits UI + Slot Booking Settings Save Error

---

## Issue 1: Plan Benefits UI -- Replace Checkboxes with Dropdown

Currently the "Plan Benefits" section in AddPlanDrawer shows checkboxes with Unlimited/Limited radio buttons. This will be redesigned to a cleaner dropdown-based approach:

- A **multi-select** area where each benefit type from the database is shown as a selectable row
- For each selected benefit, a **quantity mode** selector: "Unlimited" or a numeric input
- The frequency will default to `per_membership` (entire membership lifespan) with an option to change to daily/weekly/monthly
- Cleaner, more compact UI using Select dropdowns and inline inputs

### New UI Layout for Benefits Section:
```text
+--------------------------------------------------+
| Plan Benefits                                     |
| Select benefits included in this plan             |
+--------------------------------------------------+
| [+ Add Benefit]  dropdown showing all types       |
|                                                   |
| SAUNA ROOM          [Unlimited v] or [  2  ]      |
|   per_membership v                       [x]      |
|                                                   |
| ICE BATH             [Unlimited v] or [  5  ]     |
|   per_membership v                       [x]      |
+--------------------------------------------------+
```

Each added benefit row shows:
- Benefit name with icon
- Toggle between Unlimited / Limited with quantity input
- Period dropdown (daily/weekly/monthly/entire membership)
- Remove button

**File:** `src/components/plans/AddPlanDrawer.tsx`

---

## Issue 2: Slot Booking Settings Save Error (CRITICAL)

**Root Cause:** The `benefit_settings` table has a `benefit_type` column typed as a database enum (`benefit_type`). When users create custom benefit types in Settings (e.g., "SAUNA ROOM" with code `sauna_room`), the code does NOT exist in the enum. The `BenefitSettingsComponent` passes `bt.code as BenefitType` to the upsert, and the database rejects it.

**Fix:** Modify the slot booking settings to use `benefit_type_id` (UUID, already exists in the table) instead of the `benefit_type` enum column. This decouples settings from the hardcoded enum and works with any custom benefit type.

Changes:
1. Update `upsertBenefitSetting` to use `benefit_type_id` as the identifier, setting `benefit_type` to a fallback enum value like `'other'` for custom types
2. Update `getBenefitSettings` to join with `benefit_types` table for display
3. Update `BenefitSettingsComponent` to pass `benefit_type_id` and handle the mapping correctly
4. Update the upsert conflict target to use `branch_id,benefit_type_id` or handle the logic via a select-then-insert/update pattern

### Database Migration
Add a unique constraint on `(branch_id, benefit_type_id)` for the upsert to work:

```sql
-- Add unique constraint for benefit_type_id based upserts
ALTER TABLE public.benefit_settings 
  DROP CONSTRAINT IF EXISTS benefit_settings_branch_id_benefit_type_key;

CREATE UNIQUE INDEX IF NOT EXISTS benefit_settings_branch_benefit_type_id_idx 
  ON public.benefit_settings (branch_id, benefit_type_id) 
  WHERE benefit_type_id IS NOT NULL;
```

**Files:**
- `src/services/benefitBookingService.ts` -- Update upsert logic
- `src/components/settings/BenefitSettingsComponent.tsx` -- Pass `benefit_type_id` and use `'other'` as fallback enum value

---

## Files to Modify

| File | Change |
|------|--------|
| `src/components/plans/AddPlanDrawer.tsx` | Redesign benefits section: replace checkboxes with dropdown add + inline config rows |
| `src/services/benefitBookingService.ts` | Update `upsertBenefitSetting` to use `benefit_type_id` + fallback enum value |
| `src/components/settings/BenefitSettingsComponent.tsx` | Pass `benefit_type_id` to upsert, use `'other'` as default `benefit_type` enum |
| Database migration | Add unique index on `(branch_id, benefit_type_id)` |

---

## Technical Details

### AddPlanDrawer Benefits Redesign
- Remove checkbox-based layout
- Add a "Add Benefit" button that opens a Select dropdown listing all benefit types from the database
- Each selected benefit renders as a card row with:
  - Name + icon
  - Radio: Unlimited / Limited
  - If Limited: quantity Input + frequency Select (daily/weekly/monthly/per_membership)
  - Remove (X) button
- Default frequency: `per_membership` (total pool for entire membership)
- Data structure remains the same for `plan_benefits` insert

### BenefitSettings Upsert Fix
```typescript
// Before (fails for custom types):
upsert({ benefit_type: bt.code, ... }, { onConflict: "branch_id,benefit_type" })

// After (works for all types):
upsert({ 
  benefit_type: 'other',  // fallback enum value
  benefit_type_id: bt.id, // actual identifier
  ...
}, { onConflict: "branch_id,benefit_type_id" })
```

This approach keeps backward compatibility with existing enum-based records while supporting custom benefit types.

