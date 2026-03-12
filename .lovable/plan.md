

# Fix: Database Errors, Trainer Assignment, and Attendance Hierarchy

## Root Cause Analysis

### 1. `[object Object]` and `get_inactive_members` 400 Errors (CRITICAL)

**Root cause**: React Query cache key collision. Both `StaffDashboard.tsx` and `FollowUpCenter.tsx` use the same query key `['staff-branch', user?.id]` but return **different data types**:
- `StaffDashboard` returns an **object** `{id, name}`
- `FollowUpCenter` expects a **string** UUID

When both pages share the cache, FollowUpCenter gets `{id, name}` as `branchId`, which becomes `[object Object]` in every subsequent query — causing all 400 errors for `memberships`, `get_inactive_members`, etc.

**Fix**: Align FollowUpCenter to use the same query shape as StaffDashboard (return object, extract `.id`), OR use distinct query keys. Simplest: make FollowUpCenter return an object and extract `.id`.

### 2. AssignTrainer Drawer Reopening

The `AssignTrainerDrawer` inside `MemberProfileDrawer` doesn't reset `selectedTrainerId` when `currentTrainerId` changes after assignment. After assigning, `invalidateQueries(['members'])` re-fetches member data, but the drawer's `useState` initializer (`currentTrainerId || ''`) only runs on first mount. Also, the mutation invalidates `['trainers-utilization']` which triggers a refetch that increments the client count visually.

**Fix**: Add a `useEffect` to reset `selectedTrainerId` when `currentTrainerId` prop changes, and close the drawer properly.

### 3. Attendance Hierarchy (Self-check-in restrictions)

Current state: Any staff can self-check-in. User requirement:
- Staff **cannot** self-check-in (must be done by manager/admin or device)
- Manager can record attendance for staff but **not for themselves**
- Admin can record attendance for managers
- Everyone syncs with face terminals as primary method

**Fix**: Add role-based validation to `staffAttendanceService.checkIn` and the UI. Staff self-check-in button becomes disabled; instead, managers see a "Record Attendance" UI for their team.

### 4-5. Payment Links & WhatsApp Business API

These are feature requests, not bugs. Will note recommendations but focus on fixing the critical errors first.

---

## Implementation Plan

### File Changes

| File | Change |
|------|--------|
| `src/pages/FollowUpCenter.tsx` | Fix `staffBranch` query to return object (align with StaffDashboard), extract `.id` for `branchId` |
| `src/components/members/AssignTrainerDrawer.tsx` | Add `useEffect` to sync `selectedTrainerId` with `currentTrainerId` prop; prevent count duplication |
| `src/pages/StaffAttendance.tsx` | Enforce attendance hierarchy — staff can't self-check-in, managers can record for staff below them |
| `src/hooks/useStaffAttendance.ts` | Add `recordAttendanceFor` function for managers/admins to check in other users |

### Detail

**FollowUpCenter.tsx (lines 22-38)**: Change the staffBranch query to:
```typescript
const { data: staffBranch } = useQuery({
  queryKey: ['staff-branch-id', user?.id],  // distinct key
  enabled: !!user,
  queryFn: async () => {
    const { data: employee } = await supabase
      .from('employees')
      .select('branch_id')
      .eq('user_id', user!.id)
      .eq('is_active', true)
      .maybeSingle();
    if (employee?.branch_id) return employee.branch_id;
    const { data: branches } = await supabase
      .from('branches').select('id')
      .eq('is_active', true).limit(1);
    return branches?.[0]?.id || null;
  },
});
const branchId = staffBranch;
```

**AssignTrainerDrawer.tsx**: Add effect to reset selected trainer when props change and when drawer opens:
```typescript
useEffect(() => {
  if (open) {
    setSelectedTrainerId(currentTrainerId || '');
  }
}, [open, currentTrainerId]);
```

**StaffAttendance.tsx**: Modify self-check-in to be role-gated:
- Staff/Trainer: hide self check-in button (attendance via device or manager)
- Manager: can check in staff but not self
- Admin/Owner: can check in anyone including managers
- Add a "Record Staff Attendance" section for managers/admins with user selection

