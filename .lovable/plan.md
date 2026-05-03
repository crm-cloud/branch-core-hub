# Communications & POS Cleanup Plan

Five fixes, one consistent dispatcher path, no new bloat.

---

## 1. Template Preview Button (Template Manager)

`TemplateManager.tsx` already has an inline preview text block, but no way to see the **rendered email/WhatsApp message with sample data + attachment**.

- Add a **"Preview"** button beside Save in the editor footer.
- Opens a Sheet showing:
  - For **email**: rendered HTML in an iframe (using the same branded wrapper `send-email` applies when `use_branded_template=true`), with sample variable values.
  - For **WhatsApp**: chat-bubble mock with header (image/document name), body, footer, buttons.
  - For **dynamic PDF templates**: a row "Attachment: `Invoice-INV-XXXX.pdf` (generated at send-time)" with a "Test send to me" button that dispatches the template to the current user via `dispatchCommunication` using the latest invoice in the branch as sample data.
- Variables panel lets the operator override sample values before previewing.

No new edge function — preview rendering is client-side using `resolveTemplate()` from `src/lib/templates/dynamicAttachment.ts`.

---

## 2. Verify Email Attachment On Send

The recurring "PDF missing" complaints come from silent attachment drops. Harden the path end-to-end.

**Client (`InvoiceShareDrawer`, `SendPaymentLinkDrawer`, `sendPlanToMember`, `whatsappDocumentSender`)**
- Before dispatching, assert PDF Blob size > 1 KB and content-type `application/pdf`. Fail fast with a toast if empty.
- Upload to `attachments` bucket, then immediately call `createSignedUrl(path, 60*60*24*30)` and HEAD-fetch the URL once to confirm 200 before passing it to the dispatcher. If HEAD fails, retry once, else surface error.

**Edge (`send-email`)**
- After building MIME, log `attachment_count`, `attachment_bytes_total` into `email_send_log.metadata`.
- Reject (return 422) if `attachments[]` was provided but resulting MIME has no `Content-Disposition: attachment` part — guards against base64 fetch failures silently dropping the file.

**Edge (`send-whatsapp`)**
- After Meta call, if payload included `document` but Meta returned an error containing "media", mark log `failed` with explicit `attachment_error` reason instead of generic failure.

**Verification UI**
- In the existing communication log row, add a "📎 PDF" badge whenever `delivery_metadata.attachment` is present, and a tooltip showing filename + signed URL expiry.

---

## 3. Webhook Delivery Tracking — Enhance Dispatcher (No New Function)

We already have `meta-webhook` ingesting WhatsApp `statuses` and `dispatch-communication` writing rows. Today the link between them is loose.

Enhance, do not duplicate:

- **`dispatch-communication`**: when WhatsApp/Email send succeeds, persist the `provider_message_id` (wamid for WA, Message-ID for SMTP) onto `communication_logs.provider_message_id` (already wired) AND mirror to `delivery_metadata.provider_message_id` for non-WA channels.
- **`meta-webhook`**: extend the existing `whatsapp_business_account` branch to handle the `statuses[]` array (sent → delivered → read → failed). Update `communication_logs` by `provider_message_id` setting `delivery_status`, `delivered_at`, `read_at`, `failure_reason`. Already partially scaffolded — finish wiring.
- **`send-email`**: write `Message-ID` header, parse SMTP server response for it, return it to dispatcher. Add a thin `email-delivery-webhook` *route inside* `dispatch-communication` (POST /webhook) for SMTP bounce/complaint callbacks (Hostinger sends none today, but Mailgun/SendGrid will when used) — same function, new path, no extra deployment surface.
- **UI**: on the comm log row, render delivery timeline chips (Queued → Sent → Delivered → Read / Failed) sourced from the four timestamp columns — purely additive.

---

## 4. POS Walk-In: Persist & Display Customer Name/Email/Phone

Database already accepts `p_guest_name/phone/email` and `pos_sales` already stores `customer_name/email/phone`. Two gaps:

**a. Invoice has no customer columns** — name/email/phone live only on `pos_sales`, so non-POS invoice flows and the invoice PDF can't see them.
- Migration: add `customer_name text`, `customer_email text`, `customer_phone text` to `public.invoices` (nullable).
- Update `create_pos_sale` to also populate these on the `INSERT INTO invoices` statement (uses already-resolved `v_customer_name/phone/email`).
- Backfill: `UPDATE invoices i SET customer_* = ps.customer_* FROM pos_sales ps WHERE ps.invoice_id = i.id AND i.customer_name IS NULL`.

**b. Invoice PDF & list don't render guest info**
- `InvoiceViewDrawer` + `pdfGenerator.ts`: when `member_id` is null, render the `customer_name/email/phone` block in the "Bill To" section. Today it falls back to "Walk-in Customer" with no contact info.
- Invoices list table: show guest name in the Member column when `member_id` is null.
- `InvoiceShareDrawer`: pre-fill recipient email/phone from invoice `customer_email`/`customer_phone` for walk-in invoices, so the operator can send the receipt without re-typing.

---

## 5. Single Source of Truth: `dispatchCommunication` Everywhere

Audit found these client paths still calling `send-email` / `send-whatsapp` / `send-sms` directly, bypassing dispatcher (no dedupe, no preference check, no quiet-hours, no unified logging):

- `src/components/invoices/InvoiceShareDrawer.tsx` (line 212)
- `src/components/invoices/SendPaymentLinkDrawer.tsx` (line 90)
- `src/components/fitness/member/WhatsAppShareDialog.tsx` (line 75)
- `src/utils/sendPlanToMember.ts` (line 157)
- `src/utils/whatsappDocumentSender.ts`
- `src/pages/WhatsAppChat.tsx` (operator manual sends — keep direct, but log via dispatcher's helper)

**Action**
- Promote `dispatchCommunication()` (already implied by memory + edge fn) into a real, exported client helper at **`src/lib/comms/dispatch.ts`** wrapping `supabase.functions.invoke('dispatch-communication', …)` with typed args (channel, recipient, template_key OR raw body, attachment, dedupe_key, member_id, branch_id, category).
- Migrate all 6 call sites above to use it. Delete now-unused inline payload constructions.
- Add ESLint rule (or extend the existing CI guard mentioned in memory) to forbid `functions.invoke('send-email'|'send-whatsapp'|'send-sms')` outside `src/lib/comms/dispatch.ts` and `supabase/functions/`.
- `dispatch-communication` becomes the **only** place that:
  - applies member channel/category preferences
  - enforces quiet hours
  - dedupes by `dedupe_key`
  - writes to `communication_logs`
  - chooses the underlying provider edge fn

---

## Cleanup (small, safe deletions)

- Remove the now-redundant inline branded HTML builder in `InvoiceShareDrawer` — dispatcher + `send-email` `use_branded_template` already render this.
- Drop legacy `communicationService.logCommunication()` direct-insert (memory says CI guard already blocks it; remove the dead method).
- Collapse `whatsappDocumentSender.ts` into a thin re-export of `dispatch.ts` to keep callers compiling, then schedule for deletion.

---

## Technical Detail Section

**New files**
- `src/lib/comms/dispatch.ts` — typed client wrapper.
- `supabase/migrations/<ts>_invoice_customer_fields.sql` — add 3 columns + backfill + update `create_pos_sale`.

**Modified files**
- `src/components/settings/TemplateManager.tsx` — Preview button + Sheet.
- `src/components/invoices/InvoiceViewDrawer.tsx`, `src/utils/pdfGenerator.ts`, `src/pages/Invoices.tsx`, `src/components/invoices/InvoiceShareDrawer.tsx`, `src/components/invoices/SendPaymentLinkDrawer.tsx` — guest customer rendering & attachment guards.
- `src/components/fitness/member/WhatsAppShareDialog.tsx`, `src/utils/sendPlanToMember.ts`, `src/utils/whatsappDocumentSender.ts` — switch to `dispatch()`.
- `supabase/functions/dispatch-communication/index.ts` — provider_message_id mirroring + SMTP bounce webhook route.
- `supabase/functions/send-email/index.ts` — attachment assertion, Message-ID capture, metadata logging.
- `supabase/functions/send-whatsapp/index.ts` — explicit attachment_error reason.
- `supabase/functions/meta-webhook/index.ts` — finish `statuses[]` → `communication_logs` update.
- `.github/workflows/ci.yml` — extend direct-write guard to also forbid direct provider invokes.

**Schema change**
```sql
ALTER TABLE public.invoices
  ADD COLUMN customer_name  text,
  ADD COLUMN customer_email text,
  ADD COLUMN customer_phone text;
-- + index on customer_phone for walk-in lookup
-- + backfill from pos_sales
-- + CREATE OR REPLACE create_pos_sale to populate these
```

**Out of scope (intentionally not building)**
- New webhook receiver functions — reuse `dispatch-communication` and `meta-webhook`.
- New tables for delivery events — `communication_logs` already has `delivery_status`, `delivered_at`, `read_at`, `provider_message_id`.
- Rewriting `send-email` provider abstraction — current SMTP/SendGrid/Mailgun branch is fine.
