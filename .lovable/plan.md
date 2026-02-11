

# Fix: Benefits Sync + Staff Creation

---

## Issue 1: Cannot Create Staff (CRITICAL)

**Root Cause:** `AddEmployeeDrawer.tsx` (line 162) calls the `admin-create-user` edge function, which only accepts `admin` and `owner` roles. It also sends the wrong payload format (`password`, `full_name` instead of `fullName`, and no `role` or `branchId`).

The correct function is `create-staff-user`, which the Trainer drawer already uses correctly.

**Fix:** Update `AddEmployeeDrawer.tsx` to call `create-staff-user` instead of `admin-create-user`, and send the correct payload format matching what `create-staff-user` expects.

**File:** `src/components/employees/AddEmployeeDrawer.tsx`

Change in `handleCreateNew` (line 162):
```
// FROM:
supabase.functions.invoke('admin-create-user', {
  body: { email, password, full_name, phone }
})

// TO:
supabase.functions.invoke('create-staff-user', {
  body: {
    email: newUserFormData.email,
    fullName: newUserFormData.full_name,
    phone: newUserFormData.phone,
    role: newUserFormData.role,       // 'staff' or 'manager'
    branchId: newUserFormData.branch_id,
  }
})
```

Also remove the manual employee record insert, role assignment, staff_branches insert, and branch_managers insert after the function call -- `create-staff-user` already handles all of that.

---

## Issue 2: Benefits Not Synced Between Settings and Plans

**Root Cause:** Two separate "Add Benefit Type" UIs write to the same `benefit_types` table but use different icon systems:

- **Settings > Benefits** (`BenefitTypesManager.tsx`): Uses Lucide icon names (e.g., "Thermometer", "Snowflake") and has full fields (category, duration, bookable toggle)
- **Plans > Add Custom** (`AddPlanDrawer.tsx` line 488-533): Uses a Dialog (not a Drawer) with emoji icons (🎁) and only has name/code/icon fields

**Fix:** Remove the inline "Add Custom Benefit Type" Dialog from `AddPlanDrawer.tsx` and replace it with a link/message directing users to Settings > Benefits to manage benefit types. This ensures:
- Single source of truth for benefit type management
- Consistent icon format (Lucide names)
- All fields are captured (category, duration, bookable)

**File:** `src/components/plans/AddPlanDrawer.tsx`

Changes:
1. Remove the Dialog component for adding custom benefit types (lines 488-533)
2. Change the "Add Custom" button to navigate to Settings > Benefits tab (or show a helpful message)
3. Remove unused state variables (`addBenefitDialogOpen`, `newBenefitName`, `newBenefitCode`, `newBenefitIcon`)

---

## Files to Modify

| File | Change |
|------|--------|
| `src/components/employees/AddEmployeeDrawer.tsx` | Switch from `admin-create-user` to `create-staff-user`; remove duplicate record creation logic |
| `src/components/plans/AddPlanDrawer.tsx` | Remove inline benefit type Dialog; redirect to Settings > Benefits |

No database changes needed.

