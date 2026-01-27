

# Comprehensive Audit & Fix Plan for Incline Gym App

## Executive Summary
This audit identified 7 key issues across Feedback, Membership, Member Management, Task Assignment, Equipment Maintenance, and UI accessibility. Several issues have already been partially fixed in previous iterations.

---

## Issue 1: Feedback Page - PARTIALLY FIXED

### Current Status
The Supabase 400 error was fixed in the last session by implementing a two-step query pattern:
1. Fetch feedback with basic relations (user_id only)
2. Fetch profiles separately and merge

### Remaining Work: Google Sync Mock Integration
**File:** `src/pages/Feedback.tsx`

Add a mock `syncToGoogleMyBusiness` function that prepares data for the Google Business Profile API:

```typescript
// Add after the updateStatus mutation (around line 94)
const syncToGoogleMyBusiness = async (reviewId: string, feedback: any) => {
  // Mock implementation - prepares data for Google Business API
  const reviewData = {
    reviewId,
    starRating: feedback.rating,
    comment: feedback.feedback_text,
    reviewerName: feedback.member_name || 'Anonymous',
    createTime: feedback.created_at,
    // Google Business Profile API endpoint would be:
    // POST https://mybusiness.googleapis.com/v4/accounts/{accountId}/locations/{locationId}/reviews/{reviewId}/reply
  };
  
  console.log('Prepared for Google sync:', reviewData);
  toast.success('Review prepared for Google Business sync');
  return reviewData;
};
```

**Enhancement:** When "Publish to Google" toggle is enabled, call the sync function.

---

## Issue 2: Clean Membership Logic - ALREADY FIXED

### Current Status
The membership status is now calculated dynamically in `Members.tsx`:

```typescript
// Lines 93-103: Dynamic status calculation
const activeMembership = m.memberships?.find((ms: any) => {
  const now = new Date();
  const start = new Date(ms.start_date);
  const end = new Date(ms.end_date);
  return ms.status === 'active' && now >= start && now <= end;
});
return {
  ...m,
  status: activeMembership ? 'active' : 'inactive',
};
```

### Remaining Work: Expiration Display Enhancement
**File:** `src/components/members/MemberProfileDrawer.tsx`

When `daysLeft <= 0`, enhance the UI to:
1. Show "No Active Plan" instead of "0" days
2. Hide plan name and show "EXPIRED" badge in red
3. Change "Renew Plan" button to "Buy Plan"

**Lines to modify:** 293-298 (Quick Stats card)

```typescript
// Replace current daysLeft display
{activeMembership ? (
  daysLeft > 0 ? (
    <div className={`text-2xl font-bold ${getDaysLeftColor(daysLeft)}`}>{daysLeft}</div>
  ) : (
    <div className="text-2xl font-bold text-destructive">EXPIRED</div>
  )
) : (
  <div className="text-lg font-bold text-muted-foreground">No Plan</div>
)}
```

### Duplicate Prevention / Upgrade Plan
**File:** `src/components/members/MemberProfileDrawer.tsx` (Lines 319-327)

When member has an active plan, disable "Add Plan" and show "Upgrade Plan":
- Check if `activeMembership` exists and has `daysLeft > 0`
- If true: Show "Upgrade Plan" button (calculates pro-rated value)
- If false: Show "Add Plan" button

---

## Issue 3: Member Management - Edit Side Drawer (NOT Dialog)

### Current Status
`EditProfileDialog.tsx` uses a Dialog component (lines 68-119). Per project memory, the system enforces a **strict Side Drawer policy** for all edit workflows.

### Required Changes

**File:** `src/components/members/EditProfileDialog.tsx`

Convert Dialog to Sheet (Side Drawer):
1. Replace `Dialog` imports with `Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter`
2. Add missing fields: Emergency Contact Name, Emergency Contact Phone
3. Add Avatar Upload component integration

**Rename file to:** `src/components/members/EditProfileDrawer.tsx`

**New structure:**
```typescript
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { MemberAvatarUpload } from './MemberAvatarUpload';

// Add fields for:
// - full_name (existing)
// - phone (existing)
// - email (existing)
// - emergency_contact_name (NEW)
// - emergency_contact_phone (NEW)
// - Avatar upload component (NEW)
```

### Avatar Storage
Currently using `avatars` bucket. Consider creating a dedicated `member-avatars` bucket for facial recognition integration:

**Database Migration:**
```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('member-avatars', 'member-avatars', false)
ON CONFLICT (id) DO NOTHING;
```

**Update MemberAvatarUpload.tsx (line 66):** Change bucket from `'avatars'` to `'member-avatars'`

---

## Issue 4: Task Management - Assignment Dropdown

### Current Status (ALREADY WORKING)
The `AddTaskDrawer.tsx` already has proper assignment functionality:
- Lines 22-45: Fetches staff users filtered by roles (trainer, staff, manager, admin, owner)
- Lines 138-148: "Assign To" dropdown populated with staff users
- Line 78: `assignedTo` is properly passed to createTask mutation

### Required Enhancement
**File:** `src/pages/Tasks.tsx`

Add ability to reassign tasks directly from the table (not just when creating):

1. Add an "Assign To" column with inline dropdown
2. Create a mutation to update assignment:

```typescript
const assignTaskMutation = useMutation({
  mutationFn: ({ taskId, userId }: { taskId: string; userId: string }) => 
    assignTask(taskId, userId, user?.id || ''),
  onSuccess: () => {
    toast.success('Task assigned');
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
  },
});
```

3. Fetch assignable staff users (same query as AddTaskDrawer)
4. Add inline Select dropdown in TableCell for "Assigned To" column

---

## Issue 5: Fix UI Errors

### A. RadioGroup value="" Error
**File:** `src/components/members/AssignTrainerDrawer.tsx` (Line 172)

**Current:**
```tsx
<RadioGroupItem value="" id="no-trainer" />
```

**Fix:**
```tsx
<RadioGroupItem value="none" id="no-trainer" />
```

Also update the logic that handles this value to treat "none" as null.

### B. DialogTitle Accessibility
All Dialog components currently have DialogTitle - VERIFIED CORRECT.

The EquipmentMaintenance.tsx Dialog at line 222 has DialogTitle at line 224.

---

## Issue 6: Equipment Maintenance - Dialog vs Side Drawer

### Current Status
**File:** `src/pages/EquipmentMaintenance.tsx` (Lines 213-275)

Uses Dialog for "Log Maintenance" which violates the project's UI drawer policy.

### Required Change
Convert the maintenance logging Dialog to a Side Drawer:

1. Replace `Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger` with Sheet components
2. Use SheetTrigger instead of DialogTrigger
3. Maintain the same form functionality

---

## Implementation Summary

| Issue | Priority | Complexity | Status |
|-------|----------|------------|--------|
| Feedback Google Sync | Low | Low | Add mock function |
| Membership Expiration UI | Medium | Low | Enhance display |
| Edit Profile → Drawer | High | Medium | Convert Dialog to Sheet |
| Task Reassignment | Medium | Medium | Add inline dropdown |
| RadioGroup value="" | High | Low | Change to "none" |
| Maintenance Dialog → Drawer | Medium | Low | Convert to Sheet |
| Member-avatars bucket | Low | Low | Create storage bucket |

---

## Files to Modify

1. **src/pages/Feedback.tsx** - Add mock Google sync function
2. **src/components/members/EditProfileDialog.tsx** - Rename to EditProfileDrawer.tsx, convert to Sheet, add fields
3. **src/components/members/MemberProfileDrawer.tsx** - Update import, enhance expired state display
4. **src/components/members/AssignTrainerDrawer.tsx** - Fix RadioGroup value=""
5. **src/pages/Tasks.tsx** - Add inline assignment dropdown
6. **src/pages/EquipmentMaintenance.tsx** - Convert Dialog to Sheet
7. **src/components/members/MemberAvatarUpload.tsx** - Update bucket to 'member-avatars'

## New Files

1. None (renaming EditProfileDialog → EditProfileDrawer)

## Database Migrations

1. Create `member-avatars` storage bucket with RLS policies

