

# Audit & Fix Plan: Branch Manager, Search UI, Demo Data, Stale Data, Branch Selector

## Issues Found

### 1. Branch Manager Assignment Bug (EditBranchDrawer)
**Problem:** When `formData.managerId` is empty (selecting "No manager assigned" → maps to `""`), the `if (formData.managerId)` check on line 116 is falsy, so the manager update is skipped entirely. You cannot unassign a manager, and the "No manager assigned" text persists even after assigning one until page refresh. Also, the drawer doesn't invalidate `branch-manager` query key, so the current manager display is stale.

**Fix:**
- Track whether manager selection changed with a separate flag
- When manager is intentionally cleared, delete existing `branch_managers` row
- Invalidate `['branch-manager', branch.id]` and `['potential-managers']` query keys after save

### 2. Stale Data After Mutations (System-Wide)
**Problem:** After creating/editing entities (employees, branch managers, etc.), the UI doesn't reflect changes without manual refresh. Root cause: mutations only invalidate their own narrow query key but not related ones (e.g., creating an employee with manager role doesn't invalidate `branches`, `branch-manager`, or `potential-managers`).

**Fix in EditBranchDrawer:** Add `queryClient.invalidateQueries({ queryKey: ['branch-manager'] })` after save.
**Fix in AddEmployeeDrawer:** Add `queryClient.invalidateQueries({ queryKey: ['branches'] })` and `queryClient.invalidateQueries({ queryKey: ['potential-managers'] })` after employee creation.
**Fix in AddBranchDialog:** Add `queryClient.invalidateQueries({ queryKey: ['potential-managers'] })` after branch creation.

### 3. Reset Data Uses AlertDialog Instead of Side Drawer
**Problem:** The "Reset All Data" confirmation uses a center `AlertDialog`. Per project rules, center dialogs are only for simple destructive warnings — this IS a destructive confirmation, so it's actually correct per the design spec. However, user wants it changed.

**Fix:** Replace the `AlertDialog` with a `Sheet` (right-side drawer) for the reset confirmation flow.

### 4. Remove Demo Data Feature Entirely
**Problem:** User wants to remove the demo data edge function and UI. Replace with pre-built plan/benefit templates.

**Fix:**
- Remove `DemoDataSettings` component from Settings page
- Remove "Demo Data" from `SETTINGS_MENU`
- Delete `seed-test-data` and `reset-all-data` edge functions
- Add a "Templates" section in Settings for pre-built plan and benefit templates (read-only starter data that admins can import selectively)

### 5. Cmd+K Search Not Aligned with Vuexy Design
**Problem:** Current search opens as a standard `CommandDialog` (Dialog-based) without the Vuexy-style two-column layout with categorized sections (Popular Searches, Apps & Pages, User Interface, Forms & Charts).

**Fix:** Redesign the `GlobalSearch` component to match the Vuexy reference:
- Show a two-column grid layout when no search query is typed
- Left column: "Popular Searches" (Dashboard, Analytics, Members, etc.)
- Right column: "Apps & Pages" (Calendar, Invoice List, Settings, etc.)
- Keep the existing search results behavior when user types
- Add `[esc]` keyboard hint next to close button
- Increase dialog width to accommodate two columns

### 6. Branch Selector Not Working on Some Pages
**Problem:** The `branchFilter` from `BranchContext` is used by most pages, but some pages don't react to branch changes because they use `effectiveBranchId` (which doesn't change when admin switches "All Branches") or they cache query results without including branch in the query key.

Pages confirmed working: Dashboard, Members, Equipment, Invoices, Attendance, Lockers, etc.

Pages to audit:
- `Plans.tsx`: Uses `effectiveBranchId` but the `usePlans` hook may not filter by branch
- `PTSessions.tsx`, `Trainers.tsx`: Use `effectiveBranchId` which returns undefined when "All Branches" selected

**Fix:** Audit the `usePlans` hook and other affected pages to ensure they pass `branchFilter` to their queries and include it in query keys.

---

## Files Summary

| Action | File | Description |
|--------|------|-------------|
| Edit | `src/components/branches/EditBranchDrawer.tsx` | Fix manager assignment/unassignment + invalidate related queries |
| Edit | `src/components/employees/AddEmployeeDrawer.tsx` | Invalidate branches/potential-managers after creation |
| Edit | `src/components/branches/AddBranchDialog.tsx` | Invalidate potential-managers after creation |
| Edit | `src/components/search/GlobalSearch.tsx` | Redesign to Vuexy two-column layout |
| Edit | `src/components/ui/command.tsx` | Widen CommandDialog for two-column search |
| Edit | `src/pages/Settings.tsx` | Remove Demo Data from settings menu |
| Edit | `src/components/settings/DemoDataSettings.tsx` | Replace with Plan/Benefit template importer |
| Delete | `supabase/functions/seed-test-data/index.ts` | Remove demo data edge function |
| Delete | `supabase/functions/reset-all-data/index.ts` | Remove reset data edge function |
| Edit | `src/hooks/usePlans.ts` | Add branch filtering support |
| Edit | Pages using effectiveBranchId | Fix branch selector reactivity |

## Execution Order

| Step | Priority | Description |
|------|----------|-------------|
| 1 | Critical | Fix branch manager assignment in EditBranchDrawer |
| 2 | Critical | Fix stale data — add cross-query invalidation |
| 3 | High | Remove demo data, replace with template importer |
| 4 | High | Redesign Cmd+K search to Vuexy style |
| 5 | High | Fix branch selector on Plans and other pages |
| 6 | Medium | Replace reset AlertDialog with Sheet |

