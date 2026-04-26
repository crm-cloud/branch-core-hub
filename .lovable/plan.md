
## 🔍 End-to-End Audit: Benefit Slot Booking Workflow

I traced the entire workflow — settings → facility → slot generation → member booking → staff booking → cancellation → reminders → notifications. Below is what is **working**, what is **silently broken**, and what is **completely missing**.

---

### ✅ What's Working

| Layer | Status | Notes |
|---|---|---|
| `benefit_types` + `benefit_settings` (Configure drawer) | ✅ | Persists slot duration, capacity, hours, buffer, no-show policy. |
| `facilities` table (Edit drawer with gender + weekly schedule + maintenance) | ✅ | Schema correct; `available_days`, `gender_access`, `under_maintenance`, `is_active` all stored. |
| `ensure_facility_slots` RPC | ✅ | Correctly skips facilities under maintenance / inactive / when `is_slot_booking_enabled=false`; respects `available_days`; idempotent. |
| `book_facility_slot` RPC | ✅ | Locks row, checks capacity, dedup guard, plan-benefit limit (per_membership/monthly/weekly/daily), writes `benefit_usage`. |
| `cancel_facility_slot` RPC | ✅ | Refunds the matching `benefit_usage` row. |
| `update_slot_booked_count` trigger | ✅ | Increments on insert, decrements on cancel/no_show. |
| Gender filtering on member portal | ✅ | `BookBenefitSlot.tsx` filters slots by member gender. |
| `daily-send-reminders` pg_cron job (08:00 daily) | ✅ | Job exists and dispatches benefit reminders for tomorrow's bookings. |

---

### 🔴 Critical Gaps Found (with proof)

**1. Slots are never auto-generated for the member booking page**
- DB query: `slots = 0`, `slots_future = 0` even though 1 facility (`Ice bath Male`) is active and slot booking is enabled.
- Reason: `src/pages/BookBenefitSlot.tsx` (the page in your screenshot) **never calls `ensureSlotsForDateRange`**. Only `MemberClassBooking.tsx` and `ConciergeBookingDrawer.tsx` do.
- Effect: Members open "Book Benefit Slots" → see "No Slots Available" forever. Staff member-portal route is also dead unless they go through Concierge.

**2. No booking confirmation notification (sms / WhatsApp / email / in-app)**
- `book_facility_slot` RPC ends after writing `benefit_usage`. No invocation of `notify-*` edge function.
- `whatsapp_triggers` table has events for `class_booked`, `class_cancelled`, `facility_slot_reminder` — but **no `facility_slot_booked` or `facility_slot_cancelled`** events exist.
- Effect: Members and staff get zero confirmation when a benefit slot is booked or cancelled.

**3. Cancellation deadline is configured but not enforced**
- `benefit_settings.cancellation_deadline_minutes = 180` is saved, but `cancel_facility_slot` ignores it. Members can cancel 1 minute before the slot — bypassing the no-show policy you configured.

**4. `max_bookings_per_day` cap is configured but not enforced**
- Setting saved, but `book_facility_slot` does not count today's bookings against it. Members can hammer-book the same facility all day.

**5. `booking_opens_hours_before` is configured but not enforced**
- Setting saved, but slots show up the moment they exist. The "Book 48 hrs in advance" rule from your screenshot is dead.

**6. No-show enforcement exists in schema but no automation runs it**
- `no_show_policy` ('mark_used' / 'penalty') is set, `no_show_marked_at` column exists, but **no cron job or trigger** marks unattended slots as `no_show`.

**7. Reminder query bug — fetches all `booked` then filters**
- `send-reminders/index.ts` line 417-423 selects ALL `status='booked'` benefit bookings and filters by date in JS. Will eventually exceed Supabase's 1000-row limit and silently miss reminders.

**8. Staff manual booking path = duplicated logic**
- `ConciergeBookingDrawer` calls `book_facility_slot` correctly, but for cancelling, several places call `.update({status:'cancelled'})` directly instead of the RPC, bypassing the credit refund.

---

### 🛠 Proposed Fix Plan

**Phase 1 — Make slot booking actually work end-to-end (DB + frontend)**

1. **Frontend: auto-generate slots on member page**  
   Add `ensureSlotsForDateRange(member.branch_id, today, today+7)` to `BookBenefitSlot.tsx` so slots appear when a member opens the page. Already pattern-matches `MemberClassBooking.tsx`.

2. **DB migration: harden `book_facility_slot` RPC** — add three checks before insert:
   - `max_bookings_per_day` (count today's active bookings for this member + benefit)
   - `booking_opens_hours_before` (reject if `slot_date + start_time` is further out than the window)
   - Soft-validate facility `under_maintenance=false` and `gender_access` matches profile gender (defense in depth — UI already filters)

3. **DB migration: harden `cancel_facility_slot` RPC** — enforce `cancellation_deadline_minutes` from `benefit_settings`. Return clean error like *"Cancellation window closed — please contact staff."*

**Phase 2 — Notifications (booking confirmation + cancellation)**

4. **DB migration: add 2 new `whatsapp_triggers` events** — `facility_slot_booked`, `facility_slot_cancelled` (so admin can configure templates per branch via existing UI).

5. **DB: extend `book_facility_slot` and `cancel_facility_slot`** to call `pg_net` → `notify-booking-event` edge function (fire-and-forget, mirrors lead-notification pattern we built last week).

6. **New edge function `notify-booking-event`** — looks up the configured trigger, resolves member phone/email, dispatches via existing `send-whatsapp` / `send-sms` / `send-email` universal dispatchers, and writes to `notifications` table for in-app + `communication_logs` for the audit report.

**Phase 3 — Reminders + No-Show automation**

7. **Fix reminder query in `send-reminders/index.ts`** — filter `slot_date = tomorrow` at the DB level via inner-joined view or by switching to a SECURITY DEFINER helper RPC. Avoids the 1000-row trap.

8. **Add T-2 hour reminder** (currently only T-24h exists) — second cron job at `*/30 * * * *` that finds bookings starting in ~2 hours and dispatches a "your session is in 2 hours" nudge.

9. **No-show automation cron** — every 15 min, find `booked` bookings whose slot ended >30min ago with no `check_in_at`, mark `status='no_show'`, apply policy (`mark_used` → keep usage record, `penalty` → keep + log fee).

**Phase 4 — Cleanup**

10. Replace direct `.update({status:'cancelled'})` calls across UI with the `cancel_facility_slot` RPC (so refunds always run).

11. Add `staff_id` (nullable) param to `book_facility_slot`/`cancel_facility_slot` so audit log distinguishes member self-service from staff-on-behalf actions.

---

### 📋 Files / Migrations to Touch

**New migrations**
- `add_booking_business_rule_enforcement.sql` — harden book/cancel RPCs
- `add_facility_slot_trigger_events.sql` — seed 2 new `whatsapp_triggers` events
- `add_booking_notification_dispatch.sql` — pg_net hooks in book/cancel RPCs
- `schedule_no_show_and_t2_reminder_jobs.sql` — 2 new pg_cron jobs

**New edge function**
- `supabase/functions/notify-booking-event/index.ts`

**Modified files**
- `src/pages/BookBenefitSlot.tsx` — auto-generate slots
- `src/pages/MyBenefits.tsx` — same
- `src/components/members/MemberProfileDrawer.tsx` — switch direct cancel → RPC
- `src/pages/AllBookings.tsx` — same
- `supabase/functions/send-reminders/index.ts` — fix tomorrow query + add T-2h pass

---

### 🧪 End-to-End Test Plan (after implementation)

1. As **member**: open Book Benefit Slots → see 7 days of slots auto-generated → book one → receive WhatsApp + in-app notification → see in My Bookings.
2. As **staff**: open Concierge → book on member's behalf → member gets notification.
3. Try to book past `max_bookings_per_day` → blocked with clear error.
4. Try to book outside `booking_opens_hours_before` window → blocked.
5. Cancel inside deadline → succeeds + credit refunded.
6. Cancel outside deadline → blocked.
7. Mark facility `under_maintenance=true` → next-day `ensure_facility_slots` skips it; existing future slots flagged unbookable.
8. Wait until 24h before slot → reminder fires (manually trigger cron via curl).
9. Don't show up → 30min after slot end, status flips to `no_show`, usage record retained per policy.
10. Verify `communication_logs` shows every booking/cancellation/reminder send for the **Communications Audit Report** built last week.

After approval, I'll execute Phase 1–4 in order and run the end-to-end test against your live data.
