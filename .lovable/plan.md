

# Deep System Health Audit & Lead Conversion Fix

## Error Summary from Database

| # | Error | Route | Root Cause | Fix |
|---|-------|-------|------------|-----|
| 1 | `column trainers_1.specialization does not exist` | /hrm | HRM contracts query selects `trainers(user_id, specialization)` — column is `specializations` (plural, array) | Fix select string in `HRM.tsx` line 63 |
| 2 | `column "invoice_type" of relation "invoices" does not exist` | /members | `purchase_pt_package` DB function inserts `invoice_type` column that doesn't exist on `invoices` table | Add `invoice_type` column to `invoices` via migration |
| 3 | `invalid input value for enum member_status: "frozen"` | /members | Something tries to set `members.status` to `frozen`, but the `member_status` enum only has `active/inactive/suspended/blacklisted`. The `frozen` value exists on `membership_status`, not `member_status` | This is a one-off error likely from manual testing. No code writes `frozen` to `members.status`. Mark as resolved. |
| 4 | `DialogContent requires DialogTitle` | /dashboard, /members, /invoices | Radix accessibility warning from AlertDialogs or Dialogs missing titles | Add hidden `DialogTitle` to offending dialogs |
| 5 | `null value in column "id" of relation "profiles"` | /leads | `leadService.convertToMember()` tries to INSERT into `profiles` without an `id` — profiles.id must match auth.users.id, has no default | **Root cause of lead conversion failure.** Fix by using the `create-member-user` edge function instead of raw insert |
| 6 | `Invalid ID format` | /leads | Downstream from error #5 |  |
| 7 | `Could not find relationship between pt_sessions and member_id` | /trainers | `TrainerProfileDrawer` selects `member:member_id(...)` but `pt_sessions` has no FK from `member_id` to any table (it only has `member_pt_package_id`) | Fix query to join through `member_pt_packages` |
| 8 | `Could not find relationship between branch_managers and user_id` | /settings | `EditBranchDrawer` selects `profiles:user_id(full_name)` but `branch_managers.user_id` has no FK to `profiles` | Use explicit FK hint or add FK constraint via migration |
| 9 | `Could not find relationship between benefit_usage and recorded_by` | /benefit-tracking | `benefitService.fetchBenefitUsageHistory` selects `profiles:recorded_by(full_name)` but no FK exists | Use separate query or add FK constraint |
| 10 | `column leads.name does not exist` | /staff-dashboard | `StaffDashboard.tsx` line 90 selects `name` — column is `full_name` | Fix select and display reference |
| 11 | `404 — Route not found: /member/pay` | — | Non-existent route hit | No action needed |
| 12 | `Cannot coerce result to single JSON object` | /unauthorized | Profile fetch for user with no profile row | Already uses `maybeSingle` elsewhere; low priority |

## Lead Conversion Fix (Issue #2)

**Problem:** `convertToMember` manually inserts a `profiles` row without an `id` (which requires an auth user). This always fails.

**Fix:** Rewrite `convertToMember` to call the `create-member-user` edge function (which properly creates an auth user, profile, role, and member record). Add a **branch selector** to `ConvertMemberDrawer` so the user can pick which branch to convert the lead into.

## Files to Change

| File | Change |
|------|--------|
| `src/pages/HRM.tsx` | Fix `specialization` → `specializations` in contracts query (line 63) |
| `src/components/trainers/TrainerProfileDrawer.tsx` | Fix pt_sessions query to join via `member_pt_packages` instead of `member_id` |
| `src/components/branches/EditBranchDrawer.tsx` | Replace `profiles:user_id(...)` join with separate profile lookup for branch managers |
| `src/services/benefitService.ts` | Replace `profiles:recorded_by(...)` join with separate profile lookup |
| `src/pages/StaffDashboard.tsx` | Fix `leads.name` → `leads.full_name` in select and display |
| `src/components/members/MemberProfileDrawer.tsx` | Remove `invoice_type` from invoices select |
| `src/services/leadService.ts` | Rewrite `convertToMember` to use `create-member-user` edge function |
| `src/components/leads/ConvertMemberDrawer.tsx` | Add branch selector dropdown, pass selected branch to conversion |
| **DB Migration** | Add `invoice_type TEXT DEFAULT NULL` column to `invoices` table; add FK from `branch_managers.user_id` to `profiles.id`; add FK from `benefit_usage.recorded_by` to `profiles.id`; update `purchase_pt_package` function |

