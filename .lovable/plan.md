

# Plan: Razorpay Payment Automation & Finance Engine

## Audit Findings

### System Health
- **DB Errors**: `column "is_active" does not exist` — a query somewhere references `is_active` on a table that lacks it. Need to trace.
- **Edge Function Errors**: No 4xx/5xx edge function logs found — clean.
- **Razorpay MCP**: Not available in Lovable's connector catalog. No MCP server exists for Razorpay. The Razorpay REST API is well-documented and our existing `create-razorpay-link` already implements it correctly using `POST /v1/payment_links/` with proper Basic Auth, `reference_id`, and `notify: { sms: true, email: true }`.

### What Already Works Well
- `create-razorpay-link` — correctly generates payment links with dynamic credentials from `integration_settings`
- `payment-webhook` — handles `payment_link.paid` event, calls `record_payment` RPC atomically, triggers MIPS sync for membership items
- `SendPaymentLinkDrawer` — full UI for generating + sharing links via WhatsApp/copy
- `record_payment` RPC — atomically updates invoice balance, activates linked memberships
- GST columns exist: `is_gst_invoice`, `gst_rate`, `customer_gstin` on invoices; `hsn_code` on `invoice_items`
- `CreateInvoiceDrawer` already has GST toggle with CGST/SGST split

### What's Missing or Broken
1. **POS has no "Generate Payment Link" option** — only cash/card/UPI/wallet
2. **No Realtime subscription** on invoice status — staff must manually refresh
3. **PDF generator doesn't produce Tax Invoices** — no GSTIN, no "TAX INVOICE" header, no HSN column
4. **Webhook doesn't handle PayU** — only Razorpay and PhonePe
5. **`PurchaseMembershipDrawer` has no "Generate Payment Link" flow** — only immediate payment
6. **`is_active` column error** — need to trace which table/query

---

## Implementation

### Module 1: Fix `is_active` DB Error
- Trace the query causing `column "is_active" does not exist` by searching codebase for `is_active` on tables that lack it
- Fix the offending query

### Module 2: POS — Add "Generate Payment Link" Option
**File: `src/pages/POS.tsx`**
- Add a `razorpay_link` option in the payment method Select alongside cash/card/upi/wallet
- When selected, after checkout creates the invoice, call `create-razorpay-link` instead of `record_payment`
- Show the generated link in the success dialog with copy/share buttons
- Add Supabase Realtime subscription on `invoices` table filtered by the current invoice ID — when status changes to `paid`, show a green "✅ Payment Received" toast and update the Recent Sales list

### Module 3: PurchaseMembershipDrawer — Payment Link Option
**File: `src/components/members/PurchaseMembershipDrawer.tsx`**
- Add a "Send Payment Link" option in payment method
- When selected, skip immediate `record_payment`, create invoice as `pending`, then call `create-razorpay-link`
- Show link result with copy/WhatsApp share

### Module 4: Invoices Page — Realtime Status Updates
**File: `src/pages/Invoices.tsx`**
- Subscribe to `postgres_changes` on `invoices` table for the current branch
- When an invoice status changes (e.g., webhook marks it `paid`), auto-update the table row with a brief highlight animation
- Show a toast: "Invoice INV-XXX marked as Paid"

### Module 5: Tax Invoice PDF Enhancement
**File: `src/utils/pdfGenerator.ts`**
- Add a `generateTaxInvoice()` function (or extend existing invoice PDF logic)
- When `is_gst_invoice` is true:
  - Title: "TAX INVOICE" instead of "Invoice"
  - Show gym GSTIN (from `organization_settings.gstin`) and branch address
  - Show customer GSTIN if available
  - Add HSN/SAC code column in line items table
  - Show CGST/SGST split in totals section
  - Add "Subject to [State] jurisdiction" footer

### Module 6: Webhook — Add PayU Support
**File: `supabase/functions/payment-webhook/index.ts`**
- Add `payu` to `ALLOWED_GATEWAYS`
- Implement PayU signature verification: `sha512(key|txnid|amount|productinfo|...)`
- Parse PayU `Successful` status from POST form data
- Extract `udf1` (used as `reference_id` / invoice ID) and call `record_payment` RPC
- Follow same MIPS sync pattern as Razorpay

### Module 7: Realtime — Enable for Invoices Table
**Migration**: `ALTER PUBLICATION supabase_realtime ADD TABLE public.invoices;`

---

## Files Changed

| File | Change |
|---|---|
| `src/pages/POS.tsx` | Add "Payment Link" method, Realtime subscription |
| `src/components/members/PurchaseMembershipDrawer.tsx` | Add "Send Payment Link" flow |
| `src/pages/Invoices.tsx` | Realtime invoice status updates |
| `src/utils/pdfGenerator.ts` | Tax Invoice PDF with GSTIN + HSN + CGST/SGST |
| `supabase/functions/payment-webhook/index.ts` | Add PayU gateway support |
| Migration | Enable Realtime on invoices, trace `is_active` error |

## What I'm NOT Building
- Razorpay MCP integration (doesn't exist in connector catalog; existing direct API integration is correct)
- PhonePe payment link generation (only Razorpay Payment Links API is in use; PhonePe uses a different flow)
- Full membership auto-renewal system (the `record_payment` RPC already activates memberships when invoice is fully paid; the webhook already triggers MIPS sync — this flow is complete)

