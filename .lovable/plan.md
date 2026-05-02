## P2 Optimization & Long-Tail Hardening

Final hardening pass to lift the readiness score from 8.7 to ~9.2. Two independent workstreams:

---

### P2.1 — Bundle size & code-splitting

**Current state**
- 85 pages, almost all already lazy-loaded in `src/App.tsx` ✓
- Single `manualChunks` rule only isolates `three`/`@react-three/*`
- Everything else (recharts, date-fns, lucide-react, framer-motion, radix, supabase-js, tanstack, react-hook-form, zod, html2canvas, jspdf, xlsx, qrcode) lands in one giant vendor chunk → 3.7 MB raw / 866 KB gzip
- Static + dynamic import overlap warnings indicate some lazy pages are also imported eagerly somewhere (drawers, services, or shared barrels)

**Plan**

1. **Vendor-aware manual chunks** in `vite.config.ts` — split the vendor bundle into focused groups so each route only pays for what it uses:
   ```text
   react-vendor    → react, react-dom, react-router-dom
   ui-vendor       → @radix-ui/*, lucide-react, sonner, cmdk, vaul
   data-vendor     → @tanstack/react-query, @supabase/supabase-js, zod, react-hook-form
   charts-vendor   → recharts, d3-*
   date-vendor     → date-fns, dayjs (whichever is used)
   pdf-vendor      → jspdf, html2canvas, qrcode, xlsx
   motion-vendor   → framer-motion
   three           → (already isolated)
   ```
2. **Audit static/dynamic overlap** with `rg` over `src/` for every `lazy(() => import('./pages/X'))` page — confirm no other module statically imports that page (common offenders: barrel `index.ts`, sidebar/menu components importing page components for icons/labels). Convert offenders to type-only imports or constants.
3. **Heavy local libs gated to routes that need them**:
   - `jspdf` / `html2canvas` / `xlsx` → dynamic-import inside the export handler functions, not at module top level
   - `qrcode` → dynamic-import in QR drawers only
   - `framer-motion` (if used) → keep on InclineAscent landing only
4. **Tree-shake lucide-react** — verify all imports are named (`import { X } from 'lucide-react'`), no namespace imports.
5. **Raise chunk-size warning to 700 KB** after splits land (legitimate ceiling for charts-vendor + data-vendor).
6. **Add a CI bundle-size guard** in `.github/workflows/ci.yml`:
   - Run `vite build`
   - Fail if `dist/assets/index-*.js` (entry) > 250 KB gzip OR any single chunk > 600 KB gzip
   - Print top-10 chunks for visibility

**Expected outcome**: entry bundle drops from ~866 KB gzip to ~180–220 KB gzip; first paint on `/auth` and `/member-dashboard` ~2× faster on 3G.

---

### P2.2 — Canonical reminder dispatcher + preference enforcement

**Current state**
- `notification_preferences` table exists but is only read by `src/services/notificationService.ts` for in-app notifications. No edge function checks it before sending Email/SMS/WhatsApp.
- `send-reminders` (683 lines) builds its own dedupe logic ad-hoc per reminder type.
- `send-whatsapp`, `send-sms`, `send-message`, `notify-booking-event`, `notify-lead-created`, `notify-staff-handoff`, `request-google-review`, `run-retention-nudges`, `send-broadcast` all write to `communication_logs` directly with no shared dedupe key or preference gate.
- No `dedupe_key` column on `communication_logs` → re-runs of cron or duplicate webhook deliveries can double-send.

**Plan**

1. **Schema additions** (one migration):
   - `communication_logs.dedupe_key TEXT` + partial unique index `(dedupe_key) WHERE dedupe_key IS NOT NULL`
   - Extend `notification_preferences` with channel-level booleans: `whatsapp_enabled`, `sms_enabled`, `email_enabled`, `quiet_hours_start TIME`, `quiet_hours_end TIME`, `timezone TEXT DEFAULT 'Asia/Kolkata'`, plus per-category WhatsApp/SMS toggles mirroring the existing email_* set.
   - New table `member_communication_preferences` (mirrors notification_preferences but keyed on `member_id` for non-auth members) with the same channel + category fields. Backfill defaults.
   - RLS: members manage their own row; staff can read for their branch.

2. **Canonical dispatcher edge function** `dispatch-communication`:
   ```text
   Input:
     {
       member_id | user_id | recipient,
       branch_id,
       channel: 'whatsapp' | 'sms' | 'email' | 'in_app',
       category: 'membership_reminder' | 'payment_receipt' | 'class_notification'
                | 'announcement' | 'low_stock' | 'new_lead' | 'payment_alert'
                | 'task_reminder' | 'retention_nudge' | 'review_request' | 'transactional',
       template_id?,
       payload: { subject?, body, variables? },
       dedupe_key: string,           // REQUIRED — caller-provided idempotency key
       ttl_seconds?: number,         // dedupe window, default 86400
       force?: boolean,              // bypass preferences (transactional only)
     }

   Pipeline:
     1. Validate input (zod)
     2. SELECT existing communication_logs WHERE dedupe_key = ? AND created_at > now() - ttl
        → if found, return { status: 'deduped', log_id }
     3. Resolve recipient + load preferences (auth user OR member row)
     4. Check category × channel preference (skip if disabled, unless force=true)
        → if blocked, INSERT log row with delivery_status='suppressed', return { status: 'suppressed' }
     5. Check quiet hours in member timezone (skip for transactional)
        → if in quiet hours, schedule for next allowed window via communication_retry_queue
     6. INSERT log row with delivery_status='sending', dedupe_key
        (unique index → safe under concurrent cron ticks)
     7. Route to channel-specific sender (existing send-whatsapp / send-sms / send-email)
     8. Update log with provider_message_id + delivery_status
   ```

3. **Refactor existing edge functions** to call `dispatch-communication` instead of writing logs themselves:
   - `send-reminders` — every reminder loop produces a stable dedupe_key like `membership-expiry:${memberId}:${dueDate}:${channel}`
   - `notify-booking-event` — `booking-${event}:${bookingId}:${channel}`
   - `notify-lead-created` — `lead-created:${leadId}:${channel}`
   - `notify-staff-handoff` — `handoff:${conversationId}:${turn}:${channel}`
   - `run-retention-nudges` — `retention:${memberId}:${tier}:${YYYYMMDD}`
   - `request-google-review` — `greview:${visitId}`
   - `send-broadcast` — `broadcast:${campaignId}:${memberId}:${channel}`
   - `payment-webhook` receipt — `receipt:${paymentId}`

4. **Preferences UI** — add a "Communication Preferences" section to:
   - `/profile` (auth users) — channel toggles + quiet hours
   - `/member-profile` (members) — same, plus per-category opt-outs
   - Default new members to all-on, transactional always on (force=true)

5. **Telemetry** — add `delivery_status='suppressed'` and `'deduped'` enum values; surface counts in `SystemHealth` page.

6. **Documentation** — `docs/communication-dispatcher.md` with the contract, dedupe-key conventions, and "do not write to `communication_logs` directly" rule. Add a CI guard script that fails if any new edge function imports `communication_logs` insert outside `dispatch-communication`.

**Expected outcome**: zero double-sends across cron retries / webhook replays; member opt-outs enforced for marketing categories while transactional (receipts, OTPs, security) still go through; one auditable funnel for all outbound communication.

---

### Files to be created / modified

**P2.1**
- `vite.config.ts` (manualChunks, chunkSizeWarningLimit)
- `.github/workflows/ci.yml` (bundle-size gate)
- ~6–10 components/services with hoisted heavy imports moved inline
- `docs/bundle-strategy.md`

**P2.2**
- `supabase/migrations/<ts>_communication_dispatcher.sql` (schema + RLS + indexes)
- `supabase/functions/dispatch-communication/index.ts` (new)
- Refactor: `send-reminders`, `notify-booking-event`, `notify-lead-created`, `notify-staff-handoff`, `run-retention-nudges`, `request-google-review`, `send-broadcast`, `payment-webhook`
- `src/services/preferencesService.ts` (new)
- `src/components/profile/CommunicationPreferences.tsx` (new), wired into `/profile` and `/member-profile`
- `docs/communication-dispatcher.md`
- CI guard: `scripts/check-direct-comm-writes.sh`

### Out of scope
- Migrating in-app `notifications` table writes (already deduped via `notifications_dedupe_guard` trigger)
- Re-architecting the WhatsApp AI agent (separate concern)
- Mobile push notifications (no mobile shell yet)
