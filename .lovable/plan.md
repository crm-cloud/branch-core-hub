
# Body Scan Reports — Delivery, Notifications & De-branding

Three deliverables in one pass:

1. **De-brand HOWBODY** from every member/staff-facing surface (settings, public report pages, login/QR page, badges, drawers, route paths). The integration keeps working — only the visible name and assets change.
2. **Auto-deliver every new scan** to the member by Email + WhatsApp (with the PDF), and raise an in-app notification to the member, their assigned trainer, the branch manager(s), and admins/owner.
3. **Hand-off package for HOWBODY**: a clean draft email + spec PDF with the exact endpoints, headers, payload mapping, and behavior we expect from their device — so we can replace their on-device "Send report to mobile" with our Email/WhatsApp delivery.

---

## 1. De-branding (UI only)

Public/member-visible name becomes **"Body Scan"** (composition) and **"Posture Scan"**. Internal tables, edge function names, and DB columns stay (no migration churn).

Surfaces to clean:

| File | Change |
|---|---|
| `src/components/settings/HowbodySettings.tsx` | Rename panel to **"Body Scanner Integration"**. Keep URLs, but label them generically ("QR Login URL", "Body Webhook", "Posture Webhook"). Hide the word HOWBODY from labels/help text. Move the raw vendor name into a small "Vendor: HOWBODY S580" line at the bottom (admin-only context). |
| `src/pages/Settings.tsx` | Tab label already "Body Scanner" ✓. No change. |
| `src/pages/HowbodyLogin.tsx` | Brand strip: `"Body Scan · Incline"`. Footer: `"The Incline Life by Incline"` (drop "Powered by HOWBODY"). Page title + meta. |
| `src/pages/HowbodyPublicReport.tsx` | Strip header from "HOWBODY Report" → **"Incline Body Scan Report"**. Update meta title. |
| `src/components/progress/HowbodyReportsCard.tsx` | Card title "Body Scan Reports". Empty state: "No scans yet. Use the body scanner at your gym…". |
| `src/components/progress/HowbodyReportDrawer.tsx` | Drawer title "Scan Report". |
| `src/pages/Plans.tsx` | Badge text "Body Scan" instead of "HOWBODY Scan". |
| `src/components/progress/ScanQuotaStrip.tsx` | "Body Scan / Posture Scan" labels. |
| `supabase/functions/howbody-report-pdf/index.ts` | PDF header right-side label: **"Body Scan Health Report"** (drop HOWBODY word). Footer line: "Generated from your body scan…". |
| `src/App.tsx` routes | Add cleaner public aliases: `/scan-login`, `/reports/body/:token` (already), `/reports/posture/:token` (already). Keep `/howbody-login` as a hidden alias so existing QR codes printed on devices still work. |

No DB rename, no edge function rename. The vendor name remains only in Settings as "Vendor: HOWBODY" (so admins know what hardware it is).

---

## 2. Scan-report Delivery & Notifications

Trigger point: the existing `howbody-body-webhook` and `howbody-posture-webhook` edge functions (called by the device after every scan).

After we successfully store the row, we fire one new internal function, **`deliver-scan-report`**, fire-and-forget:

```text
device → howbody-*-webhook → INSERT report row
                           → invoke('deliver-scan-report', { report_id, kind })
```

### `deliver-scan-report` (new edge function)

Steps:

1. Load the report row + member + assigned trainer profile + branch.
2. Render the PDF once by calling existing `howbody-report-pdf` with a service-role bearer (returns HTML → convert to PDF via the same path we already use for invoices, or reuse the printable HTML and let the recipient browser print; for v1 we attach the **HTML-to-PDF** generated on the server using the same lightweight wrapper used by `pdfBlob.ts`/`memberDocumentUrls.ts`).
3. Upload PDF to the `attachments` storage bucket under `scans/<member_id>/<report_id>.pdf`. Get a long-lived signed URL.
4. Insert a row in `scan_report_deliveries` (new small audit table: `report_id`, `kind`, `pdf_url`, `email_status`, `whatsapp_status`, `created_at`).
5. **Member email** via `send-email` with the PDF link + summary (template: `body_scan_ready` / `posture_scan_ready`).
6. **Member WhatsApp** via `sendWhatsAppDocument` (`src/utils/whatsappDocumentSender.ts`) — uploads the PDF, sends as document with caption from the WhatsApp template.
7. **In-app notifications** via `notifications` table inserted for:
   - The member (`category: 'scan'`, action_url = `/my-progress`).
   - `members.assigned_trainer_id` → resolve to `user_id` via trainers/profiles → notify.
   - All users with role **manager** for that `branch_id`.
   - All users with role **admin** or **owner** (global, no branch filter).

   Title: "New Body Scan for {{member_name}}", body: short metric summary (Weight, BMI, Body Fat %), action_url to the member's progress page (`/members/<id>?tab=progress`).
8. Realtime fan-out is already handled by the existing notification subscription.

Idempotency: keyed on `report_id` + channel — we skip if `scan_report_deliveries` already has a successful row for that channel.

### Templates registry additions

Add four events to `src/lib/templates/eventRegistry.ts` so admins can edit the wording in the existing template editor:

| Event id | Channel(s) | Variables |
|---|---|---|
| `body_scan_ready` | WhatsApp + Email | `member_name, branch_name, weight, bmi, body_fat, health_score, scan_date, report_url` |
| `posture_scan_ready` | WhatsApp + Email | `member_name, branch_name, posture_type, body_slope, scan_date, report_url` |
| `scan_ready_internal` | In-app (trainer/manager/admin) | `member_name, member_code, kind, scan_date` |

### WhatsApp template sync

For Meta-approved WhatsApp templates the user sends through `manage-whatsapp-templates`, we add two **default seed templates** the admin can submit for approval:

```text
body_scan_ready_v1 (UTILITY, en):
Hi {{1}}, your latest body scan from {{2}} is ready.
Weight: {{3}} kg · BMI: {{4}} · Body Fat: {{5}}%
Tap to view your full report: {{6}}

posture_scan_ready_v1 (UTILITY, en):
Hi {{1}}, your posture analysis from {{2}} is ready.
Posture: {{3}} · Body slope: {{4}}
View report: {{5}}
```

Both are sent as **document messages** with the PDF attachment (caption = the rendered text). If the branch has no active WhatsApp integration, `sendWhatsAppDocument` already gracefully falls back to a `wa.me` link with the public PDF URL — no silent failure.

### "Send to mobile" on the device — replaced

The on-device "Send report to mobile" function becomes a no-op for us — every scan automatically reaches the member by Email + WhatsApp + in-app. The HOWBODY hand-off (section 3) tells the vendor to disable/ignore that button for our deployment, since we handle delivery server-side.

---

## 3. HOWBODY Hand-off Package

We generate two artifacts in `/mnt/documents/`:

**(a) `incline_howbody_integration_spec_v1.pdf`** — single-page integration spec they can wire to. Includes:
- Vendor branding rules: Their device & cloud must NOT show our brand or push to their own consumer app for our members. Our members are bound via QR.
- **QR login URL pattern**: `https://www.theincline.in/howbody-login?equipmentNo={equipmentNo}&scanId={scanId}` (and the new alias `/scan-login`).
- **Body composition webhook**: `POST https://iyqqpbvnszyrrgerniog.supabase.co/functions/v1/howbody-body-webhook`, header `appkey: <shared-secret>`, JSON body matching the existing `howbody-body-webhook` parser (thirdUid, dataKey, testTime, healthScore, weight, bmi, pbf, fat, smm, tbw, pr, bmr, whr, vfr, metabolicAge, …). Expected response envelope: `{ code: 200, message: "Push successful", data: null }`.
- **Posture webhook**: same auth, mirror schema.
- **Bind flow**: After member completes QR login, our `howbody-bind-user` calls HOWBODY's `/openApi/getToken` and `/openApi/bindUser` with the chosen `thirdUid` (= our `members.id`).
- **Disable on-device "Send report to mobile"**: We deliver Email + WhatsApp + PDF ourselves; the device should not push to their own app.
- **Quota / access gating**: Our `/openApi/checkUserAccess` style hook (already implemented as `howbody-bind-user` returning 403 on quota exhaustion) — they must respect the `403` response and refuse to scan.
- **Error contract**: 401 = wrong appkey, 404 = unknown user, 400 = missing required fields. They must retry with backoff for 5xx.

**(b) `incline_howbody_email_draft.txt`** — ready-to-send email draft to the HOWBODY team summarizing the above and attaching the spec PDF. Includes the appkey rotation procedure.

Both are deliverables — emitted as `<lov-artifact>` after generation.

---

## 4. Technical Plan / File-by-file

**New files**
- `supabase/functions/deliver-scan-report/index.ts` — orchestrator (steps above).
- `supabase/functions/_shared/scanReportPdf.ts` — small wrapper that renders the existing `howbody-report-pdf` HTML and returns a PDF Blob (uses the same html-to-pdf util we already ship for invoices).
- `supabase/migrations/<ts>_scan_report_deliveries.sql` — `scan_report_deliveries` audit table (RLS: staff read; service role write) + add `body_scan` / `posture_scan` event ids to whatever enum/registry we use for triggers, if any.
- `/mnt/documents/incline_howbody_integration_spec_v1.pdf`
- `/mnt/documents/incline_howbody_email_draft.txt`

**Modified files**
- `supabase/functions/howbody-body-webhook/index.ts` — after successful upsert, fire-and-forget `deliver-scan-report`.
- `supabase/functions/howbody-posture-webhook/index.ts` — same.
- `supabase/functions/howbody-report-pdf/index.ts` — drop HOWBODY wording from header/footer.
- `src/lib/templates/eventRegistry.ts` — add `body_scan_ready`, `posture_scan_ready`, `scan_ready_internal`.
- `src/components/settings/HowbodySettings.tsx`, `src/pages/HowbodyLogin.tsx`, `src/pages/HowbodyPublicReport.tsx`, `src/components/progress/HowbodyReportsCard.tsx`, `src/components/progress/HowbodyReportDrawer.tsx`, `src/components/progress/ScanQuotaStrip.tsx`, `src/pages/Plans.tsx` — copy/visual de-branding only.
- `src/App.tsx` — add `/scan-login` alias route.

**Not touched**
- DB column names (`howbody_third_uid` etc.), table names, edge function names, existing migrations.
- Quota/benefit logic — already correct from the previous unified-benefits change.

---

## 5. ASCII flow

```text
                Device scans member
                       |
                       v
          POST /howbody-body-webhook
                       |
                       v
            INSERT howbody_body_reports
                       |
                       +--- mirror trigger -> member_measurements
                       |
                       v
       invoke('deliver-scan-report', { report_id })
                       |
        +--------------+---------------+----------------+
        v              v               v                v
   render PDF    notify member    notify trainer    notify managers
   upload to     (in-app +         (in-app)         + admins/owner
   storage       email+WA doc)                       (in-app)
        |
        v
   scan_report_deliveries  (audit)
```

---

## 6. What you'll see after approval

- Every scan auto-arrives in the member's WhatsApp & inbox with the PDF.
- The member's progress page already updates (existing measurement-mirror trigger).
- Trainer dashboard / manager dashboard / admin notification bell shows "New Body Scan for {member}".
- All HOWBODY brand text disappears from member/admin UI; vendor name kept only in Settings as a small "Vendor" line.
- Two artifacts ready in `/mnt/documents/` to forward to HOWBODY.

Approve to implement.
