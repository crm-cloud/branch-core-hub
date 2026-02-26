

# Global Branch Context, Search & Branding Architecture Update

## Current State Analysis

The `BranchContext` already exists and is used by **only 4 pages** (Dashboard, Members, Plans, MemberVoiceWidget). **~18 other pages** create their own local `useBranches()` + `useState('selectedBranch')` pattern, completely ignoring the global context. This means navigating from Dashboard (Branch A selected) to Lockers resets to a different branch -- exactly the bug described.

The `GlobalSearch` component already has Cmd+K support and search logic. It uses a `Popover`, not a `Dialog/CommandDialog`, which may cause UX issues (popover positioning vs centered modal).

The sidebar logo is hardcoded as `<span className="text-sidebar-primary">Incline</span>` in `AppSidebar.tsx` (line 22) and `AppLayout.tsx` mobile header (line 32).

---

## Task 1: Move Branch Selector to Global Header

**File: `src/components/layout/AppHeader.tsx`**

- Import `useBranchContext` and `BranchSelector`
- Add `BranchSelector` to the header, placed between the search bar and the role badge
- Only show for admin/owner/manager roles (check via `useAuth().roles`)
- When a specific branch is selected (not "all"), make the selector text bold via a className override
- Remove the `useBranches()` import from `BranchContext` since it already provides `branches`

**Files to migrate from local state to `useBranchContext()`** (remove local `useBranches()` + `useState` and replace with context):

| Page | Current Pattern | Change |
|------|----------------|--------|
| `Invoices.tsx` | Local `useBranches()` + `selectedBranch` state | Use `useBranchContext()`, remove local `BranchSelector` |
| `Payments.tsx` | Local `useBranches()` + `selectedBranch` state | Same |
| `Attendance.tsx` | Local `useBranches()` + `selectedBranch` state | Same |
| `Trainers.tsx` | Local `useBranches()` + `selectedBranch` state | Same |
| `Classes.tsx` | Local `useBranches()` + `selectedBranch` state | Same |
| `PTSessions.tsx` | Local `useBranches()` + `selectedBranch` state | Same |
| `Lockers.tsx` | Local `useBranches()` + `selectedBranch` state | Same |
| `Equipment.tsx` | Local `useBranches()` + `selectedBranch` state | Same |
| `EquipmentMaintenance.tsx` | Local `useBranches()` + `selectedBranch` state | Same |
| `AllBookings.tsx` | Local `useBranches()` + `selectedBranch` state | Same |
| `StaffAttendance.tsx` | Local `useBranches()` + `selectedBranch` state | Same |
| `AttendanceDashboard.tsx` | Local `useBranches()` + `selectedBranch` state | Same |
| `Feedback.tsx` | Local `useBranches()` + `selectedBranch` state | Same |
| `Announcements.tsx` | Local `useBranches()` + `selectedBranch` state | Same |
| `ApprovalQueue.tsx` | Local `useBranches()` + `selectedBranch` state | Same |
| `WhatsAppChat.tsx` | Local `useBranches()` (no selector) | Use context for default branch |
| `DeviceManagement.tsx` | Local `useBranches()` + `selectedBranch` state | Same |

For each page:
- Replace `const { data: branches } = useBranches()` and `const [selectedBranch, setSelectedBranch] = useState(...)` with `const { selectedBranch, effectiveBranchId, branchFilter, branches } = useBranchContext()`
- Remove the per-page `<BranchSelector>` or `<Select>` component from the page header
- Update query keys and filter logic to use `branchFilter` (undefined = all) and `effectiveBranchId` (for creates)

**Pages that should NOT be affected** (global settings): Settings, AdminUsers, AdminRoles, Branches page itself.

---

## Task 2: Upgrade Cmd+K Search to Dialog Modal

**File: `src/components/search/GlobalSearch.tsx`**

- Replace the `Popover` wrapper with `CommandDialog` (from cmdk) for a proper centered modal experience
- The keyboard shortcut already exists (lines 47-57) and works -- the issue is likely the Popover not gaining focus properly
- Add "Quick Actions" group: "Go to Members", "Go to Settings", "Add New Member" etc. as static items shown when query is empty
- Add "Pages" search: match page names from the menu config against the query

Changes:
- Replace `Popover/PopoverTrigger/PopoverContent` with a trigger button + `CommandDialog`
- Keep the existing search logic intact
- Add a `pages` group that filters `adminMenuConfig` items by query match
- Add quick actions group with common operations

---

## Task 3: Sidebar Logo from Organization Settings

**File: `src/components/layout/AppSidebar.tsx`**

- Add a `useQuery` to fetch `organization_settings` for the `logo_url` and `name` fields
- Replace hardcoded "Incline" text (line 21-23) with:
  - If `logo_url` exists: `<img src={logo_url} alt={orgName} className="max-h-8 object-contain" />`
  - Fallback: `<span className="text-sidebar-primary">{orgName || 'Incline'}</span>`
- Apply same logic to `MobileNav` (line 89-93) and `AppLayout.tsx` mobile header (line 31-33)

---

## Execution Summary

| Priority | File(s) | Change |
|----------|---------|--------|
| 1 | `AppHeader.tsx` | Add global `BranchSelector` from context |
| 2 | 17 page files | Migrate from local branch state to `useBranchContext()`, remove per-page selectors |
| 3 | `GlobalSearch.tsx` | Switch from Popover to CommandDialog, add pages/quick-actions |
| 4 | `AppSidebar.tsx`, `AppLayout.tsx` | Dynamic logo from organization_settings |

No database changes required -- all tables and context already exist.

