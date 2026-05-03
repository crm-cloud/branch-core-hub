I audited the invoice share flow, email sender, WhatsApp sender, storage, templates, and recent logs for INV-INC-26-0006 / INV-INC-26-0008.

Findings:

1. The old links you pasted are public storage URLs, but the `attachments` bucket is private. That is why these fail with `404 Bucket not found`:
   `.../storage/v1/object/public/attachments/invoices/...pdf`

2. New generated PDFs are now being uploaded correctly and signed URLs are reachable. I verified the newer signed URL for INV-INC-26-0006 returns `200 application/pdf`.

3. Email did send, but the attachment was not included because your active email provider is SMTP. Current `send-email` supports attachments only for SendGrid and Mailgun. SMTP and SES paths ignore the `attachments` array. So the email body says “PDF attached”, but the actual MIME email contains only HTML/text.

4. The email is plain because `InvoiceShareDrawer` calls `send-email` without `use_branded_template: true`. The branded wrapper exists in `send-email`, but invoice emails are not enabling it.

5. WhatsApp document sending is still failing after upload. The latest communication log for INV-INC-26-0006 shows a signed PDF URL in `delivery_metadata`, but delivery status is `failed` with `Edge Function returned a non-2xx status code`. The `whatsapp_messages` row remains `pending`, meaning the handoff into `send-whatsapp` is not completing successfully.

6. One likely WhatsApp payload issue is in `send-whatsapp`: for document messages it sends either `caption` or `filename`, but not both. Meta document payloads should include `link`, `filename`, and optional `caption`. This can break PDF delivery or make PDFs appear unnamed.

7. Dedupe is also causing confusion during testing. Invoice WhatsApp sends use `invoice:<invoice_id>:wa`; after one failed attempt, retrying the same invoice may be treated as deduped instead of re-sending unless the failed state is explicitly handled.

Plan to fix:

1. Fix invoice email PDF attachments for SMTP
   - Update `supabase/functions/send-email/index.ts` so SMTP sends proper multipart MIME emails when attachments are provided.
   - Add MIME boundaries, `multipart/mixed`, nested `multipart/alternative`, HTML body, and base64 PDF attachment parts.
   - Preserve existing SendGrid and Mailgun attachment behavior.
   - Add attachment support or explicit safe fallback for SES if configured later.

2. Make invoice emails professional by default
   - Update `InvoiceShareDrawer.tsx` to call `send-email` with `use_branded_template: true`.
   - Replace the minimal invoice email body with a polished invoice email section: branded greeting, invoice summary card, paid/due status badge, amount rows, and footer text using “The Incline Life by Incline”.
   - Keep Template Manager content as the editable core body, but wrap it in the branded email shell so template emails are never plain.

3. Add visible proof in logs that email had an attachment
   - Update `send-email` logging metadata to include attachment count, filenames, and content types.
   - Avoid direct duplicate client logging where possible, so communication logs reflect actual provider result.

4. Fix WhatsApp PDF document payload
   - Update `supabase/functions/send-whatsapp/index.ts` for document messages to send:
     - `document.link`
     - `document.filename`
     - optional `document.caption`
   - Ensure `dispatch-communication` passes filename through correctly.
   - Improve the error body returned from `dispatch-communication` so the UI/logs show Meta’s actual reason instead of only “Edge Function returned a non-2xx status code”.

5. Make failed invoice WhatsApp retries actually retry
   - Adjust dispatcher dedupe behavior: if an existing log with the same dedupe key is `failed`, allow a new send attempt instead of returning `deduped`.
   - Keep dedupe protection for `sent`, `queued`, and `sending` states.

6. Stop exposing broken public URLs in the UI/history
   - Ensure all new invoice PDF share flows use signed URLs only.
   - Add a helper to convert existing internal attachment paths to fresh signed URLs when reusing old records.
   - Add a user-facing note in Template Manager: Dynamic invoice PDFs are generated and signed automatically; users should not paste public storage URLs.

7. Improve Template Manager PDF clarity
   - For “Attachment / Header Media”, make Dynamic PDF behavior clearer:
     - “No upload required”
     - “Invoice/receipt PDFs attach automatically during send”
     - Show supported dynamic sources: Invoice PDF, Payment Receipt PDF, Body Scan Report, Diet/Workout Plan
   - Add a preview indicator for seeded Invoice Email and Invoice WhatsApp templates showing they are dynamic PDF templates.

8. Verify with the real affected invoices
   - Re-test INV-INC-26-0006 and INV-INC-26-0008 send paths after code changes.
   - Confirm email payload includes the PDF attachment for SMTP.
   - Confirm WhatsApp uses a signed URL and sends as a document message.
   - Confirm the email renders with the professional branded layout instead of the plain text seen in your screenshot.

Files expected to change:

- `src/components/invoices/InvoiceShareDrawer.tsx`
- `src/lib/templates/dynamicAttachment.ts` if needed for improved invoice email HTML defaults
- `src/components/settings/TemplateManager.tsx`
- `supabase/functions/send-email/index.ts`
- `supabase/functions/send-whatsapp/index.ts`
- `supabase/functions/dispatch-communication/index.ts`
- Possibly a small migration only if we need to update seeded template text or add better log metadata defaults

Expected result:

- Invoice emails will include an actual PDF attachment when using your current SMTP provider.
- Invoice emails will render in the branded/professional template automatically.
- WhatsApp invoice PDFs will send as real document messages using signed URLs.
- Failed WhatsApp attempts will be retryable instead of getting stuck behind dedupe.
- Template Manager will make Dynamic PDF attachments understandable and auto-populated for invoice/receipt use cases.