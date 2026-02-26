

# Security & Consistency Audit: 4 Fixes

## 1. Unify Add/Edit Employee Forms

**Problem:** Add and Edit employee drawers have mismatched fields:
- **AddEmployeeDrawer** DEPARTMENTS: `['Management', 'Fitness', 'Sales', 'Operations', 'Maintenance']`
- **EditEmployeeDrawer** DEPARTMENTS: `['Management', 'Front Desk', 'Training', 'Housekeeping', 'Maintenance', 'Sales', 'Marketing', 'Finance', 'HR']`
- Add uses a `Select` dropdown for Position (5 fixed options). Edit uses a free-text `Input` for Position.
- Edit has Bank Details, Tax ID, Active Status toggle, Compensation section. Add only has Salary + Salary Type.
- Edit has `salary_type` options: monthly/hourly/weekly. Add has only a hidden default of 'monthly'.

**Fix:**
- Unify both DEPARTMENTS and POSITIONS constants into a shared file: `src/constants/employeeConstants.ts`
- **EditEmployeeDrawer**: Change Position from free-text `Input` to `Select` dropdown (matching Add)
- **AddEmployeeDrawer**: Add Salary Type `Select` dropdown (matching Edit's monthly/hourly/weekly options), and add Bank Details + Tax ID fields to the "Create New" tab
- Both forms will share the same field set. The Edit form retains its Active Status toggle (not needed for Add since new employees default to active).

**Files:**
- New: `src/constants/employeeConstants.ts`
- Edit: `src/components/employees/AddEmployeeDrawer.tsx` (add salary_type selector, bank details, tax_id)
- Edit: `src/components/employees/EditEmployeeDrawer.tsx` (use shared constants, change Position to Select)

---

## 2. Branch Selector RBAC Visibility

**Problem:** The `AppHeader` currently shows the branch selector for `owner`, `admin`, `manager` roles equally with "All Branches" option. But:
- Managers should only see their assigned branches (from `staff_branches` table), not all branches
- If a manager has only 1 branch, hide the selector entirely and lock context to that branch
- Staff/Trainer/Member roles should never see the selector

**Fix:**
- **BranchContext**: Add role-aware initialization logic
  - For `owner`/`admin`: Load all branches, show "All Branches" option
  - For `manager`: Query `staff_branches` for assigned branches only. If single branch, auto-set and hide selector. No "All Branches" option.
  - For `staff`/`trainer`/`member`: Query their `branch_id` from `employees`/`trainers`/`members` table. Auto-set to that branch. Never show selector.
- **AppHeader**: Update `showBranchSelector` logic:
  - `owner`/`admin`: always show
  - `manager` with multiple branches: show (no "All" option)
  - Everyone else: hide

**Files:**
- Edit: `src/contexts/BranchContext.tsx` (add role-aware branch loading)
- Edit: `src/components/layout/AppHeader.tsx` (update visibility logic, conditionally hide "All" option)

---

## 3. Remove Role Badge from Header

**Problem:** The role badge ("Owner", "Admin") in the top navbar is unnecessary -- the role is already shown in the user dropdown menu.

**Fix:**
- Remove the `<Badge>` element at line 87-89 of `AppHeader.tsx` that displays `primaryRoleString`
- Keep the role badge inside the `DropdownMenuLabel` (line 125-127) since it provides context in the user menu

**File:** `src/components/layout/AppHeader.tsx`

---

## 4. Restrict Profile Edit Capabilities

**Problem:** Two separate issues:

**A) Admin EditProfileDrawer (used in MemberProfileDrawer):**
- Allows editing Full Name, Email, Avatar -- all of which should be admin-only locked fields for members
- Currently any admin can change a member's name/email which is fine, but the avatar upload and fitness goal editing are also there

**B) Member's own MemberProfile page (`/member/profile`):**
- Has a "Change Password" dialog that lets members directly call `updatePassword()` -- this is a security concern since there's no current-password verification
- Members can edit Phone + Emergency Contact (correct)
- Email and Name are already disabled (correct)

**Fix:**

**EditProfileDrawer (Admin context):**
- Keep all fields editable (admins need full control)
- No changes needed -- this is the admin tool

**MemberProfile page:**
- Remove the "Change Password" dialog entirely
- Replace with a "Reset Password" button that calls `supabase.auth.resetPasswordForEmail(profile.email)` -- sends a secure email link instead of allowing direct password change without current-password verification
- Remove avatar upload capability from member self-edit (only admin can change avatar via the admin EditProfileDrawer)
- Keep editable: Phone, Emergency Contact Name, Emergency Contact Phone
- Keep read-only: Email, Full Name, Status, Member Since, Branch

**File:**
- Edit: `src/pages/MemberProfile.tsx` (replace password dialog with reset email button, remove avatar edit)

---

## Execution Order

| Step | Priority | Files | Description |
|------|----------|-------|-------------|
| 1 | Critical | `BranchContext.tsx`, `AppHeader.tsx` | RBAC branch selector + remove role badge |
| 2 | High | `MemberProfile.tsx` | Restrict member edit capabilities, replace password dialog |
| 3 | Medium | New constants file, `AddEmployeeDrawer.tsx`, `EditEmployeeDrawer.tsx` | Unify employee forms |

