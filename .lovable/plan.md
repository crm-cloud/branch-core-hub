

# GST Billing Logic, SMTP Email Routing & Global Email Overhaul

## Current State (Audit Findings)

1. **No GST tracking fields** on `invoices`, `branches`, `members`, or `organization_settings` tables — no `is_gst_invoice`, `gst_rate`, `customer_gstin`, or branch `gstin`
2. **CreateInvoiceDrawer** already has GST rate selector and `includeGst` toggle, but does NOT persist GST metadata (rate, is_gst_invoice flag) to the database — only saves computed `tax_amount`
3. **PurchaseMembershipDrawer** hardcodes `tax_amount: 0` — no GST option for membership invoices
4. **PDF generator** already shows CGST/SGST split when `tax_amount > 0`, but lacks `is_gst_invoice` flag to show "TAX INVOICE" title and customer GSTIN
5. **send-email Edge Function** already routes dynamically (SMTP/SendGrid/Mailgun/SES) — no hard-coding issues
6. **test-integration Edge Function** already exists with SMS/Email/WhatsApp testing and is wired to IntegrationSettings UI
7. **5 files** use `mailto:` links instead of the custom email dispatcher
8. **InvoiceViewDrawer** `buildPDFData()` does NOT pass `gst_number` or `logo_url` to the PDF generator

---

## Migration: Add GST Fields

```sql
ALTER TABLE branches ADD COLUMN gstin TEXT;
ALTER TABLE invoices ADD COLUMN is_gst_invoice BOOLEAN DEFAULT false;
ALTER TABLE invoices ADD COLUMN gst_rate NUMERIC DEFAULT 0;
ALTER TABLE invoices ADD COLUMN customer_gstin TEXT;
ALTER TABLE members ADD COLUMN gstin TEXT;
```

---

## Epic 1: GST Invoicing & Tax Tracking

### CreateInvoiceDrawer.tsx
- Persist `is_gst_invoice`, `gst_rate`, `customer_gstin` to invoice insert
- When member is selected and has a stored GSTIN, auto-fill `customer_gstin`
- Fetch member's GSTIN alongside profile data
- Show CGST/SGST split (half/half) in the summary card when GST is ON

### PurchaseMembershipDrawer.tsx
- Add GST toggle (Switch) with rate selector (5/12/18/28%)
- Calculate and display GST breakdown before purchase
- Persist `is_gst_invoice`, `gst_rate`, `tax_amount` to the invoice
- Adjust `total_amount` to include tax

### InvoiceViewDrawer.tsx
- Display "TAX INVOICE" badge when `is_gst_invoice` is true
- Show CGST/SGST split in totals section
- Show customer GSTIN and branch GSTIN when available
- Pass `gst_number` and `logo_url` to `buildPDFData()`

---

## Epic 2: Professional Tax Invoice PDF

### pdfGenerator.ts
- When `is_gst_invoice` is true: change title from "INVOICE" to "TAX INVOICE"
- Show Customer GSTIN in Bill To section
- Show branch GSTIN prominently
- Already shows CGST/SGST split — ensure it uses the actual `gst_rate` for labels (e.g., "CGST @ 9%" instead of just "CGST")

### Thermal Receipt
- Add GST number and CGST/SGST breakdown when `is_gst_invoice` is true

---

## Epic 3: Universal Email Button Refactor

Replace `mailto:` links in these 5 files with calls to `send-email` Edge Function via a reusable helper:

| File | Current Pattern | New Pattern |
|---|---|---|
| `LeadProfileDrawer.tsx` | `window.open(mailto:...)` | Call `send-email` function |
| `InvoiceShareDrawer.tsx` | `window.location.href = mailto:` | Call `send-email` function |
| `SmartAssistDrawer.tsx` | `window.open(mailto:...)` | Call `send-email` function |
| `RetentionCampaignManager.tsx` | `window.open(mailto:...)` | Call `send-email` function |
| `MemberProfileDrawer.tsx` | `window.open(mailto:...)` | Call `send-email` function |

Create a shared utility `sendEmailViaProvider(to, subject, html, branchId)` in `communicationService.ts` that invokes the `send-email` Edge Function. Show toast on success/failure. Fallback to `mailto:` if no email provider is configured.

---

## Epic 4: Branch & Member GST Settings UI

### BranchSettings or EditBranchDrawer
- Add GSTIN field to branch edit form
- Persist to `branches.gstin`

### Member Profile
- Add GSTIN field to `EditProfileDrawer.tsx`
- Persist to `members.gstin`

### OrganizationSettings
- No changes needed — branch-level GSTIN is sufficient

---

## Files Changed

| File | Change |
|---|---|
| **Migration** | Add `gstin` to branches/members, `is_gst_invoice`/`gst_rate`/`customer_gstin` to invoices |
| `src/components/invoices/CreateInvoiceDrawer.tsx` | Persist GST fields, auto-fill member GSTIN |
| `src/components/members/PurchaseMembershipDrawer.tsx` | Add GST toggle + rate selector |
| `src/components/invoices/InvoiceViewDrawer.tsx` | Display TAX INVOICE badge, GSTIN, pass data to PDF |
| `src/utils/pdfGenerator.ts` | TAX INVOICE title, customer GSTIN, rate-labeled CGST/SGST |
| `src/services/communicationService.ts` | Add `sendEmailViaProvider()` helper |
| `src/components/leads/LeadProfileDrawer.tsx` | Replace mailto with sendEmailViaProvider |
| `src/components/invoices/InvoiceShareDrawer.tsx` | Replace mailto with send-email invocation |
| `src/components/retention/SmartAssistDrawer.tsx` | Replace mailto |
| `src/components/settings/RetentionCampaignManager.tsx` | Replace mailto |
| `src/components/members/MemberProfileDrawer.tsx` | Replace mailto |
| `src/components/branches/EditBranchDrawer.tsx` | Add GSTIN field |
| `src/components/members/EditProfileDrawer.tsx` | Add GSTIN field for members |

