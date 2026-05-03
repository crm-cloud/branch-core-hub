# Fix WhatsApp / Email PDF Attachments

## Problem
The `attachments` bucket is **private**, but `uploadAttachment()` still returns a **public URL** via `getPublicUrl()`. That URL responds with `404 Bucket not found`, so when WhatsApp Cloud API tries to fetch the `document.link`, it fails and `dispatch-communication` returns a non-2xx — the exact error in your screenshot.

This breaks every flow that sends a PDF over WhatsApp or Email:
- Invoice share (`InvoiceShareDrawer`)
- POS receipt (`POS.tsx`)
- Plan PDF send (`sendPlanToMember`)
- WhatsApp chat manual upload (`WhatsAppChat.tsx`)

(Scan reports already work — they use `createSignedUrl` directly.)

## Fix

### 1. `src/utils/uploadAttachment.ts` — return a signed URL
Replace the `getPublicUrl()` call with a long-lived `createSignedUrl()` (30-day TTL — matches the scan-report pattern). Returned shape stays `{ url, path }` so no caller needs to change.

### 2. Storage RLS — allow staff/owner uploads to shared folders
Current INSERT policy `Attachments owner can write` only allows `auth.uid()/...` paths, but invoice/receipt/plan uploads write to `invoices/...`, `receipts/...`, `plans/...`. The legacy "Authenticated users can upload attachments" still allows the write today, but it's fragile. Add an explicit policy:

```sql
CREATE POLICY "Staff can write shared attachments"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'attachments'
    AND (storage.foldername(name))[1] IN ('invoices','receipts','plans','shared','scans','reports')
    AND (has_role(auth.uid(),'owner') OR has_role(auth.uid(),'admin')
         OR has_role(auth.uid(),'manager') OR has_role(auth.uid(),'staff')
         OR has_role(auth.uid(),'trainer'))
  );
```

The existing read policy already covers staff/owner, so signed URLs (which embed a token) work for the WhatsApp/Meta fetcher and for member email recipients.

### 3. Fix `src/pages/WhatsAppChat.tsx` manual upload
Same swap: replace `getPublicUrl` with `createSignedUrl(path, 60*60*24*30)` so manually-attached files in chat actually open.

### 4. Audit / clean up
- `src/utils/whatsappDocumentSender.ts` and `src/utils/sendPlanToMember.ts` — no code change needed, they consume `{ url }` from `uploadAttachment`.
- `src/components/invoices/InvoiceShareDrawer.tsx` — no change (uses the helper).
- `src/components/settings/TemplateManager.tsx` — `attachment_source = 'dynamic'` already documented; just confirm callers pass `attachment.url` (they do).

### 5. Verification
After deploy, re-send invoice INV-INC-26-0008 from the Invoice Share drawer:
- Live Feed row should turn green (Sent → Delivered)
- Tap-to-open on the PDF in WhatsApp opens the file (not a 404)

## Files to change
- `src/utils/uploadAttachment.ts` (signed URL)
- `src/pages/WhatsAppChat.tsx` (signed URL)
- `supabase/migrations/<new>.sql` (storage policy for shared folders)

## Out of scope
- Re-issuing previously-broken WhatsApp messages (URLs in `whatsapp_messages` already point at the dead public URL — they will stay broken unless you resend the invoice).
- Migrating to a dedicated public `shared-pdfs` bucket — signed URLs are sufficient and safer for member PII.
