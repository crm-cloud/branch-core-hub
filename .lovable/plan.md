## What I found

The two URLs you pasted are old-style public storage URLs:

```text
/storage/v1/object/public/attachments/invoices/...
```

But the `attachments` bucket is now private for security. That is why those links return:

```json
{"statusCode":"404","error":"Bucket not found","message":"Bucket not found"}
```

The correct approach is:
- invoice/report PDFs should be generated per send,
- uploaded to the private `attachments` bucket,
- shared using a signed URL,
- and sent as a WhatsApp document / email attachment automatically.

The Template Manager already has fields for `Header Type`, `Source`, and `Filename Template`, but it is not complete enough for invoices because:
1. Invoice templates are not auto-created / auto-populated.
2. Dynamic PDF templates are not clearly mapped to events like invoice/payment receipt.
3. Submit-to-Meta currently only sends the body text, not a document header sample.
4. Sender flows like Invoice Share do not yet pick the saved template configuration automatically.

## Plan

### 1. Add auto-populated invoice PDF templates
Create or upsert default branch templates for:

- `Invoice PDF — WhatsApp`
  - type: `whatsapp`
  - trigger event: `payment_received` / invoice send
  - header type: `document`
  - source: `dynamic`
  - filename template: `Invoice-{{invoice_number}}.pdf`
  - content similar to: `Hi {{member_name}}, your invoice {{invoice_number}} for {{amount}} is ready. PDF attached.`

- `Invoice PDF — Email`
  - type: `email`
  - subject: `Invoice {{invoice_number}} from {{branch_name}}`
  - header type: `document`
  - source: `dynamic`
  - filename template: `Invoice-{{invoice_number}}.pdf`

This makes Template Manager show invoice PDF templates automatically instead of expecting you to manually configure every field.

### 2. Improve Template Manager UI for dynamic PDFs
Update `TemplateManager.tsx` so the Attachment / Header Media block explains the correct behavior:

- `Static`: upload one reusable media file, stored in `template-media`.
- `Dynamic`: no upload needed. The system generates the PDF at send time.

For invoice templates, auto-fill:
- Header Type = `Document (PDF)`
- Source = `Dynamic`
- Filename Template = `Invoice-{{invoice_number}}.pdf`

Also add quick-preset buttons or a clear selector for common dynamic PDF types:
- Invoice PDF
- Receipt PDF
- Body Scan Report PDF
- Posture Report PDF
- Diet/Workout Plan PDF

### 3. Submit WhatsApp document templates correctly to Meta
Update `manage-whatsapp-templates` so when a WhatsApp template has:

```text
header_type = document
attachment_source = dynamic
```

it submits a Meta template with a `HEADER` component of format `DOCUMENT`, including an example document handle/sample where required by Meta.

The local template will still store dynamic behavior, but Meta will understand it as a WhatsApp document template.

### 4. Make invoice sending use saved templates automatically
Update `InvoiceShareDrawer.tsx` so it:

1. Looks up the active invoice WhatsApp/email template for the invoice branch.
2. Renders template variables automatically:
   - `member_name`
   - `member_code`
   - `invoice_number`
   - `amount`
   - `date`
   - `branch_name`
3. Generates the invoice PDF using the existing PDF builder.
4. Uploads to `attachments` and creates a signed URL.
5. Sends via the canonical communication dispatcher with:
   - body/caption from the saved template,
   - PDF attachment from the generated invoice,
   - filename from `attachment_filename_template`.

If no active invoice template exists, it will fall back to the current hardcoded message.

### 5. Centralize dynamic attachment resolution
Add a small helper for dynamic PDF template handling, for example:

```text
resolveDynamicTemplateAttachment(template, context)
```

It will produce:
- rendered message body,
- rendered subject,
- rendered filename,
- attachment metadata.

This avoids each screen manually guessing how template PDFs work.

### 6. Fix misleading comments and URL behavior
Clean up comments in `uploadAttachment.ts` that still say the bucket is public. The implementation already uses signed URLs, but the comments are misleading.

Also ensure any newly generated links in the app never use:

```text
/object/public/attachments/...
```

for private invoice/report files.

### 7. Add visibility in Template Manager
In the template list, show a small badge when a template includes media:

- `Dynamic PDF`
- `Static Image`
- `Static Video`
- `Static PDF`

This will make it obvious which templates will attach files.

## Expected result

After implementation:

- You will not need to paste or manage invoice PDF URLs manually.
- The Invoice template will be auto-populated in Template Manager.
- Selecting Dynamic PDF means the app generates and attaches the correct invoice/report PDF at send time.
- The old 404 public links will no longer be generated for new sends.
- WhatsApp/email invoice sharing will use your saved templates and attach the PDF automatically.

## Important note about existing broken URLs

Existing old links like:

```text
/storage/v1/object/public/attachments/invoices/...
```

will remain broken because they point to a private bucket public route. New sends will use signed URLs or direct provider attachments instead. If needed, I can also add a small admin action later to regenerate/resend an invoice PDF for old invoices.