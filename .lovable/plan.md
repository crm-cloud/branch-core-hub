

# Enterprise Polish: Bugs, Avatar Audit, PDF Export, Document Vault & Comp Engine

## Overview

Seven modules: fix lead conversion & referral reward bugs, global avatar audit, PDF plan downloads, registration document vault, system health audit, and a hospitality comp engine.

---

## 1. Lead Conversion Bug Fix (Revenue Blocking)

**Root cause**: The `create-member-user` edge function works correctly. The issue is likely that the `ConvertMemberDrawer` only shows in the Leads page, not on StaffDashboard. On StaffDashboard, staff see leads but have no "Convert" action — they only see status badges and a "View All" link.

**Fix in `src/pages/StaffDashboard.tsx`**:
- Import `ConvertMemberDrawer` from leads
- Add a "Convert" button next to each lead in the Follow-Up Leads card
- Wire up state for `convertLead` and pass it to the drawer
- Also add better error surfacing: the `convertToMember` function should toast the exact error from the edge function

**Fix in `src/services/leadService.ts`**:
- Improve error handling in `convertToMember` — if `data?.error` exists, include it in the thrown error message for better debugging

## 2. Cross-Branch Referral Reward Fix (Revenue Blocking)

**Root cause**: The `referrals` table has NO `branch_id` column, but the `notify_referral_converted` trigger references `NEW.branch_id`. This means the trigger silently fails or falls through when trying to look up `referral_settings` — it can't find settings because `NEW.branch_id` is NULL.

**Database migration**:
- Add `branch_id` column to `referrals` table (nullable UUID, FK to branches)
- Update `notify_referral_converted` trigger to resolve branch_id from the referrer's member record if `NEW.branch_id` is NULL:
  ```sql
  -- Get branch from referrer member if not on referral
  SELECT m.branch_id INTO v_branch_id 
  FROM members m WHERE m.id = NEW.referrer_member_id;
  ```
- This ensures rewards generate correctly regardless of which branch the referred member joins

**Fix in `src/pages/Referrals.tsx`**:
- When creating a referral, include the referrer's `branch_id` in the insert

## 3. Hospitality & Comp Engine

**Existing**: `addFreeDays` in `membershipService.ts` already extends membership end dates. But it blocks if a discount was applied, and there's no UI for comp benefit sessions.

**Database migration**:
- Create `member_comps` table: `id`, `member_id`, `membership_id`, `benefit_type_id` (FK), `comp_sessions` (integer), `used_sessions` (integer default 0), `reason` (text), `granted_by` (uuid FK profiles), `created_at`
- RLS: staff/admin/owner can CRUD

**UI in `src/components/members/MemberProfileDrawer.tsx`**:
- Add "Comp/Gift" action button in the profile drawer actions
- Opens a small dialog/sheet to:
  - Extend membership days (uses existing `addFreeDays` but remove the discount block)
  - Grant comp benefit sessions (inserts into `member_comps`)
- Show active comps in the Benefits tab

**Booking logic update in `src/services/benefitBookingService.ts`**:
- Before checking plan benefit limits, check `member_comps` for available comp sessions
- If comp exists with `used_sessions < comp_sessions`, deduct from comp instead of plan benefit

## 4. PDF Plan Export

**Fix in `src/pages/AIFitness.tsx`**:
- Add a "Download PDF" button next to the Copy/Save/Assign buttons (line 633)
- Use the existing `generatePlanPDF` utility from `src/utils/pdfGenerator.ts` which already handles workout and diet plans
- Wire: `generatePlanPDF({ name: generatedPlan.name, type: planType, data: generatedPlan })`

**Fix in template cards** (Templates Library tab):
- Add a "Download" icon button on each template card that calls `generatePlanPDF` with the template content

## 5. Registration Form & Document Vault

**New component: `src/components/members/MemberRegistrationForm.tsx`**:
- Printable membership agreement that auto-populates with member name, plan, start/end dates, branch, emergency contact
- Uses `window.print()` with print-specific CSS (hides nav, shows gym logo)
- Triggered from Member Profile Drawer via "Print Agreement" button

**New component: `src/components/members/DocumentVaultTab.tsx`**:
- New tab in MemberProfileDrawer: "Documents"
- Lists uploaded documents from a new `member_documents` table
- File uploader connected to Supabase Storage (`documents` bucket)
- Staff can upload signed contracts (PDF/JPEG) back to the member's record

**Database migration**:
- Create `member_documents` table: `id`, `member_id` (FK), `document_type` (text: 'registration_form', 'contract', 'id_proof', 'other'), `file_url` (text), `file_name` (text), `uploaded_by` (uuid), `created_at`
- RLS: staff/admin/owner can CRUD, member can read own

## 6. Global Avatar Audit

Pages already fetching `avatar_url` correctly: Members, Attendance, Classes (after last fix), Employees, MemberProfile.

**Pages/components still missing avatars**:

| Location | Issue | Fix |
|----------|-------|-----|
| `StaffDashboard.tsx` — Recent Check-ins | Query fetches `profiles:user_id(full_name)` but doesn't show Avatar component | Add `avatar_url` to select, add Avatar component |
| `StaffDashboard.tsx` — Expiring Memberships | Same — no avatar | Add avatar_url + Avatar |
| `StaffDashboard.tsx` — At-Risk Members | `get_inactive_members` RPC doesn't return `avatar_url` | Update RPC to include `p.avatar_url`, add Avatar in UI |
| `StaffDashboard.tsx` — Follow-Up Leads | Plain text name | Leads don't have profiles, skip avatar (acceptable) |
| `Referrals.tsx` — Table rows | Shows icon only, no avatar | Add avatar from referrer profile join |
| `FollowUpCenter.tsx` | Inactive member list | Add avatar from member profile |

**Database function update**:
- Update `get_inactive_members` to also return `avatar_url` from the profiles table

## 7. System Health Audit

**Fix in `src/components/common/ErrorBoundary.tsx`**:
- Ensure all caught errors include full `error.message` + `error.details` in the toast and error log

**Audit pass on key mutation hooks**:
- Ensure `onError` handlers in lead conversion, referral creation, membership operations show `error.message` not just generic text
- Add `.details` logging where available from Supabase errors

---

## Files Summary

| File | Action |
|------|--------|
| DB Migration | Add `branch_id` to `referrals`; create `member_comps` + `member_documents` tables; update `get_inactive_members` RPC; fix `notify_referral_converted` trigger |
| `src/pages/StaffDashboard.tsx` | Add avatars to all member lists; add lead Convert button |
| `src/pages/Referrals.tsx` | Include `branch_id` on referral insert; add referrer avatar |
| `src/pages/AIFitness.tsx` | Add Download PDF button for generated plans + templates |
| `src/services/leadService.ts` | Improve error message in `convertToMember` |
| `src/components/members/MemberProfileDrawer.tsx` | Add Comp/Gift action, Documents tab, Print Agreement |
| `src/components/members/MemberRegistrationForm.tsx` | **New** — Printable membership agreement |
| `src/components/members/DocumentVaultTab.tsx` | **New** — Document upload/list tab |
| `src/components/members/CompGiftDrawer.tsx` | **New** — Grant free days or comp benefit sessions |
| `src/services/benefitBookingService.ts` | Check comp wallet before plan limits |
| `src/pages/FollowUpCenter.tsx` | Add avatars |

## Execution Order

1. Database migration (referrals branch_id, member_comps, member_documents, update RPC)
2. Fix referral trigger + lead conversion error handling
3. Comp Engine (drawer + booking logic)
4. PDF export on AI Fitness page
5. Registration Form + Document Vault
6. Global avatar audit across all pages
7. System health error surfacing improvements

