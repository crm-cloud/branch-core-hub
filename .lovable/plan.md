

# Critical Fix: Membership Freeze Logic and UI State

---

## Root Cause Analysis

### Bug 1: Freeze Approval Does Nothing (CRITICAL)
The member's freeze request in `MemberRequests.tsx` stores the membership ID as `membership_id` in `request_data`:
```
request_data: { membership_id: activeMembership?.id, reason: freezeReason }
```
But the approval handler in `ApprovalQueue.tsx` reads it as `requestData.membershipId` (camelCase). This key mismatch means the `.eq('id', undefined)` update silently does nothing -- the membership status never changes to `frozen`.

### Bug 2: Member UI Can't See Frozen Memberships
`useMemberData.ts` queries memberships with `.eq('status', 'active')`. When a membership IS frozen, `activeMembership` returns `null`. The UI thinks the member has no membership at all, so it never shows the frozen state.

### Bug 3: No Unfreeze Flow for Members
There is no way for a member to request an unfreeze. The card always shows "Request Freeze" regardless of state.

### Check-in (Already Working)
The database function `validate_member_checkin` already checks for frozen status and returns "Membership is currently frozen". No changes needed here.

---

## Fix Plan

### Fix 1: Data Key Mismatch (MemberRequests.tsx)
Change `membership_id` to `membershipId` in the freeze request `request_data` so the approval handler can find it. This is a one-line fix.

### Fix 2: Query Frozen Memberships (useMemberData.ts)  
Change the membership query from `.eq('status', 'active')` to `.in('status', ['active', 'frozen'])` so the hook returns frozen memberships too. The `activeMembership` object will then correctly reflect `status: 'frozen'`.

### Fix 3: Conditional Freeze/Unfreeze Card (MemberRequests.tsx)
Update the Freeze Membership card with conditional rendering:
- **If membership is active**: Show current card (snowflake icon, "Freeze Membership" title, "Request Freeze" button)
- **If membership is frozen**: Show a blue-tinted card with:
  - Snowflake icon + "Membership Frozen" title
  - Description: "Your membership is currently paused. You do not have gym access."
  - A "Paused" badge on the card
  - Button: "Request Unfreeze" which submits an unfreeze approval request

### Fix 4: Unfreeze Request Submission (MemberRequests.tsx)
Add a new mutation `submitUnfreezeRequest` that inserts into `approval_requests` with `approval_type: 'membership_freeze'` and `reference_type: 'membership_unfreeze'` so the approval queue can distinguish it.

### Fix 5: Handle Unfreeze Approval (ApprovalQueue.tsx)
Add logic in the approval handler: when `reference_type === 'membership_unfreeze'` is approved, call the `resumeFromFreeze` logic (update membership status back to `active` and recalculate end date).

---

## Files to Modify

| File | Change |
|------|--------|
| `src/pages/MemberRequests.tsx` | Fix `membership_id` to `membershipId` in request_data; add frozen state conditional UI; add unfreeze mutation |
| `src/hooks/useMemberData.ts` | Change `.eq('status', 'active')` to `.in('status', ['active', 'frozen'])` |
| `src/pages/ApprovalQueue.tsx` | Add unfreeze approval handler that resumes membership |

---

## Technical Details

### useMemberData.ts (line 59)
```text
Before: .eq('status', 'active')
After:  .in('status', ['active', 'frozen'])
```

### MemberRequests.tsx - request_data fix (line 53)
```text
Before: membership_id: activeMembership?.id
After:  membershipId: activeMembership?.id
```

### MemberRequests.tsx - Freeze card conditional rendering
```text
IF activeMembership?.status === 'frozen':
  - Card background: blue-tinted border (border-blue-300)
  - Title: "Membership Frozen" with Snowflake icon
  - Badge: "Paused" in blue
  - Description: "Your membership is currently paused. You do not have gym access."
  - Button: "Request Unfreeze" (disabled if pending unfreeze exists)

ELSE (active):
  - Current card as-is
```

### ApprovalQueue.tsx - Unfreeze handler
When approved and `reference_type === 'membership_unfreeze'`:
1. Get the membership from `requestData.membershipId`
2. Query `membership_freeze_history` for total frozen days
3. Calculate new end_date = original_end_date + total_frozen_days
4. Update membership: `status: 'active'`, `end_date: newEndDate`

