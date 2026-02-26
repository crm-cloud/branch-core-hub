

# Multi-Issue Fix Plan: 7 Bug Fixes and Improvements

## Issues Identified

### 1. Member Name Showing "Unknown" on Attendance Page

**Root Cause:** In `attendanceService.ts`, both `getTodayAttendance` (line 74) and `getCheckedInMembers` (line 106) query `members(member_code, user_id)` but do NOT join the `profiles` table. The UI in `Attendance.tsx` accesses `attendance.members?.profiles?.full_name` which is always `undefined`.

**Fix:** Update the Supabase select queries in `attendanceService.ts` to include the profiles join:
```
members(member_code, user_id, profiles:user_id(full_name, avatar_url, phone))
```
Update the `MemberAttendanceWithDetails` interface to include the nested profiles shape.

**Files:** `src/services/attendanceService.ts`

---

### 2. "Includes Free Locker" vs Locker Benefit Type Redundancy

**Assessment:** The "Includes Free Locker" toggle on the plan drawer is a legacy shortcut. Since there is already a "Locker" benefit type (code: `LOCKER`) in the database, having a separate toggle is redundant. However, the locker toggle also has a "Locker Size" sub-option which the benefit system doesn't provide.

**Fix:** Keep both for now but add a clarification label: "This auto-assigns a physical locker upon membership purchase. For locker session tracking, add the Locker benefit type above." No code removal needed -- this is a UX clarification.

**Files:** `src/components/plans/AddPlanDrawer.tsx`, `src/components/plans/EditPlanDrawer.tsx` (add helper text)

---

### 3. Benefit Icons Not Showing in Edit Plan Drawer

**Root Cause:** In `EditPlanDrawer.tsx`, line 68 stores `icon: bt.icon || '🎁'` as the raw string from the database (e.g., "Snowflake", "Thermometer"). At line 432, it renders `{benefit.icon}` as plain text. The `AddPlanDrawer` correctly uses `getBenefitIcon(bt.code)` to get actual Lucide components, but `EditPlanDrawer` does not.

**Fix:**
- Import `getBenefitIcon` from `@/lib/benefitIcons` and `* as LucideIcons` into `EditPlanDrawer.tsx`.
- Replace the text icon rendering at line 432 with a dynamic Lucide icon component lookup using the icon name string, falling back to `getBenefitIcon(benefit.code)`.
- Create a helper: `const IconComp = (LucideIcons as any)[benefit.icon] || getBenefitIcon(benefit.code);`

**Files:** `src/components/plans/EditPlanDrawer.tsx`

---

### 4. Unable to Upload Gym Logo (RLS Error)

**Root Cause:** The error toast "new row violates row-level security policy" appears when trying to save organization settings. The `organization_settings` table has an INSERT policy that requires `has_any_role(auth.uid(), ARRAY['owner', 'admin'])` but the RLS policy only covers `ALL` (which maps to SELECT/INSERT/UPDATE/DELETE for admin). The issue is that the `ALL` policy has `WITH CHECK` clause that may be missing, or there's no explicit INSERT policy. Looking at the policies: there's `Admin can manage org settings` (ALL) with `USING` but potentially missing `WITH CHECK`.

Actually, the real issue: when `orgSettings` is null (no row exists yet), the code does an INSERT (line 63-66 in OrganizationSettings.tsx). The `Admin can manage org settings` policy uses `has_any_role` for ALL operations. The user IS the owner. Let me check if the `WITH CHECK` is missing on the ALL policy.

**Fix:** Create a migration to add an explicit INSERT policy with a `WITH CHECK` clause, or update the existing ALL policy to include `WITH CHECK (true)` for owner/admin roles. Also add a public SELECT policy for the `website_theme` column so the public website can read it without auth.

**Files:** New DB migration

---

### 5. Audit Log UI/UX Redesign for Human Readability

**Current State:** The audit log page already has human-readable descriptions from the `action_description` column and collapsible data diff views. But it can be improved with:
- A timeline-style layout instead of plain collapsible rows
- Color-coded action pills (already done but can be enhanced)
- Better summary text formatting (actor name bolded, table name as a badge)
- Grouping by date with section headers ("Today", "Yesterday", "Feb 24")
- A quick-view of changed fields count in the collapsed row

**Fix:**
- Add date grouping headers (Today, Yesterday, specific dates)
- Bold the actor name and use a badge for the table name in the summary line
- Show "X fields changed" count in collapsed view for UPDATE actions
- Clean up the data diff view with better labeling ("Before → After")
- Add a mini timeline connector (vertical line between rows)

**Files:** `src/pages/AuditLogs.tsx`

---

### 6. Branch Manager Not Showing in Branch List

**Root Cause:** Neither `BranchSettings.tsx` nor `Branches.tsx` fetch or display the branch manager. The branch list table has columns for Branch, Code, Location, Contact, Status, Actions -- but NO "Manager" column. The manager IS correctly stored in `branch_managers` table (verified: Neha Verma is assigned as primary manager for the main branch). The `EditBranchDrawer` correctly fetches and displays the manager, but the list views don't show it.

**Fix:**
- Add a "Manager" column to both `BranchSettings.tsx` and `Branches.tsx` branch tables.
- Fetch branch managers with a join when loading branches, or do a separate query.
- Display the manager name (with a fallback "No manager") in the table.

**Files:** `src/components/settings/BranchSettings.tsx`, `src/pages/Branches.tsx`

---

### 7. Front Website Not Synced with Settings

**Root Cause:** In `PublicWebsite.tsx` line 103, the theme is loaded synchronously via `cmsService.getTheme()` which reads from localStorage only. It never calls the async `getThemeAsync()` which fetches from the database. So the public website only shows localStorage-cached data (which is empty for new visitors).

**Fix:**
- Change `PublicWebsite.tsx` to call `cmsService.getThemeAsync()` inside a `useEffect` and update state when the database data loads.
- Keep the synchronous `getTheme()` as initial state for instant render, then replace with DB data.

**Files:** `src/pages/PublicWebsite.tsx`

---

## Execution Order

| Step | Priority | Files | Description |
|------|----------|-------|-------------|
| 1 | Critical | `src/services/attendanceService.ts` | Fix member name by adding profiles join |
| 2 | Critical | `src/components/plans/EditPlanDrawer.tsx` | Fix benefit icons with Lucide components |
| 3 | Critical | DB Migration | Fix org_settings RLS for INSERT + public read |
| 4 | High | `src/pages/PublicWebsite.tsx` | Load theme from DB async |
| 5 | High | `src/components/settings/BranchSettings.tsx`, `src/pages/Branches.tsx` | Add Manager column |
| 6 | Medium | `src/pages/AuditLogs.tsx` | Redesign with date groups + timeline |
| 7 | Low | `src/components/plans/AddPlanDrawer.tsx`, `src/components/plans/EditPlanDrawer.tsx` | Add locker clarification text |

