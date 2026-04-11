

# Universal Communications Audit & Branded Automation

## Current State (Audit Findings)

### Hard-coded Issues Found
1. **`send-broadcast`** — Email sending is hard-coded to Resend API (`RESEND_API_KEY`). SMS and WhatsApp channels are only "logged" with no actual dispatch.
2. **`send-sms`** — Already provider-agnostic (routes via `integration_settings`). MSG91 uses Flow API v5 correctly. No issues here.
3. **`send-whatsapp`** — Already pulls credentials dynamically from `integration_settings`. Clean.
4. **`send-reminders`** — Only creates notification/log records; does NOT actually dispatch SMS/email/WhatsApp. Just collects data.
5. **Email sending** — No `send-email` edge function exists at all. The only email path is the hard-coded Resend in `send-broadcast`. No SMTP support anywhere.
6. **PDF Generator** — `pdfGenerator.ts` generates payslips and fitness plans via `window.open()` + `print()`. No invoice PDF generator exists. The `InvoiceShareDrawer` generates an HTML print view inline but not a proper PDF.
7. **No "Test Connection" button** on any integration card.

---

## Epic 1: Universal SMS & Email Routing

### 1A: Create `send-email` Edge Function (NEW)
A universal email dispatcher that reads the active email provider from `integration_settings` and routes accordingly:

| Provider | Method |
|---|---|
| `smtp` | Direct SMTP via Deno's `smtp` module (TLS/SSL) |
| `sendgrid` | SendGrid v3 REST API (`api.sendgrid.com/v3/mail/send`) |
| `ses` | AWS SES v2 REST API with SigV4 signing |
| `mailgun` | Mailgun REST API (`api.mailgun.net/v3/{domain}/messages`) |

Accepts: `{ to, subject, html, text?, branch_id, attachments?: [{ filename, content_base64, content_type }] }`

### 1B: Fix `send-broadcast` — Remove Resend Hard-coding
Replace the Resend block with a call to `send-email` edge function (or inline the same dynamic provider lookup). Also wire SMS channel to invoke `send-sms` and WhatsApp to invoke `send-whatsapp` instead of just logging.

### 1C: Fix `send-reminders` — Actually Dispatch Messages
After collecting reminders, invoke `send-sms` / `send-email` / `send-whatsapp` for each notification based on configured providers.

### 1D: Test Connection Button
Add a `test-integration` edge function that accepts `{ type, provider, config, credentials }` and sends a test message:
- SMS: sends "Incline Fitness: Test SMS ✓" to a configured test number
- Email: sends a test email to the admin's email
- WhatsApp: sends a test template or text message

Add a "Test Connection" button in `IntegrationConfigSheet` after the Save button.

### 1E: MSG91 Flow API Fix
Current MSG91 implementation sends `message` as a raw text field to Flow API. MSG91 Flow API requires `template_id` and variable substitution — NOT raw message text. Update the schema to include `template_id` field and fix the payload structure:
```json
{
  "template_id": "...",
  "short_url": "0",
  "recipients": [{ "mobiles": "919876543210", "var1": "value1" }]
}
```

---

## Epic 2: Professional Branded Templates (Incline Fitness)

### 2A: Branded Invoice HTML Template
Create a `generateInvoicePDF` function in `pdfGenerator.ts` that produces a premium branded invoice with:
- Incline Fitness logo (pulled from `organization_settings` or branch data)
- Branch-specific address, phone, GST number
- Clean table layout with line items, subtotal, GST breakdown (CGST/SGST), total
- Payment status badge (Paid/Partial/Pending)
- "Pay Now" button section for Razorpay/PhonePe (when sharing digitally)

### 2B: Branded Welcome Email HTML
Create a rich HTML email template (stored in `messageTemplates.ts`) for welcome emails with:
- Incline Fitness gradient header
- Member name, plan details, branch address
- Login link / app download CTA
- Footer with social links

### 2C: Payment Link Templates
Update `SendPaymentLinkDrawer` and WhatsApp/email templates to include high-contrast branded "Pay Now" buttons with Razorpay/PhonePe logos.

---

## Epic 3: Invoice PDF & POS Receipt Generation

### 3A: Invoice PDF Generator
Add `generateInvoicePDF(invoice, branch, orgSettings)` to `pdfGenerator.ts`:
- Pulls gym logo URL from `organization_settings`
- Pulls branch GST number, address from `branches` table
- Generates A4 format with proper GST calculation display
- Uses `window.open()` + `print()` pattern (consistent with existing code)

### 3B: Thermal Receipt Layout (80mm)
Add `generateThermalReceipt(invoice, branch)` for POS:
- 80mm wide format (302px)
- Condensed font, no images (thermal printer compatible)
- Dashed separators, left-aligned text
- QR code placeholder for digital payment verification

### 3C: Auto-Attachment via Email
When sharing an invoice via email, generate the HTML invoice, convert to Base64, and pass as attachment to `send-email` edge function. For WhatsApp, upload the PDF to Supabase Storage and send as document type via `send-whatsapp`.

### 3D: Wire PDF into InvoiceViewDrawer & InvoiceShareDrawer
- Add "Download PDF" and "Print Thermal" buttons to `InvoiceViewDrawer`
- Update `InvoiceShareDrawer` email flow to attach the invoice PDF

---

## Files Changed

| File | Change |
|---|---|
| `supabase/functions/send-email/index.ts` | **NEW** — Universal email dispatcher (SMTP/SendGrid/SES/Mailgun) |
| `supabase/functions/test-integration/index.ts` | **NEW** — Test connection for SMS/Email/WhatsApp |
| `supabase/functions/send-broadcast/index.ts` | Remove Resend hard-coding, use dynamic provider routing |
| `supabase/functions/send-reminders/index.ts` | Wire actual message dispatch via send-sms/send-email |
| `supabase/functions/send-sms/index.ts` | Fix MSG91 to use proper Flow API template_id structure |
| `src/config/providerSchemas.ts` | Add `template_id` field to MSG91 schema |
| `src/utils/pdfGenerator.ts` | Add `generateInvoicePDF()` and `generateThermalReceipt()` |
| `src/data/messageTemplates.ts` | Add branded HTML email templates (welcome, invoice, payment link) |
| `src/components/invoices/InvoiceViewDrawer.tsx` | Add Download PDF / Print Thermal buttons |
| `src/components/invoices/InvoiceShareDrawer.tsx` | Wire email attachment flow |
| `src/components/settings/IntegrationSettings.tsx` | Add "Test Connection" button in config sheet |

No new database migrations required — all provider credentials already stored in `integration_settings` JSONB columns.

