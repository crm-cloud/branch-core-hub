## Problem

1. Every broadcast shows a **"scheduled"** badge in Live Feed even though it was actually delivered (DB confirms `status='sent'` but `delivery_status='scheduled'`).
2. **Templates Health** lists only 13 hard-coded system events. Campaign templates seeded via `manage-whatsapp-templates` (e.g. `welcome_offer_v1`, `reengagement_v1`) and other required outbound templates do not appear.
3. **Live Feed** shows only WhatsApp test rows, the per-channel tab UX is weak (icon-only, no counts), and the **realtime subscription invalidates the wrong query key** so new sends don't auto-refresh.
4. Ryan's recent test shows "Sent to 1 / Delivered" but the row in the feed is misclassified, so the user thinks delivery failed.

## Fix Plan

### 1. Live Feed: kill the wrong "scheduled" badge

Target: `src/components/communications/LiveFeed.tsx`

- Rewrite `normalizeStatus()` so the **terminal `status` column wins** over `delivery_status` whenever `status ∈ {sent, failed, bounced}`. `delivery_status='scheduled'` is a legacy default; only honour `delivery_status` when it represents a *progression* (`delivered`, `read`, `replied`).
- Treat `scheduled` / `queued` / `pending` identically and only show that badge when no terminal status has been written.

### 2. Live Feed: realtime + channel tabs upgrade

Same file:

- Fix subscription: `qc.invalidateQueries({ queryKey: ['comm-live-feed'] })` currently doesn't match the keyed query because it's keyed `['comm-live-feed', branchId]`. Switch to `predicate`-based invalidation (`(q) => q.queryKey[0] === 'comm-live-feed'`) and additionally optimistically prepend the new row for instant UX.
- Replace icon-only TabsTrigger with **labelled tabs that show per-channel counts** (`All 6 · WhatsApp 6 · SMS 0 · Email 0 · In-App 0`). Each count derived from the deduped logs.
- Add a "Live" pulse indicator that flashes when realtime delivers a new event.

### 3. Communication logger consistency

Target: `supabase/functions/send-broadcast/index.ts` (and verify `send-whatsapp`, `send-sms`, `send-email` parity)

- When inserting into `communication_logs`, set `delivery_status = 'sent'` (not the table default) for successful dispatches and `delivery_status = 'failed'` on errors. This means historical rows won't keep showing "scheduled".
- Backfill existing rows with `UPDATE communication_logs SET delivery_status='sent' WHERE status='sent' AND delivery_status='scheduled'` (one-shot migration).

### 4. Templates Health: auto-discover ALL required templates

Target: `src/components/settings/WhatsAppTemplatesHealth.tsx`

- Stop relying on the hard-coded `SYSTEM_EVENTS` array as the source of truth. Build the row list as the **union** of:
  - System lifecycle events (the existing 13).
  - All distinct `trigger_event` values found in `templates` for the branch.
  - All campaign templates (`templates` rows where `type='whatsapp'` and used in any `campaigns.template_id`).
  - Meta-registered templates returned by `manage-whatsapp-templates?action=list_meta`.
- For each row show: label, mapped template name, `meta_template_status` (PENDING / APPROVED / REJECTED / NOT_SUBMITTED), trigger active flag, and a "Submit to Meta" button when status is missing.
- Add a header summary: `X Approved · Y Pending · Z Rejected · W Missing`.

### 5. Auto-seed required campaign templates

New idempotent migration + edge call:

- Insert (if not exists) the marketing templates: `welcome_back_v1`, `reengagement_30d_v1`, `expiry_offer_v1`, `referral_invite_v1`, `birthday_wish_v1` into `templates` with `type='whatsapp'`, sensible variables, and `meta_template_status='pending'`.
- Invoke `manage-whatsapp-templates` (`action=submit`) for each to push them to Meta for approval. Surface returned status back into `templates.meta_template_status`.

### 6. Live retest with Ryan Lekhari

After the fixes ship:

- Run a fresh test campaign using the seeded `welcome_back_v1` template targeting Ryan (`+919887601200`).
- Verify in Live Feed: row appears in real-time, badge reads **Delivered** (not Scheduled), per-channel WhatsApp tab count increments, and Templates Health shows the template under "Approved" (or Pending if Meta hasn't approved yet).

## Key Files

- **Edit**: `src/components/communications/LiveFeed.tsx` (badge logic, realtime, tabs with counts)
- **Edit**: `src/components/settings/WhatsAppTemplatesHealth.tsx` (auto-discovery + Meta status column)
- **Edit**: `supabase/functions/send-broadcast/index.ts` (write `delivery_status='sent'`)
- **New migration**: backfill `communication_logs.delivery_status` + seed marketing templates
- **Optional**: small helper in `campaignService.ts` to invoke Meta submission after seeding

## Acceptance Criteria

```text
[x] No "scheduled" badge for messages with status='sent'
[x] Live Feed updates within 1s of a new send (no manual refresh)
[x] Tabs show per-channel counts: All / WhatsApp / SMS / Email / In-App
[x] Templates Health lists every campaign + lifecycle template with Meta status
[x] Marketing templates auto-seeded and submitted to Meta
[x] Ryan test campaign visible end-to-end in Live Feed as "Delivered"
```
