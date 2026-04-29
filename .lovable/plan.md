# Body Scan Delivery + Communication Hub Overhaul

Six tightly-related items. All work plugs into existing tables (`templates`, `communication_logs`, `communication_delivery_events`, `whatsapp_templates`, `scan_report_deliveries`) and the unified `WhatsAppTemplatesHub` — no new template surfaces.

---

## 1. Seed Scan Templates (Email + WhatsApp + SMS)

Migration to `INSERT ... ON CONFLICT DO NOTHING` into `public.templates` for every branch:

- `body_scan_ready` — Email (HTML + subject), WhatsApp text, SMS — all reference `{{member_name}}`, `{{scan_date}}`, `{{report_url}}`.
- `posture_scan_ready` — same channels, posture-specific copy.
- `scan_ready_internal` — WhatsApp + Email to assigned trainer / branch managers / admins, with member name + report link.

Edit `deliver-scan-report` edge function to look up these templates by `trigger` + `type` + branch (instead of inline strings), render via the existing `{{var}}` interpolator, and call the universal dispatcher (`send-whatsapp-message`, `send-email`, `send-sms`). Each send writes a `communication_logs` row tagged with `template_id` and `delivery_metadata.scan_report_delivery_id` so logs link back.

## 2. Delivery Logs Surface

`scan_report_deliveries` already exists. Add:
- A `ScanDeliveryLogPanel` inside the member's Progress drawer (read for that member, scoped by RLS).
- A new admin tab in **Communication Hub → Logs** filter chip "Body Scan" that filters `communication_logs` by `template.trigger IN ('body_scan_ready','posture_scan_ready','scan_ready_internal')`.
- Realtime subscription on `communication_delivery_events` so status flips (queued → sent → delivered → read → failed) animate live.

## 3. HOWBODY Hand-off Package — Why & Scope

Reason: the device firmware UI shows a "Send to phone" button we cannot suppress, and the HOWBODY-branded PDF is generated **on-device**, not by us. We need their team to (a) point the webhook to our endpoints (already done) and (b) optionally disable / relabel the on-device "Send to phone" — or at minimum confirm it's safe to ignore because we deliver via Email + WhatsApp ourselves. Their PDF branding stays as-is (acceptable per your note).

Generate `/mnt/documents/incline_bodyscan_handoff_v1.pdf` containing:
- Webhook endpoints (body + posture) with sample payloads
- Auth header expectations
- Member binding flow (`/scan-login`)
- Request: disable or rename on-device "Send to phone" (optional)
- Confirmation that on-device PDF branding is acceptable
- Contact + escalation

Plus `/mnt/documents/incline_bodyscan_handoff_email.txt` ready to forward.

## 4. Communication Hub — Full Redesign

Rebuild `src/pages/Announcements.tsx` (route stays `/announcements`, but page renamed in nav to **Communication Hub**) with a clean Vuexy layout:

```text
┌─ Hero strip: 5 KPI cards (Sent / Failed / Delivered / Read / Pending) ─┐
├─ Channel filter chips: All · WhatsApp · SMS · Email · Body Scan        │
├─ Tabs:                                                                  │
│   • Live Feed       (realtime infinite-scroll log w/ status timeline)  │
│   • Announcements   (current list + add)                               │
│   • Broadcasts      (history + new broadcast button)                   │
│   • Failed & Retry  (retry queue with "Retry now" action)              │
│   • Delivery Audit  (per-message timeline drawer)                      │
└─────────────────────────────────────────────────────────────────────────┘
```

Live Feed details:
- Subscribes to `communication_logs` INSERT/UPDATE **and** `communication_delivery_events` INSERT.
- Each row: channel icon, recipient, member link, template name, status badge, sent_at relative, expandable timeline pulled from `communication_delivery_events` (queued → provider_sent → delivered → read / bounced).
- Search by recipient / member; date range; status filter; channel filter.
- "View raw" drawer shows rendered content + provider_message_id + error.
- CSV export of current filter.

Failed & Retry:
- Reads `communication_retry_queue`; "Retry now" calls existing dispatcher.

Reference image styling guidance from your screenshot (timeline + rich filters) is honored — implementation uses our existing Vuexy tokens (`rounded-2xl`, soft shadows, gradient hero).

## 5. Template Manager — Approval Status Clarity

Refactor `WhatsAppTemplatesHub` so the **CRM Templates** tab is split into sub-tabs by status, driven by joining `templates` ↔ `whatsapp_templates` (Meta status) on normalized name:

```text
CRM Templates
 ├─ All          (count)
 ├─ ✅ Approved  (Meta status = APPROVED, can be sent)
 ├─ ⏳ Pending   (Meta status = PENDING)
 ├─ ❌ Rejected  (Meta status = REJECTED — show reason)
 └─ ⚪ Draft     (no Meta linkage — local only, WhatsApp send blocked)
```

Each row gets:
- Status pill with tooltip explaining what it means.
- "Submit to Meta" CTA on Drafts (calls existing Meta sync function).
- "View rejection reason" on Rejected.
- Channel badges (WA / SMS / Email) so you see at a glance which channels the template covers.

Same status pills also appear in the broadcast/announcement template picker so users never pick an unapproved WhatsApp template.

## 6. Unify Announcements "Message Templates" Button

The Sheet at `Announcements.tsx` lines 110-157 currently re-implements its own template browser. Replace it with:

- A lightweight **read-only picker** that calls the same `useTemplates()` hook as `WhatsAppTemplatesHub` (single source of truth) and renders status pills from #5.
- A "Manage in Template Manager" link button that deep-links to `/settings?tab=templates&sub=crm`.
- BroadcastDrawer template dropdown filters out non-Approved WhatsApp templates automatically.

No second template store is created. The `templates` table remains the only source.

---

## Technical Notes

**DB migration**
- Seed scan templates per branch (idempotent).
- View `v_template_with_meta_status` joining `templates` + `whatsapp_templates` for the Approved/Pending/Rejected/Draft surface.
- Index `communication_logs(branch_id, sent_at desc)` if missing for the live feed.

**Edge functions**
- `deliver-scan-report`: switch from inline copy to `templates`-driven copy + dispatcher; write `communication_logs` rows linked via `delivery_metadata`.
- New `scan-vendor-handoff-pdf` is **not** needed — generate the PDF locally with `pdf-lib` in `code--exec` and drop into `/mnt/documents/`.

**Frontend**
- Replace `src/pages/Announcements.tsx` with new layout (keeps existing AddAnnouncementDrawer + BroadcastDrawer).
- New `src/components/communications/LiveFeed.tsx`, `DeliveryTimeline.tsx`, `FailedRetryPanel.tsx`.
- Update `WhatsAppTemplatesHub.tsx` + `TemplateManager.tsx` for status sub-tabs.
- Update `BroadcastDrawer.tsx` template select to filter approved-only and show pills.
- Update sidebar label "Announcements" → "Communication Hub".

**Realtime**
- Enable replica identity / publication on `communication_logs` and `communication_delivery_events` if not already (check `supabase_realtime` publication in migration).

**Out of scope**
- No on-device firmware changes (vendor responsibility).
- No new template editor surfaces — single unified Template Manager remains canonical.

Approve to implement all six in one pass.
