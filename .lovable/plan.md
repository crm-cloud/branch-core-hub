

# Comprehensive Audit & Fix Plan: Attendance, System Health, WhatsApp, DB Cleanup

## Bugs Found

### Bug 1: "Already In" Has No Check-Out Button (CRITICAL)
**File**: `src/pages/AttendanceDashboard.tsx` lines 521-525
When a member search returns "Already In", the UI shows only a static badge with no action. The `checkOut` mutation exists in the hook but is never called from search results.

**Fix**: Replace the static "Already In" badge with a "Check Out" button that calls `checkOut(member.id)`.

### Bug 2: Stats Show 0 Active Despite Members Checked In
**File**: `src/pages/AttendanceDashboard.tsx` lines 327-332
The stats derive from `memberAttendance` which is filtered by `dateFilter`. The `checkedInMembers` query (used for `isAlreadyCheckedIn`) is separate and works correctly. The stats count `activeMemberCheckIns` from the date-filtered attendance, which is correct — the issue is that the "Currently Active" stat only counts today's attendance records with `check_out === null`. If the hardware check-in created a `member_attendance` record via RPC, this should work. Need to verify the RPC actually inserts the record.

The real issue: MIPS webhook calls `member_check_in` RPC which inserts into `member_attendance` — this IS working. The attendance dashboard query filters by `branchFilter` but members checked in via hardware may have a different `branch_id` mapping. Verify the branch_id alignment.

### Bug 3: 99 Database Errors — `meta_template_name` Column Missing
**Root cause**: The `manage-whatsapp-templates` edge function references `meta_template_name`, `meta_template_status`, and `meta_rejection_reason` columns on the `templates` table. These columns **do not exist** in the schema. The templates table only has: `id, branch_id, name, type, subject, content, variables, is_active, created_at, updated_at`.

**Fix**: Add the missing columns via migration: `meta_template_name`, `meta_template_status`, `meta_rejection_reason`.

### Bug 4: `diet_plans.plan_type` Column Missing (4 errors)
The frontend references `plan_type` on `diet_plans` but this column doesn't exist.

**Fix**: Add `plan_type` column to `diet_plans` via migration.

### Bug 5: WhatsApp Webhook Already Works
The `whatsapp-webhook` edge function already handles GET verification (lines 55-80) correctly. The issue is likely that the webhook URL registered in Meta must point to:
`https://iyqqpbvnszyrrgerniog.supabase.co/functions/v1/whatsapp-webhook`

The function also correctly validates the `webhook_verify_token` from `integration_settings.config`. This is a configuration issue, not a code issue.

## Implementation Plan

### Step 1: DB Migration — Add Missing Template Columns + diet_plans.plan_type
```sql
ALTER TABLE templates ADD COLUMN IF NOT EXISTS meta_template_name text;
ALTER TABLE templates ADD COLUMN IF NOT EXISTS meta_template_status text;
ALTER TABLE templates ADD COLUMN IF NOT EXISTS meta_rejection_reason text;
ALTER TABLE diet_plans ADD COLUMN IF NOT EXISTS plan_type text DEFAULT 'custom';
```
This instantly fixes 103 of 111 database errors.

### Step 2: Fix "Already In" → Add Check-Out Button
**File**: `src/pages/AttendanceDashboard.tsx` lines 521-525
Replace static badge with a Button calling `checkOut(member.id)`.

### Step 3: Clear Resolved Error Logs
Bulk-resolve all 103 "column does not exist" errors since the migration fixes the root cause.

### Step 4: WhatsApp Integration Instructions
Add clear setup instructions to the Integration Settings page showing:
- Exact webhook URL to register in Meta Developer Portal
- The verify token from the config
- How to sync template approval statuses

### Step 5: Resolve Unused Tables
The following tables have 0 rows and appear to be superseded or unused:
- `role_permissions` (0 rows — superseded by `user_roles` + `has_role` function)
- `permissions` (0 rows — superseded by `user_roles`)
- `settings` (0 rows — superseded by `organization_settings`)
- `payment_transactions` (0 rows — superseded by `payments`)
- `payroll_rules` (0 rows — never used)
- `biometric_sync_queue` (0 rows — never used)
- `device_commands` (0 rows — never used)
- `exercises` (0 rows — never used)
- `workout_templates` (0 rows — never used)
- `diet_templates` (0 rows — never used)
- `ai_plan_logs` (0 rows — never used)

Will NOT delete these automatically — instead, document them in the System Health page as "Empty/Unused" for admin review.

### Step 6: Email — Check Configuration
Lovable Cloud handles email via its own system. Will check if email domain is configured and provide guidance.

## Files to Modify

| File | Change |
|---|---|
| **DB Migration** | Add `meta_template_name`, `meta_template_status`, `meta_rejection_reason` to `templates`; `plan_type` to `diet_plans` |
| `src/pages/AttendanceDashboard.tsx` | Replace "Already In" badge with Check-Out button |
| `src/pages/SystemHealth.tsx` | Add "Empty Tables" audit view, bulk-clear old errors button |
| `src/components/settings/IntegrationSettings.tsx` | Add WhatsApp webhook URL display + copy button + setup instructions |

## Implementation Order
1. DB migration (fixes 103 errors immediately)
2. Attendance check-out button fix
3. System Health enhancements
4. WhatsApp instructions & template sync guidance

