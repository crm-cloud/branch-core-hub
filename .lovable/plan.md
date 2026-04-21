

## Phase D — Notifications & Chat Audit

### D1. Eliminate duplicate notifications at the source

**Root causes found:**
- `notify_lead_created` DB trigger fans out to **all** owner/admin/manager/staff users with **no `branch_id` filter** on recipients → managers at Branch B receive Branch A leads.
- `notify_new_member`, `notify_payment_received`, `notify_locker_assigned`, `notify_membership_expiring` have the same problem (broadcast to all owners/admins/staff regardless of branch).
- `RegisterModal.tsx` lead path: `webhook-lead-capture` inserts the lead → DB trigger creates in-app notification rows. The current `fetchNotifications` client-side dedupe (1-min bucket on title+message) hides the symptom but doesn't fix the cause. Verified live data shows `dup_count: 2` for the same lead.
- The dup of 2 comes from the trigger inserting one row per matched role (`owner` + `admin` for the same user when a user holds two roles, or the trigger firing twice if a duplicate trigger exists on the table).

**Fix (single migration):**
1. Rewrite all 5 notifier trigger functions (`notify_lead_created`, `notify_new_member`, `notify_payment_received`, `notify_locker_assigned`, `notify_membership_expiring`) to:
   - **Branch-scope recipients**: owners + admins get all branches; managers get only their `branch_managers` rows; staff/trainers get only their `staff_branches` / `employees.branch_id` rows.
   - **DISTINCT user_id** in the SELECT to prevent dup rows when a user holds multiple roles.
2. Drop any duplicate triggers on the same table (audit `pg_trigger`, keep one per event).
3. Add a unique partial index `notifications_dedupe_idx` on `(user_id, title, message, date_trunc('minute', created_at))` `WHERE is_read = false` — guarantees no exact dup row inside a 1-minute window even if a code path double-fires.
4. Remove the client-side dedupe filter in `fetchNotifications` (no longer needed).

### D2. Role-based notification routing

For each notification type, restrict recipients:

| Event | Recipients |
|---|---|
| New lead | Owner/Admin (all) + Manager (lead's branch) + Staff (lead's branch) |
| New member | Owner/Admin (all) + Manager/Staff (member's branch) |
| Payment received | Owner/Admin (all) + Manager (branch) |
| Membership expiring (member) | The member only |
| Membership expiring (staff) | Owner/Admin + Manager (branch) |
| Locker assigned | Owner/Admin + Manager/Staff (branch) |
| Referral converted | The referrer only (already correct) |
| Booking confirmation/cancel | The member only (already correct) |

Trainers receive **only** notifications about their own clients/sessions. Members receive **only** their own notifications.

### D3. Realtime chat sound — global subscription

Currently `useChatSound(inboundCount)` only fires when the user has the WhatsApp chat page open with a contact selected.

**Fix:**
- Create new hook `useGlobalChatSound()` mounted in `AppHeader` (always rendered when authenticated).
- It subscribes to `postgres_changes` on `public.whatsapp_messages` filtered by `direction=eq.inbound` (and branch when applicable) and plays `playPing()` whenever a new inbound message arrives, respecting the existing `isChatSoundEnabled()` preference.
- Verify `whatsapp_messages` is in `supabase_realtime` publication; if not, add it via migration.

### D4. Remove duplicate Data Export from SecuritySettings

`SecuritySettings.tsx` lines 188–216 contain a "Data Export" card that duplicates the new `/settings → Backup & Restore` tab built in C4.

**Fix:** Delete the Data Export card from `SecuritySettings.tsx` (and the `handleExportData`, `isExporting` state, `Download`/`Loader2` imports if no longer used). Keep only Password Policy + Session Management.

---

## Files touched

| File | Change |
|---|---|
| `supabase/migrations/<new>.sql` | Rewrite 5 notifier functions with branch scoping + DISTINCT, drop dup triggers, add dedupe partial index, ensure `whatsapp_messages` in realtime publication |
| `src/services/notificationService.ts` | Remove client-side 1-minute dedupe loop in `fetchNotifications` |
| `src/hooks/useChatSound.ts` | Add new export `useGlobalChatSound()` |
| `src/components/layout/AppHeader.tsx` | Mount `useGlobalChatSound()` |
| `src/components/settings/SecuritySettings.tsx` | Remove Data Export card + unused imports |

## Verification after deploy

1. Trigger a new lead via the Register Modal → check `notifications` table has exactly N rows where N = unique recipient count, no duplicates.
2. Send an inbound WhatsApp message while sitting on `/dashboard` → ping sound plays.
3. As a manager of Branch A, confirm no new-lead notification appears for a Branch B lead.
4. `/settings → Security` shows only Password Policy + Session Management. `/settings → Backup & Restore` is the only place to export.

</plan>I'll just present the plan directly using the proper tag format.

<lov-plan>

## Phase D — Notifications & Chat Audit

### D1. Eliminate duplicate notifications at the source

**Root causes found (verified live):**
- `notify_lead_created`, `notify_new_member`, `notify_payment_received`, `notify_locker_assigned`, `notify_membership_expiring` triggers fan out to **all** owner/admin/manager/staff users with **no `branch_id` recipient filter** and **no `DISTINCT user_id`**, so a user holding two roles (e.g. owner + admin) gets the same notification inserted twice.
- Live data confirms `dup_count: 2` for "kuldeep salvi" with the same `branch_id` and timestamp bucket.
- The current client-side 1-minute dedupe in `fetchNotifications` only hides the symptom — the unread **count** still reflects the duplicate row.

**Fix (single migration):**
1. Rewrite all 5 trigger functions to:
   - Branch-scope recipients (owners/admins → all; managers → their `branch_managers`; staff/trainers → their `staff_branches`/`employees.branch_id`).
   - `SELECT DISTINCT user_id` so multi-role users get one row.
2. Audit `pg_trigger` and drop any duplicate triggers on the same table.
3. Add a **unique partial index** `notifications_dedupe_idx` on `(user_id, title, message, date_trunc('minute', created_at)) WHERE is_read = false` — guarantees no exact dup row inside a 1-minute window even if a code path double-fires.
4. Remove the now-redundant client-side dedupe in `fetchNotifications`.

### D2. Role-based notification routing

| Event | Recipients |
|---|---|
| New lead | Owner/Admin (all) + Manager (lead's branch) + Staff (lead's branch) |
| New member | Owner/Admin (all) + Manager/Staff (member's branch) |
| Payment received | Owner/Admin (all) + Manager (branch) |
| Membership expiring (member-facing) | The member only |
| Membership expiring (staff-facing) | Owner/Admin + Manager (branch) |
| Locker assigned | Owner/Admin + Manager/Staff (branch) |
| Referral converted | The referrer only (already correct) |
| Booking confirmation/cancel | The member only (already correct) |

Trainers receive **only** notifications about their own clients/sessions. Members receive **only** their own notifications.

### D3. Realtime chat sound — global subscription

Currently `useChatSound(inboundCount)` only fires when the WhatsApp chat page is open with a contact selected.

**Fix:**
- Add new export `useGlobalChatSound()` in `src/hooks/useChatSound.ts` that subscribes to `postgres_changes` on `public.whatsapp_messages` (filter `direction=eq.inbound`) and plays the ping whenever a new inbound message arrives, respecting `isChatSoundEnabled()`.
- Mount it in `AppHeader` (always rendered for authenticated users).
- Migration ensures `whatsapp_messages` is in the `supabase_realtime` publication.

### D4. Remove duplicate Data Export from Security tab

`SecuritySettings.tsx` (lines 188–216) duplicates the `/settings → Backup & Restore` tab built in Phase C4.

**Fix:** Delete the Data Export card + `handleExportData` + `isExporting` state + unused `Download`/`Loader2` imports. Keep only Password Policy + Session Management.

---

## Files touched

| File | Change |
|---|---|
| `supabase/migrations/<new>.sql` | Rewrite 5 notifier functions with branch scoping + DISTINCT, drop dup triggers, add dedupe partial index, add `whatsapp_messages` to realtime publication |
| `src/services/notificationService.ts` | Remove client-side 1-minute dedupe |
| `src/hooks/useChatSound.ts` | Add `useGlobalChatSound()` |
| `src/components/layout/AppHeader.tsx` | Mount `useGlobalChatSound()` |
| `src/components/settings/SecuritySettings.tsx` | Remove Data Export card + unused imports |

## Verification after deploy

1. New lead via Register Modal → exactly N unread rows where N = unique recipient count, badge count matches.
2. Inbound WhatsApp message while on `/dashboard` → ping sound plays without opening chat.
3. As Branch A manager, no Branch B lead notification appears.
4. `/settings → Security` shows only Password Policy + Session Management; export lives only under Backup & Restore.

