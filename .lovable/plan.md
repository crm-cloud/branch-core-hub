

# Audit Report: Branch Manager, Broadcast, and Automated Reminders

---

## Audit 1: Edit Branch -- Manager Selection

### Current State
The `EditBranchDrawer` queries `user_roles` for users with roles `manager`, `admin`, or `owner` and displays them in a Select dropdown. This part **works correctly**.

### Bug Found: Current Manager Not Pre-Selected
When editing a branch, `managerId` is always initialized to `''` (empty string). The drawer **never fetches the current manager** from `branch_managers` table, so the user cannot see who the current manager is. It always shows "No change".

### Fix
- Add a query to fetch the current primary manager from `branch_managers` for this branch.
- Pre-populate `formData.managerId` with that user's ID so the Select shows the current manager on load.
- Also show a label like "Current: John Doe" next to the field.

---

## Audit 2: Broadcast Drawer / Communication Hub

### Current State
The `BroadcastDrawer` has channel selection (WhatsApp/SMS/Email), template loading from the `templates` table, audience filtering, and a message textarea. Templates load correctly per channel type.

### Bugs / Gaps Found

**Gap 1: Broadcast does NOT actually send messages.**
The `handleBroadcast` function only shows a toast saying "Broadcast initiated" -- it never calls any API, edge function, or communication service. No messages are sent. No `communication_logs` entry is created.

**Gap 2: No recipient resolution.**
Even if sending worked, the drawer never fetches the list of members matching the audience (all/active/expiring/expired). It doesn't know who to send to.

**Gap 3: WhatsApp/SMS are client-side only.**
`communicationService.sendWhatsApp()` opens `wa.me` links (one at a time, not bulk). `sendSMS()` opens the device SMS app. Neither supports bulk broadcast.

**Gap 4: Email is a no-op.**
`communicationService.sendEmail()` just logs to console and writes a communication_log. No actual email sending (no Resend/SMTP integration).

### Fix Plan
1. Create a `send-broadcast` edge function that:
   - Accepts channel, message, audience filter, and branch_id
   - Queries members matching the audience
   - For WhatsApp: uses WhatsApp Business API (requires user to set up API key)
   - For Email: uses Resend (requires RESEND_API_KEY)
   - For SMS: uses configured SMS provider (requires API key)
   - Logs each message to `communication_logs`
2. Update `handleBroadcast` to call this edge function
3. Show a progress/confirmation with count of recipients before sending

**Important:** SMS, Email, and WhatsApp bulk sending all require external API keys. The system needs to prompt the user to configure these in Settings > Integrations before broadcast will work.

---

## Audit 3: Automated Reminders (Payment, Birthday, Renewals, Classes, Benefits)

### Current State: NOTHING IS AUTOMATED

There are **zero** edge functions for automated reminders. Here is the gap analysis:

| Reminder Type | Database Support | Edge Function | Trigger/Cron | Status |
|--------------|-----------------|---------------|-------------|--------|
| Payment due soon (3 days before) | `payment_reminders` table exists | NONE | NONE | NOT WORKING |
| Payment on due date | `payment_reminders` table exists | NONE | NONE | NOT WORKING |
| Payment overdue (3 days after) | `payment_reminders` table exists | NONE | NONE | NOT WORKING |
| Birthday wishes | `profiles.date_of_birth` column exists | NONE | NONE | NOT WORKING |
| Membership renewal/expiry | `memberships.end_date` exists | NONE | NONE | NOT WORKING |
| Class booking reminder | `classes.scheduled_at` exists | NONE | NONE | NOT WORKING |
| Benefit slot reminder | `benefit_bookings.booking_date` exists | NONE | NONE | NOT WORKING |
| PT session reminder | `pt_sessions.scheduled_at` exists | NONE | NONE | NOT WORKING |

### What Needs to Be Built

**A. `send-reminders` Edge Function** -- A single scheduled function that:
1. Queries `payment_reminders` where `status = 'pending'` and `scheduled_for <= now()`
2. Queries `memberships` expiring in 7/3/1 days
3. Queries `profiles` with birthday = today
4. Queries `classes` and `pt_sessions` scheduled tomorrow
5. Queries `benefit_bookings` for tomorrow
6. For each match, sends notification via configured channel and logs to `communication_logs`

**B. Cron Schedule** -- This function needs to run on a schedule (e.g., daily at 8 AM). Lovable Cloud does not support cron jobs natively. Options:
- Use an external cron service (e.g., cron-job.org) to call the edge function daily
- Or build a "Run Reminders" button in the admin panel for manual triggering

**C. Notification Creation** -- Each reminder should also insert into the `notifications` table so the in-app bell shows them.

**D. Channel Configuration Prerequisite** -- Before any of this works, the user must configure:
- Resend API key for email (in secrets)
- WhatsApp Business API credentials
- SMS provider API key

---

## Implementation Plan

### Step 1: Fix Branch Manager Pre-Selection
- File: `src/components/branches/EditBranchDrawer.tsx`
- Add query: fetch current manager from `branch_managers` where `branch_id` matches and `is_primary = true`
- Set `formData.managerId` in the `useEffect` when branch data loads

### Step 2: Fix Broadcast to Actually Send
- Create: `supabase/functions/send-broadcast/index.ts`
  - Accepts: `{ channel, message, audience, branch_id }`
  - Resolves audience to member list with phone/email
  - Placeholder send logic (logs to `communication_logs` with status)
  - Real sending when API keys are configured
- Update: `src/components/announcements/BroadcastDrawer.tsx`
  - Call the edge function instead of just showing a toast
  - Show recipient count before sending
  - Show sending progress

### Step 3: Create Automated Reminders Engine
- Create: `supabase/functions/send-reminders/index.ts`
  - Processes all reminder types (payment, birthday, renewal, class, PT, benefit)
  - Uses templates from `templates` table when available
  - Inserts into `notifications` table for in-app alerts
  - Logs to `communication_logs`
- Update: Add a "Run Reminders" button in Settings or Dashboard for manual trigger
- Future: External cron integration for daily automated execution

### Step 4: Communication Service Integration
- Update: `src/services/communicationService.ts`
  - Add `sendBulkEmail()` method calling edge function
  - Add `sendBulkSMS()` method calling edge function
  - Remove client-side-only `sendSMS()` and `sendWhatsApp()` workarounds

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/components/branches/EditBranchDrawer.tsx` | Fix: pre-select current manager |
| `src/components/announcements/BroadcastDrawer.tsx` | Fix: actually send broadcast via edge function |
| `supabase/functions/send-broadcast/index.ts` | NEW: bulk message sending |
| `supabase/functions/send-reminders/index.ts` | NEW: automated reminder processing |
| `src/services/communicationService.ts` | Update: add bulk send methods |

## Prerequisites (User Action Required)
- For email sending: User must provide a **Resend API key**
- For SMS: User must configure an SMS provider API key
- For WhatsApp bulk: User must have WhatsApp Business API access
- Without these keys, broadcast and reminders will only create in-app notifications (bell icon) and log entries, but won't deliver external messages

