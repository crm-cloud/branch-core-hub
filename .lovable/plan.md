

# Multi-Issue Fix: Staff Search, Avatars, Class Bookings, Webhook URLs & CSV Exports

## 1. Attendance Command Center — Staff Search for Offline Marking

**Problem**: The top search bar (lines 101-110) only calls `searchMember()` which uses the `search_members` RPC — it only searches the `members` table. Staff cannot be found via this search bar.

**Fix**: The staff check-in functionality already exists in the "Staff Check-in" tab (line 627+) with a working filter on `searchTerm`. The issue is the **top rapid-entry search bar** is member-only by design. We need to:
- Add a search/filter input inside the "Staff Check-in" tab header that filters `allStaffProfiles` by name — this already works via `searchTerm` (line 650-652)
- The real gap: `searchTerm` (line 565) is the filter input at the bottom. The **top search bar** (`searchQuery`, line 41) only searches members. We should make the top bar context-aware: when the "staff-record" tab is active, search should filter staff instead.

**Changes in `src/pages/AttendanceDashboard.tsx`**:
- Track active tab state
- When active tab is "staff-record", route the top search bar input to filter `allStaffProfiles` instead of calling `searchMember`
- Show matching staff with check-in/out buttons in the search results area

## 2. Avatar Audit — Show Avatar Image Before Initials

**Problem**: Multiple components show initials even when `avatar_url` exists. The `<AvatarImage>` component should handle this automatically (it falls back to `<AvatarFallback>` when src is null/empty/fails to load). The likely issue is that `avatar_url` is not being fetched or passed correctly in certain queries.

**Audit findings**:
- `MemberProfileDrawer.tsx` (line 708-713): Uses `profile?.avatar_url` — correct pattern
- `Members.tsx` (line 398-403): Uses `member.profiles?.avatar_url` — correct pattern  
- `AttendanceDashboard.tsx` staff attendance query (line 166): Only fetches `full_name, email` from profiles — **missing `avatar_url`**
- `AttendanceDashboard.tsx` staff history query (line 211): Same issue — missing `avatar_url`
- `Classes.tsx` bookings table (line 500-502): Only shows `booking.member_name` text, **no Avatar component at all**
- `classService.ts` `fetchClassBookings` (line 213-216): Fetches `full_name, phone` from profiles — **missing `avatar_url`**

**Changes**:
- `src/pages/AttendanceDashboard.tsx`: Add `avatar_url` to staff attendance and history queries' profile select
- `src/services/classService.ts`: Add `avatar_url` to profile fetch in `fetchClassBookings`, return it as `member_avatar`
- `src/pages/Classes.tsx`: Add Avatar component to bookings attendance table rows
- `src/components/members/MemberProfileDrawer.tsx`: Already correct — no change needed

## 3. Class Bookings — Show Member Avatar

**Problem**: In the Attendance tab of Classes page (line 500-502), bookings only show `booking.member_name` as plain text with no avatar.

**Changes**:
- `src/services/classService.ts`: Add `avatar_url` to the profiles select in `fetchClassBookings`, add `member_avatar` to return type
- `src/pages/Classes.tsx`: Wrap the member name cell with an Avatar component showing the member's photo

## 4. Webhook URL in Payment & Google Review Integrations

**Problem**: The payment gateway config form (line 557-561) has a `webhook_url` field but it's a manual input. The user needs to know the actual webhook URL to paste. Similarly, Google Business has no setup guide.

**Changes in `src/components/settings/IntegrationSettings.tsx`**:
- For payment gateways: Add a read-only info box showing the auto-generated webhook URL format: `https://{project_id}.supabase.co/functions/v1/payment-webhook`
- Add a "Copy" button next to it
- For Google Business tab: Add a setup guide similar to the WhatsApp one, explaining OAuth flow, API setup, and the review sync webhook URL
- Add webhook URL display in the config sheet when type is `payment_gateway`

## 5. CSV/Excel Download Audit

**Pages WITH export**: Finance, Payments, AuditLogs, TrainerEarnings (payslip PDF), HRM (payslip PDF), Invoices (per-invoice)

**Pages MISSING export** (that have tabular data):
| Page | Data | Priority |
|------|------|----------|
| `Members.tsx` | Member list | High |
| `Leads.tsx` | Lead list | High |
| `AttendanceDashboard.tsx` | Member + Staff attendance | High |
| `Referrals.tsx` | Referral list | Medium |
| `Equipment.tsx` | Equipment inventory | Medium |
| `Lockers.tsx` | Locker assignments | Medium |
| `Feedback.tsx` | Feedback entries | Medium |
| `PTSessions.tsx` | PT session log | Medium |
| `StaffAttendance.tsx` | Staff attendance | Medium |
| `Products.tsx` | Product inventory | Low |
| `Classes.tsx` | Class schedule + bookings | Low |

**Changes**: Add `exportToCSV` functions and Download buttons to: `Members.tsx`, `Leads.tsx`, `AttendanceDashboard.tsx`, `Referrals.tsx`, `Equipment.tsx`, `Lockers.tsx`, `Feedback.tsx`, `PTSessions.tsx`, `StaffAttendance.tsx`

Each export will follow the existing pattern (Finance/Payments): build CSV string → create Blob → trigger download.

---

## Files Summary

| File | Changes |
|------|---------|
| `src/pages/AttendanceDashboard.tsx` | Staff search in top bar; add `avatar_url` to staff queries; add CSV export |
| `src/services/classService.ts` | Add `avatar_url` to `fetchClassBookings` profile query |
| `src/pages/Classes.tsx` | Add Avatar to bookings attendance table |
| `src/components/settings/IntegrationSettings.tsx` | Add webhook URL display + copy for payments; Google review setup guide |
| `src/pages/Members.tsx` | Add CSV export button |
| `src/pages/Leads.tsx` | Add CSV export button |
| `src/pages/Referrals.tsx` | Add CSV export button |
| `src/pages/Equipment.tsx` | Add CSV export button |
| `src/pages/Lockers.tsx` | Add CSV export button |
| `src/pages/Feedback.tsx` | Add CSV export button |
| `src/pages/PTSessions.tsx` | Add CSV export button |
| `src/pages/StaffAttendance.tsx` | Add CSV export button |

## Execution Order

1. Fix staff search in Attendance Command Center
2. Avatar audit fixes (queries + UI)
3. Class bookings avatar
4. Webhook URL displays in integration settings
5. CSV export buttons across all missing pages

