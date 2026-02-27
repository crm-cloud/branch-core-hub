

# Comprehensive Fixes: Lead Creation, Locker Assignment, Referrals, UI Redesigns & Notifications

## Root Cause Analysis

### 1. Lead Creation Fails
`AddLeadDrawer` receives `defaultBranchId={leads[0]?.branch_id}` from `Leads.tsx` (line 278). If no leads exist yet, this is `undefined`, making `branch_id` an empty string. The DB requires `branch_id` NOT NULL.
**Fix:** Pass `effectiveBranchId` from `BranchContext` instead of `leads[0]?.branch_id`.

### 2. Referral "Referred by" Shows Code Instead of Name + Rewards Not Generating
- **Display bug:** MemberProfileDrawer line 401 queries `referrer:referred_by(member_code)` — only fetches `member_code`, not the referrer's name via their profile.
- **Reward not generating:** No database trigger exists to auto-create `referral_rewards` when a referral status changes to `converted`. The system relies on triggers that don't exist.
- **Settings save fails:** Screenshot shows "no unique or exclusion constraint matching the ON CONFLICT specification". `referral_settings` has no unique index on `branch_id` — only on `id`. The `upsert(..., { onConflict: 'branch_id' })` call fails.
**Fix:** Add unique constraint on `referral_settings.branch_id`. Update referrer query to join through `user_id` to `profiles` for `full_name`. Create a DB function/trigger or application-level logic to generate rewards on conversion.

### 3. Locker Assignment Fails
`lockerService.assignLocker()` sets status to `'occupied'` (line 97), but the `locker_status` enum values are: `available`, `assigned`, `maintenance`, `reserved`. There is no `'occupied'` value — it should be `'assigned'`.
**Fix:** Change `'occupied'` to `'assigned'` in `lockerService.ts`. Also fix `Lockers.tsx` line 85 which checks for `status === 'assigned'` (correct) but the status color function checks for `'occupied'` (line 66, wrong).

### 4. Redesign Membership Plans Page
Current page is functional but basic. Will enhance with premium Vuexy-style cards, better visual hierarchy, and richer plan cards.

### 5. Trainers Page — `max_clients` Covers Both Types
The `max_clients` field on the trainer form should be specifically for PT clients (capacity-limited). General clients are unlimited assignments. Will clarify the label and description.

### 6. Manual Refresh Required After Data Entry
Missing query invalidation in several mutation flows. Need to audit all mutation `onSuccess` handlers and ensure proper `queryClient.invalidateQueries` calls. Also ensure realtime subscriptions are in place for key tables.

### 7. Redesign Unauthorized Page
Current page is minimal. Will create a modern 2026-style page with animation and better UX.

### 8. Notifications Not Showing All Gym Events
No database triggers exist to auto-generate notifications for key events (new member, payment received, membership expiring, locker assigned, lead converted, etc.). The `notifications` table exists but nothing populates it automatically.
**Fix:** Create a comprehensive notification trigger function that fires on key table inserts/updates.

---

## Database Migration Required

```sql
-- 1. Add unique constraint on referral_settings.branch_id for upsert
CREATE UNIQUE INDEX IF NOT EXISTS referral_settings_branch_id_unique ON public.referral_settings(branch_id);

-- 2. Create notification trigger function for gym events
CREATE OR REPLACE FUNCTION notify_gym_event() ... (triggers on payments, memberships, leads, members)
```

---

## Files to Change

| File | Change |
|------|--------|
| **DB Migration** | Add unique index on `referral_settings.branch_id`; create notification triggers for key gym events |
| `src/services/lockerService.ts` | Change `'occupied'` to `'assigned'` in `assignLocker()` (line 97) |
| `src/pages/Lockers.tsx` | Fix status color for `'assigned'`; redesign with Vuexy cards, table view for occupied lockers, better stats |
| `src/pages/Leads.tsx` | Pass `effectiveBranchId` from BranchContext to `AddLeadDrawer` instead of `leads[0]?.branch_id` |
| `src/components/members/MemberProfileDrawer.tsx` | Update referrer query to fetch profile name via `user_id`; show referrer name instead of code |
| `src/components/settings/ReferralSettings.tsx` | Already correct once DB unique constraint is added |
| `src/pages/Plans.tsx` | Redesign with modern 2026 Vuexy-inspired layout: gradient hero cards, comparison table, better benefit display |
| `src/pages/Trainers.tsx` | Redesign with advanced stats, clarify `max_clients` as PT capacity, modern card layout |
| `src/components/trainers/AddTrainerDrawer.tsx` | Rename `max_clients` label to "Max PT Clients" with description |
| `src/pages/Unauthorized.tsx` | Complete redesign with animated illustration, role info, modern glassmorphism style |
| `src/services/notificationService.ts` | Add helper to create notifications for various gym events |
| `src/hooks/useLockers.ts` | Add broader query invalidation after mutations |
| Multiple mutation files | Audit and add missing `queryClient.invalidateQueries` calls in all mutation `onSuccess` handlers |

## Execution Order

1. Database migration (unique constraint + notification triggers)
2. Fix critical bugs (locker status enum, lead branch_id, referrer name)
3. Fix referral settings save
4. Add missing query invalidations across mutations
5. Redesign Unauthorized page
6. Redesign Plans page
7. Redesign Lockers page with improved workflow
8. Redesign Trainers page with clarified max_clients

