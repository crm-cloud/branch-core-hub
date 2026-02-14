

# Fix: Facility Slot Generation, 409 Conflict, and Recovery Zone

## Root Cause Analysis

### 1. The 409 Conflict (Benefit Settings)
The `benefit_settings` table has a UNIQUE constraint on `(branch_id, benefit_type)`. Since all custom benefit types (Ice Bath, Sauna M, Sauna F) map to the enum value `'other'` via `safeBenefitEnum()`, only ONE settings row can exist per branch for all custom types. Ice Bath settings saved first; Sauna settings fail with 409 because they also try to insert `benefit_type = 'other'` for the same branch.

**Database fix:** Replace the unique constraint `(branch_id, benefit_type)` with `(branch_id, benefit_type_id)` since `benefit_type_id` is the real unique identifier for custom types. Also add a fallback unique on `(branch_id, benefit_type)` only WHERE `benefit_type_id IS NULL` (for legacy enum-only types). Simpler approach: drop the old constraint and add a new one on `(branch_id, COALESCE(benefit_type_id, benefit_type::text))`.

**Code fix:** Update `upsertBenefitSetting` in `benefitBookingService.ts` to always use the `benefit_type_id`-aware path (check-then-update/insert) instead of falling through to the raw upsert that triggers the constraint.

### 2. Empty Recovery Zone (No Sauna Slots)
Currently in the database:
- 4 active facilities: Ice Bath M, Ice Bath F, Sauna Room Female, Sauna Room Male
- Only 1 `benefit_settings` row exists (for Ice Bath, benefit_type_id `977dcc42...`)
- Sauna M (benefit_type_id `bbdd063c`) and Sauna F (benefit_type_id `b712228b`) have NO settings rows
- `ensureSlotsForDateRange` skips facilities with no matching settings
- Result: 0 benefit_slots generated, Recovery Zone is empty

**Fix:** After fixing the 409 conflict, the admin can save Sauna settings. But we also need a fallback: if a facility has no specific settings, `ensureSlotsForDateRange` should use sensible defaults (6 AM - 10 PM, 30 min slots) from the branch or gym-wide config.

### 3. Console 400 Errors
The 400 errors visible in the screenshot come from multiple failed API calls. These are likely from pages loading with invalid parameters or missing relationships. The PT sessions query in `MemberClassBooking.tsx` is correctly guarded by `ptPackageIds.length > 0`, so those 400s likely come from other pages loaded in the session.

---

## Implementation Plan

### Step 1: Database Migration
Drop the old unique constraint and create a new one that handles both enum-based and UUID-based benefit types:

```sql
-- Drop the old constraint that causes 409 conflicts
ALTER TABLE benefit_settings 
  DROP CONSTRAINT benefit_settings_branch_id_benefit_type_key;

-- Add new unique constraint using benefit_type_id (primary key for custom types)
-- For rows WITH a benefit_type_id, uniqueness is on (branch_id, benefit_type_id)
CREATE UNIQUE INDEX benefit_settings_branch_type_id_key 
  ON benefit_settings (branch_id, benefit_type_id) 
  WHERE benefit_type_id IS NOT NULL;

-- For legacy rows WITHOUT a benefit_type_id, keep uniqueness on (branch_id, benefit_type)
CREATE UNIQUE INDEX benefit_settings_branch_type_enum_key 
  ON benefit_settings (branch_id, benefit_type) 
  WHERE benefit_type_id IS NULL;
```

### Step 2: Fix `upsertBenefitSetting` in `src/services/benefitBookingService.ts`
Simplify the function: ALWAYS use the check-then-update/insert pattern. Remove the fallback raw upsert that relies on the old `(branch_id, benefit_type)` constraint.

### Step 3: Fix `ensureSlotsForDateRange` in `src/services/benefitBookingService.ts`
Add a fallback for facilities with no matching `benefit_settings` row. If no settings exist for a facility's `benefit_type_id`, use default values (6:00-22:00, 30 min slots, capacity from facility). This ensures slots are always generated for active facilities.

### Step 4: Fix `MemberClassBooking.tsx` 
- The `ensureSlotsForDateRange` query currently has `retry: false`. If it silently fails (e.g., due to RLS or a missing settings row), the Recovery Zone stays empty forever. Add error handling so the slots query still runs even if auto-generation partially fails.
- Make the recovery slots query NOT dependent on `slotsReady === true` as a hard gate. Instead, fetch whatever slots exist and attempt generation in the background.

---

## Files Summary

| File | Change |
|------|--------|
| Migration SQL | Drop old unique constraint, add two partial unique indexes |
| `src/services/benefitBookingService.ts` | Fix `upsertBenefitSetting` to always use check-then-upsert; fix `ensureSlotsForDateRange` to use defaults when no settings row exists |
| `src/pages/MemberClassBooking.tsx` | Remove hard gate on `slotsReady` for recovery query; add error resilience |

