

# Comprehensive Audit & Feature Enhancement Plan

This plan addresses all 8 points raised, split into **immediate fixes** (points 1-5) and **feature recommendations** (points 6-8).

---

## Part A: Immediate Fixes

### 1. Backend Errors from System Health (47 open errors)

The screenshots show two recurring errors from `/follow-up-center` and `/staff-dashboard`:

| Error | Root Cause | Fix |
|-------|-----------|-----|
| `column leads.name does not exist` | Code references `lead.name` but column is `full_name` | Already fixed in FollowUpCenter leads query (line 85 uses `full_name`). Need to audit ALL lead rendering code in FollowUpCenter for `lead.name` references in the **JSX template** |
| `column leads.follow_up_date does not exist` | Already fixed in StaffDashboard query | Verify no residual references |
| `Invalid ID format - a record reference is malformed` | A UUID join is failing — likely in the FollowUpCenter leads tab rendering | Audit the leads tab JSX for incorrect property access patterns |

**Action**: Audit `FollowUpCenter.tsx` lines 200-350 (the Leads tab JSX) for `lead.name` references and malformed ID access.

### 2. Page Width / Sidebar Disappearing

The sidebar uses `hidden lg:flex w-64` — it hides below the `lg` breakpoint (1024px). The main content has no `max-width` constraint, so on wide screens or when content overflows horizontally, the layout stretches.

**Fix**:
- Add `min-w-0` to the `flex-1` content container in `AppLayout.tsx` to prevent flex overflow
- Add `overflow-x-hidden` to the main content area
- This prevents table-heavy pages from pushing the sidebar off-screen

### 3. Branch Capacity Setting (Occupancy Gauge hardcoded to 50)

Currently `OccupancyGauge` defaults `capacity = 50`. The `branches` table likely has a `capacity` column (or needs one).

**Fix**:
- Add a `capacity` column to the `branches` table (integer, default 50) via migration if not present
- Read the branch capacity from the selected branch in `Dashboard.tsx` and pass it to `OccupancyGauge`
- Add a "Branch Capacity" input field to the `EditBranchDrawer` so admins can set it per branch

### 4. Device SDK / Force Entry Override

Two sub-issues:

**a) Force Entry for expired/due members:**
- Add a `force_entry` boolean + `force_entry_reason` text field to `member_attendance`
- Update `device-access-event` edge function to support a `force_entry` flag that bypasses membership validation but logs the override
- Add a "Force Entry" button in the Attendance Dashboard for reception staff
- Create a "Force Entry Log" view so managers can audit overrides

**b) Biometric sync audit:**
This is a hardware integration issue. The sync queue (`biometric_sync_queue`) and `device-sync-data` edge function exist but may have broken FK references or missing device configurations. A full audit of the sync pipeline is needed — this is a separate focused task.

### 5. Frozen Member Shows "No Plan"

**Root Cause Found**: In `Members.tsx` line 209-211, `getActiveMembership()` only returns memberships with `status === 'active'`. Frozen memberships are skipped, so the Membership column shows "No Plan".

**Fix**: Update `getActiveMembership` to also consider `frozen` status:
```typescript
const getActiveMembership = (memberships: any[]) => {
  if (!memberships || memberships.length === 0) return null;
  return memberships.find((m: any) => m.status === 'active') 
    || memberships.find((m: any) => m.status === 'frozen');
};
```
And update the Membership column to show the plan name with a "Frozen" badge when the membership is frozen.

---

## Part B: Feature Recommendations (Points 6-8)

### 6. AI-Powered Dashboard

Using Lovable AI (pre-configured, no API key needed), we can add:
- **AI Insights Widget** on the Dashboard: Summarizes daily KPIs, highlights anomalies (e.g., "Revenue down 15% vs last week"), and suggests actions
- **Natural Language Query**: A chat box where owners can ask "How many members joined this month?" and get answers from their data
- Implementation: Edge function calls Lovable AI Gateway with structured gym data as context

### 7. Instagram/Facebook Lead Capture

Three approaches available:

| Method | Effort | Description |
|--------|--------|-------------|
| **Webhook endpoint** (recommended) | Low | We already have `webhook-lead-capture` edge function. Create a public API endpoint that Instagram/Facebook Lead Ads can POST to via Zapier or Meta's native webhook |
| **Meta Lead Ads API** | Medium | Direct integration with Facebook/Instagram Lead Ads API using Meta Business credentials |
| **Zapier/Make integration** | Low | User connects their Meta account via Zapier, which POSTs to our existing webhook |

The existing `capture-lead` and `webhook-lead-capture` edge functions already support external lead ingestion. We just need to document the webhook URL and add source tracking for "instagram" and "facebook".

### 8. AI Auto-Reply to Leads / WhatsApp

This requires:
- **WhatsApp Business API** integration (via a provider like Twilio, WATI, or the official Meta API)
- An edge function that receives incoming WhatsApp messages, passes them to Lovable AI with lead context, and sends AI-generated replies
- Auto-reply rules: configurable templates for first contact, follow-up reminders, and appointment booking

This is a significant feature that needs a WhatsApp Business API provider connection. We can build the AI reply logic using Lovable AI Gateway, but the WhatsApp sending/receiving channel needs a third-party integration.

---

## Implementation Priority

| Priority | Task | Files |
|----------|------|-------|
| P0 | Fix `leads.name` errors in FollowUpCenter JSX | `FollowUpCenter.tsx` |
| P0 | Fix frozen member showing "No Plan" | `Members.tsx` |
| P1 | Fix sidebar overflow / page width | `AppLayout.tsx` |
| P1 | Add branch capacity setting | Migration + `EditBranchDrawer` + `Dashboard.tsx` + `OccupancyGauge.tsx` |
| P1 | Add Force Entry override for attendance | Migration + `device-access-event` + `AttendanceDashboard.tsx` |
| P2 | AI Dashboard insights widget | New edge function + Dashboard widget |
| P2 | Social media lead capture docs/config | Settings page + webhook docs |
| P3 | AI WhatsApp auto-reply | Requires WhatsApp Business API provider |

Shall I proceed with implementing P0 and P1 items first?

