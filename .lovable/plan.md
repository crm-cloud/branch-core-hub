

# Approval Portal & Dashboard Enhancement Plan for Incline Gym

## Executive Summary

This plan implements a comprehensive Request-Response architecture for membership lifecycle management, enhanced dashboards with CRM widgets, and improved data synchronization across the system. Most core infrastructure already exists - this plan fills the remaining UI/UX gaps and adds missing features.

---

## Current State Analysis

### Already Implemented (No Changes Needed)

| Feature | Status | Evidence |
|---------|--------|----------|
| Approval Requests Table | Database exists with proper schema | `approval_requests` table with types: membership_freeze, membership_transfer, refund, discount, complimentary, expense, contract |
| Freeze Approval Flow | Fully implemented | `FreezeMembershipDrawer.tsx` creates approval request, `ApprovalRequestsDrawer.tsx` processes approve/reject |
| Member Request Portal | Exists | `MemberRequests.tsx` at `/my-requests` allows members to submit freeze & trainer change requests |
| Turnstile Frozen Handling | Correctly implemented | `device-access-event` edge function returns "Membership Frozen" denial via `validate_member_checkin` RPC |
| Admin Menu with Devices | Properly configured | `menu.ts` includes Devices under Operations for owner/admin/manager roles |
| Dashboard with Live Access | Already embedded | `Dashboard.tsx` includes `LiveAccessLog` component for real-time attendance feed |
| Frozen Members Analytics | Included in Inactive count | Members page shows inactive count which includes frozen members |

---

## Issues Requiring Implementation

### Issue 1: Staff "Quick Freeze" Button Missing

**Current State:** Staff can only freeze via the approval flow in member profile drawer

**Problem:** Staff need ability to bypass approval queue and apply immediate freeze for operational efficiency

**Solution:** Add "Quick Freeze" action to Members table dropdown menu

**File to Modify:** `src/pages/Members.tsx`

**Technical Details:**
- Add dropdown menu item "Quick Freeze" with snowflake icon
- Opens a simplified dialog (not the full approval drawer)
- Directly updates membership status to 'frozen' and creates freeze history record
- Only visible to staff/manager/admin roles
- Logs the action in audit trail

```typescript
// Add to dropdown menu (after "Buy PT Package")
<DropdownMenuItem 
  onClick={() => handleQuickFreeze(member)}
  disabled={!activeMembership || activeMembership.status === 'frozen'}
>
  <Snowflake className="h-4 w-4 mr-2" />
  Quick Freeze
</DropdownMenuItem>
```

---

### Issue 2: Dedicated Manager Approval Queue Page Missing

**Current State:** `ApprovalRequestsDrawer.tsx` exists as a drawer, not a dedicated page

**Problem:** Managers need a dedicated `/approvals` page with better visibility, not hidden in a drawer

**Solution:** Create dedicated Approval Queue page and add to sidebar

**Files to Create:**
- `src/pages/ApprovalQueue.tsx` - Dedicated full-page approval dashboard

**Files to Modify:**
- `src/config/menu.ts` - Add "Approvals" menu item under CRM & Engagement
- `src/App.tsx` - Add route

**Technical Details:**
```typescript
// New page features:
// 1. Stats cards at top: Pending | Approved Today | Rejected Today
// 2. Tabbed interface: Pending | All Requests | My Decisions
// 3. Bulk approve/reject for similar requests
// 4. Filter by type: Freeze, Transfer, Refund, Discount, etc.
// 5. Search by member name or code
// 6. Real-time updates via Supabase subscription
```

---

### Issue 3: Dashboard "Your Roles" Widget Should Be Removed

**Current State:** Dashboard shows "Your Roles" card at bottom (lines 328-344)

**Problem:** Redundant - role is now displayed in AppHeader profile dropdown

**Solution:** Remove the "Your Roles" card from Dashboard

**File to Modify:** `src/pages/Dashboard.tsx`

**Technical Details:**
- Remove lines 328-344 (the roles card)
- The role badge is already prominently displayed in AppHeader

---

### Issue 4: Membership Distribution Chart Labels Truncated

**Current State:** Pie chart shows labels with format `${name} ${percent}%`

**Problem:** Long plan names get cut off; no legend for reference

**Solution:** Enhance chart with proper legend below the pie

**File to Modify:** `src/components/dashboard/DashboardCharts.tsx`

**Technical Details:**
```typescript
// Update MembershipDistribution component:
// 1. Add Legend component from recharts
// 2. Position legend at bottom
// 3. Show plan name with count (not just percentage)
// 4. Use distinct colors (expand COLORS array to 8 colors)
// 5. Add empty state: "No active memberships"
```

---

### Issue 5: New CRM Dashboard Widgets Needed

**Current State:** Dashboard has basic stats and existing charts

**Problem:** Missing advanced CRM widgets for peak hours, revenue tracking, facility usage, and urgent expiries

**Solution:** Add 4 new widgets to Dashboard

**File to Modify:** `src/pages/Dashboard.tsx`

**Technical Details:**

**Widget 1: Hourly Attendance (Check-ins per Hour)**
```typescript
// Query member_attendance grouped by hour for today
// Display as line chart showing peak gym times
// Hours on X-axis (6AM-10PM), check-ins on Y-axis
```

**Widget 2: Revenue Snapshot (Pending vs Collected)**
```typescript
// Query invoices for current month
// Calculate: Collected, Pending, Overdue amounts
// Display as horizontal progress bar with 3 segments
```

**Widget 3: Expiring in 48 Hours (Critical List)**
```typescript
// Query memberships WHERE end_date <= now() + 48 hours AND status = 'active'
// Display top 5 as list with member name, code, hours remaining
// Click to open member profile
```

**Widget 4: Pending Approvals Counter**
```typescript
// Query approval_requests WHERE status = 'pending'
// Show count with badge
// Click to open Approval Queue page
```

---

### Issue 6: Frozen Members Not Explicitly Shown in Analytics

**Current State:** Frozen members are grouped with "inactive" in member stats

**Problem:** Frozen is different from inactive - need separate visibility

**Solution:** Add "Frozen" stat card to Members page and Dashboard

**Files to Modify:**
- `src/pages/Members.tsx` - Add frozen count to stats grid
- `src/pages/Dashboard.tsx` - Add frozen count query

**Technical Details:**
```typescript
// Add to stats query
const { count: frozenMembers } = await supabase
  .from('memberships')
  .select('id', { count: 'exact' })
  .eq('status', 'frozen');
```

---

### Issue 7: Trainer Change Approval Type Missing from Enum

**Current State:** `MemberRequests.tsx` uses 'complimentary' as workaround for trainer change

**Problem:** No dedicated `trainer_change` approval type in database enum

**Solution:** Add proper handling for trainer change requests OR migrate to use existing `complimentary` type consistently

**Database Change:** Add `trainer_change` to approval_type enum (optional - can use reference_type instead)

**Files to Modify:**
- `src/components/approvals/ApprovalRequestsDrawer.tsx` - Add handler for trainer_change reference_type
- Process trainer change: Update `members.assigned_trainer_id`

---

## Implementation Summary

| Task | Priority | Complexity | Files |
|------|----------|------------|-------|
| Quick Freeze Button | High | Medium | Members.tsx, new QuickFreezeDialog component |
| Dedicated Approval Queue Page | High | Medium | New ApprovalQueue.tsx, menu.ts, App.tsx |
| Remove "Your Roles" Widget | Low | Trivial | Dashboard.tsx |
| Fix Membership Pie Chart Legend | Medium | Low | DashboardCharts.tsx |
| Add Hourly Attendance Widget | Medium | Medium | Dashboard.tsx |
| Add Revenue Snapshot Widget | Medium | Medium | Dashboard.tsx |
| Add Expiring 48h Widget | High | Low | Dashboard.tsx |
| Add Pending Approvals Widget | Medium | Low | Dashboard.tsx |
| Add Frozen Count to Stats | Medium | Low | Members.tsx, Dashboard.tsx |
| Trainer Change Approval Handler | Medium | Medium | ApprovalRequestsDrawer.tsx |

---

## Files Summary

### New Files (2 total)

| File | Type | Description |
|------|------|-------------|
| `src/pages/ApprovalQueue.tsx` | Page | Full-page approval management with tabs, filters, bulk actions |
| `src/components/members/QuickFreezeDialog.tsx` | Component | Simplified dialog for staff to immediately freeze a membership |

### Modified Files (6 total)

| File | Changes |
|------|---------|
| `src/pages/Members.tsx` | Add Quick Freeze action to dropdown, add frozen count stat card |
| `src/pages/Dashboard.tsx` | Remove "Your Roles", add 4 new CRM widgets, add frozen count query |
| `src/components/dashboard/DashboardCharts.tsx` | Enhance pie chart with proper legend, empty states |
| `src/components/approvals/ApprovalRequestsDrawer.tsx` | Add trainer_change handling |
| `src/config/menu.ts` | Add "Approvals" menu item |
| `src/App.tsx` | Add /approvals route |

---

## Workflow Diagrams

### Member-Initiated Freeze Request Flow

```text
Member Portal                 Database                    Manager Dashboard
[Request Freeze] ─────────► [approval_requests] ◄──────── [View Pending]
      │                         status: pending                │
      │                              │                         │
      │                              ▼                         │
      │                     [Manager Reviews]                  │
      │                              │                         │
      ├─────────────────────────────┬──────────────────────────┤
      ▼                             ▼                          ▼
  [Approved]                    [Rejected]                [Notification]
      │                              │                         │
      ▼                              ▼                         │
[membership_freeze_history] [Status: rejected]                 │
[memberships.status=frozen]        │                           │
      │                             └───────────────────────────┤
      ▼                                                        ▼
[Turnstile: DENIED]                               [Member sees decision]
```

### Staff Quick Freeze Flow (Bypass Approval)

```text
Staff View (Members Page)
[Click Quick Freeze] ─► [Confirm Dialog] ─► [Direct Update]
        │                      │                   │
        │                      │                   ├─► memberships.status = 'frozen'
        │                      │                   ├─► membership_freeze_history INSERT
        │                      │                   └─► audit_logs INSERT
        │                      │                            │
        │                      │                            ▼
        │                      │                   [Turnstile: DENIED immediately]
        │                      │
        └──────────────────────┴─► [Toast: "Membership frozen"]
```

---

## Technical Specifications

### Quick Freeze Dialog Props
```typescript
interface QuickFreezeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: {
    id: string;
    member_code: string;
    profiles?: { full_name: string };
  };
  activeMembership: {
    id: string;
    end_date: string;
    membership_plans?: { name: string };
  };
  onSuccess: () => void;
}
```

### Approval Queue Page Features
```typescript
// Tab structure
type ApprovalTab = 'pending' | 'approved' | 'rejected' | 'all';

// Filters
interface ApprovalFilters {
  type: ApprovalType | 'all';
  dateRange: { start: Date; end: Date } | null;
  searchTerm: string;
}

// Bulk actions (for pending tab only)
type BulkAction = 'approve' | 'reject';
```

### New Dashboard Widgets Data Structure
```typescript
// Hourly Attendance
interface HourlyAttendance {
  hour: string; // "6 AM", "7 AM", etc.
  checkins: number;
}

// Revenue Snapshot
interface RevenueSnapshot {
  collected: number;
  pending: number;
  overdue: number;
  total: number;
}

// Expiring Soon
interface ExpiringMember {
  memberId: string;
  memberCode: string;
  memberName: string;
  hoursRemaining: number;
  planName: string;
}
```

---

## Data Synchronization Verification

### Turnstile Access Control (Already Working)
The `device-access-event` edge function correctly handles frozen status:
- Calls `validate_member_checkin` RPC
- Returns `{ action: 'DENIED', message: 'Membership Frozen', led_color: 'RED' }`
- Logs event to `device_access_events` with `denial_reason: 'frozen'`

### Analytics Accuracy (Needs Enhancement)
- Currently: Frozen counted as "Inactive" 
- After: Add explicit "Frozen" stat card showing count from `memberships WHERE status = 'frozen'`

---

## Empty States for New Widgets

| Widget | Empty State Message |
|--------|-------------------|
| Hourly Attendance | "No check-ins recorded today" |
| Revenue Snapshot | "No invoices this month" |
| Expiring 48h | "No memberships expiring soon" |
| Pending Approvals | "All caught up!" with checkmark icon |

