# Booking System Audit & Enhancement Plan

## 🔍 Audit Findings

### 1. **`benefit_bookings` table — missing critical columns**
Current columns: `id, slot_id, member_id, membership_id, status, booked_at, cancelled_at, cancellation_reason, check_in_at, no_show_marked_at, notes, created_at, updated_at`

**Gaps:**
- ❌ No `booked_by_staff_id` / `cancelled_by_staff_id` → cannot tell who made/cancelled a booking (member self-service vs concierge vs admin override).
- ❌ No `source` field (member_portal / concierge / whatsapp_ai / admin).
- ❌ No `force_added` flag despite the UI exposing a "Force Add (override capacity)" checkbox — it's currently **ignored**.
- ❌ No status-transition audit trail; we only know the *current* status, not the journey (booked → cancelled → rebooked → no-show).

### 2. **`book_facility_slot` / `cancel_facility_slot` RPCs**
- Don't accept `p_staff_id` or `p_force` params → concierge bookings are anonymous and "force add" is a no-op.
- No write to an audit log on success.

### 3. **ConciergeBookingDrawer (src/components/bookings/ConciergeBookingDrawer.tsx)**
- Has `forceAdd` state + checkbox UI but never sends it to the RPC.
- Falls back to a raw `INSERT` into `benefit_bookings` when "force add" is on — this **bypasses credit deduction, daily caps, gender checks, and notification triggers**. A serious data-integrity hole.
- No staff attribution recorded.

### 4. **AllBookings page (admin/staff dashboard)**
- Shows bookings as flat list/table — no slot capacity context (e.g. "Pilates 7am — 8/10 booked" view).
- No timeline/heatmap of slot availability across the day.
- Status changes are not visible (can't see "this booking was cancelled by staff X at 9:42am with reason Y").
- No filter by booking source (concierge vs self-serve).

### 5. **Templates / notification system**
- `templates` table has no `preview_data` or last-validated fields.
- `TemplateManager` lets staff write `{{variables}}` but provides **no preview** — they discover broken templates only after a real WhatsApp/SMS goes out.
- No validation that variables used in body actually exist in the trigger event payload (e.g. `{{member_name}}` for `facility_slot_booked` event).
- `notify-booking-event` edge function injects variables but the mapping is undocumented and untested.

---

## 🛠 Proposed Implementation

### Phase 1 — Database: Audit Log + Booking Attribution
**New migration:**

1. **Extend `benefit_bookings`:**
   ```sql
   ALTER TABLE benefit_bookings
     ADD COLUMN booked_by_staff_id uuid REFERENCES auth.users(id),
     ADD COLUMN cancelled_by_staff_id uuid REFERENCES auth.users(id),
     ADD COLUMN source text NOT NULL DEFAULT 'member_portal'
       CHECK (source IN ('member_portal','concierge','whatsapp_ai','admin','system')),
     ADD COLUMN force_added boolean NOT NULL DEFAULT false;
   ```

2. **New `booking_audit_log` table:**
   ```sql
   CREATE TABLE booking_audit_log (
     id uuid PK,
     booking_id uuid REFERENCES benefit_bookings(id) ON DELETE CASCADE,
     event_type text,        -- 'created','cancelled','no_show','checked_in','force_added','rebooked'
     from_status text,
     to_status text,
     actor_id uuid,          -- auth.users.id (staff or member)
     actor_role text,        -- 'member','staff','admin','system'
     reason text,
     metadata jsonb,         -- { force_added, override_reason, ip, etc. }
     created_at timestamptz DEFAULT now()
   );
   ```
   - RLS: members read their own; staff/admin read branch-scoped.
   - Indexes on `booking_id`, `created_at DESC`, `actor_id`.

3. **Trigger `trg_booking_status_audit` on `benefit_bookings`** — auto-logs INSERT and UPDATE of `status`, capturing `booked_by_staff_id` / `cancelled_by_staff_id` as actor.

### Phase 2 — Harden RPCs
- Update `book_facility_slot(p_slot_id, p_member_id, p_membership_id, p_staff_id default null, p_source default 'member_portal', p_force default false, p_force_reason default null)`:
  - When `p_force = true`, require `p_staff_id IS NOT NULL` (RBAC: caller must have admin/manager role) and bypass capacity + daily-cap + window checks but still write `force_added=true` and a `metadata.override_reason` audit row.
- Update `cancel_facility_slot(p_booking_id, p_reason default null, p_staff_id default null, p_override_deadline boolean default false)` — staff_id stored in `cancelled_by_staff_id`.
- Both RPCs continue to fire `_notify_booking_event` via pg_net.

### Phase 3 — Concierge Drawer & AllBookings UI

**`ConciergeBookingDrawer.tsx`:**
- Pass `p_staff_id = user.id`, `p_source = 'concierge'`, `p_force = forceAdd`, `p_force_reason` (collect short text input when force is checked).
- **Remove the dangerous raw INSERT fallback** — always go through the RPC.

**`AllBookings.tsx` enhancements (Vuexy cards/tables):**
- **New "Slot Availability Timeline" tab**: horizontal day timeline per facility/class showing each slot as a chip — colored by fill (green <60%, amber 60–90%, red ≥90%, grey full). Click chip → side drawer with attendees + quick actions.
- **Booking row enhancements**:
  - "Source" badge (Self / Concierge / WhatsApp AI / Admin).
  - "Booked by" cell (member self vs staff name).
  - Expand row → inline **status timeline** rendered from `booking_audit_log` (icons: ➕ created, ✖ cancelled, ✅ checked-in, ⚠ no-show, 🔓 force-added).
- **New filter**: Source dropdown.

### Phase 4 — Template Preview & Validation

**Schema:** Add `templates.last_validated_at`, `templates.validation_errors jsonb`.

**Define an event→variables registry** (`supabase/functions/_shared/event-schema.ts`) with the canonical variable list per system event — single source of truth shared by `notify-booking-event`, `send-whatsapp`, and the UI.

**`TemplateManager.tsx` upgrades:**
- **Preview pane** in the editor sheet: live render of the template with sample data drawn from the registry for the selected trigger. Updates as the user types.
- **Variable validator**: highlights `{{vars}}` used in the body that are NOT in the registry for the chosen trigger (red underline + helper message). Highlights unused-but-available vars as suggestions.
- **"Send test"** button → fires the template to the staff's own WhatsApp/SMS via the existing dispatcher with sample payload.
- **Inline badge** in template list: ✅ Valid / ⚠ Has unknown vars / ❓ Never validated.

### Phase 5 — Booking Audit Tab on AllBookings
New "Audit" sub-tab (admins only via RBAC): paginated `booking_audit_log` view with filters (date range, action type, actor, member). CSV export.

---

## 📂 Files to be Created / Modified

**Migrations (new):**
- `add_booking_audit_log_and_attribution.sql` — schema + trigger + RLS.
- `harden_booking_rpcs_v2.sql` — replace `book_facility_slot` & `cancel_facility_slot`.
- `add_template_validation_columns.sql`.

**New files:**
- `src/components/bookings/SlotAvailabilityTimeline.tsx`
- `src/components/bookings/BookingStatusTimeline.tsx` (audit-log renderer)
- `src/components/bookings/BookingAuditTab.tsx`
- `src/components/settings/TemplatePreviewPane.tsx`
- `supabase/functions/_shared/event-schema.ts` (variable registry)
- `supabase/functions/send-template-test/index.ts`

**Modified:**
- `src/components/bookings/ConciergeBookingDrawer.tsx` — staff_id, source, force flow + remove unsafe INSERT.
- `src/pages/AllBookings.tsx` — new tabs, source badges, expandable rows, filters.
- `src/components/settings/TemplateManager.tsx` — preview + validator + test send.
- `src/services/benefitBookingService.ts` + `src/hooks/useBenefitBookings.ts` — typed wrappers for new RPC params.
- `src/integrations/supabase/types.ts` — auto-regenerated.

**Out of scope (not changed):**
- Member-facing `MyBenefits.tsx` and `BookBenefitSlot.tsx` (already audited last cycle and OK; member self-bookings will automatically default to `source='member_portal'`).

---

## ✅ End-to-End QA After Implementation
1. Member self-books → `source=member_portal`, audit row created.
2. Staff concierge-books with force-add + reason → `source=concierge`, `force_added=true`, override reason in audit metadata.
3. Cancel by staff past deadline with override → `cancelled_by_staff_id` populated, audit row written.
4. No-show cron → audit row with `actor_role='system'`.
5. Template editor: type `{{unknown_var}}` → red highlight; click "Send Test" → real WhatsApp arrives at staff number.
6. AllBookings → Timeline tab shows today's slots with correct fill colors; expand any booking row to see its full status journey.