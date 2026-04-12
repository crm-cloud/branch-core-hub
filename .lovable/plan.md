

# Audit Report & Fix Plan: WhatsApp Lead Capture, Email, Invoice Sharing

## Audit Findings

### Issue 1: AI Captures Leads Without Asking Questions
**Root Cause:** The fallback extraction logic (lines 1280-1294 of whatsapp-webhook) is too aggressive. When `shouldCaptureLead` is true for non-members, the fallback triggers if `replyText.length > 20` AND either `nameMatch` or `inboundMsg.contact_name` exists. Since Meta always provides `contact_name` from WhatsApp profile ("Jack"), the fallback fires on the AI's FIRST response — before any data is collected. With just "Hi" + "I want to join", the AI replies with a welcome message (>20 chars), the contact_name "Jack" is available, and boom — lead is captured with zero questions asked.

**Fix:** Add a minimum field threshold. The fallback should only trigger if at least 2 required fields from `target_fields` are detected in the conversation, NOT just the contact name. Also add a conversation length check — require at least 3 exchanges before fallback fires.

### Issue 2: SMTP Email Not Working
**Root Cause:** The SMTP config uses port `465` (SSL/implicit TLS), but the `sendViaSMTP` function only handles STARTTLS on port `587` and plain SMTP otherwise. Port 465 requires connecting with TLS from the start (implicit TLS), not STARTTLS upgrade. The code falls through to the plain SMTP path, which attempts AUTH LOGIN without encryption on a TLS-only port — this silently fails. Additionally, `send-email` logs show zero invocations, meaning emails may never reach the edge function at all.

**Fix:** Add SSL/TLS support for port 465 using `Deno.connectTls()` instead of `Deno.connect()` + STARTTLS upgrade. This is the correct approach for Hostinger SMTP.

### Issue 3: No "Share/Email Invoice" Button in Invoice Actions
**Root Cause:** The `InvoiceShareDrawer` component exists but is NEVER imported or used anywhere. The Invoices page action dropdown only has View, Download, and Send Payment Link. The InvoiceViewDrawer has no share/email button either. The component is orphaned.

**Fix:** Add a "Share Invoice" option to the invoice action dropdown that opens `InvoiceShareDrawer`. Also add a share button inside `InvoiceViewDrawer`.

### Issue 4: All Notification Channels Disabled for Leads
**Data:** `lead_notification_rules` shows ALL toggles are `false` (sms_to_lead, whatsapp_to_lead, sms_to_admins, whatsapp_to_admins, sms_to_managers, whatsapp_to_managers). This is a configuration issue, not a code bug. No notifications fire because the admin disabled them all.

**Recommendation:** This is user configuration. No code fix needed, but we should make the disabled state more visible in the UI with a warning banner.

### Issue 5: Error Logs from System Health
**Errors found:**
1. `Invalid ID format` — Settings page querying `organization_settings` with malformed ID
2. `invoiceId, amount, and branchId are required` — Razorpay link creation missing required fields
3. `Cannot coerce the result to a single JSON object` — `notification_preferences` query returning multiple rows when `.single()` is used

---

## Implementation Plan

### Module 1: Fix Lead Capture Fallback Logic
**File:** `supabase/functions/whatsapp-webhook/index.ts` (lines 1280-1294)

- Add minimum conversation length check: require at least 4 messages (2 inbound) before fallback fires
- Require at least 2 extracted fields (not just contact_name) for fallback to trigger
- Move the `contact_name` fallback to only populate the `name` field AFTER other fields are confirmed

### Module 2: Fix SMTP Port 465 (Implicit TLS)
**File:** `supabase/functions/send-email/index.ts` (sendViaSMTP function)

- Detect port 465 and use `Deno.connectTls()` for implicit TLS connection
- Keep existing STARTTLS path for port 587
- Keep plain path for port 25

### Module 3: Wire InvoiceShareDrawer Into UI
**File:** `src/pages/Invoices.tsx`
- Import `InvoiceShareDrawer`
- Add state `shareInvoice` 
- Add "Share Invoice" menu item (with Mail icon) in the action dropdown
- Render `<InvoiceShareDrawer>` at bottom of component

**File:** `src/components/invoices/InvoiceViewDrawer.tsx`
- Add a "Share / Email" button in the actions section

### Module 4: Fix Error Log Issues
**File:** `src/components/settings/NotificationSettings.tsx`
- Fix `notification_preferences` query to use `.maybeSingle()` instead of `.single()`

**File:** `src/components/invoices/SendPaymentLinkDrawer.tsx`  
- Add validation guard before calling `create-razorpay-link` to prevent sending empty fields

### Module 5: Lead Notification Warning Banner
**File:** `src/components/settings/LeadNotificationSettings.tsx`
- Add a visible amber warning banner when all notification channels are disabled

---

## Files Changed

| File | Change |
|---|---|
| `supabase/functions/whatsapp-webhook/index.ts` | Fix aggressive fallback lead extraction |
| `supabase/functions/send-email/index.ts` | Add port 465 implicit TLS support |
| `src/pages/Invoices.tsx` | Wire InvoiceShareDrawer into action menu |
| `src/components/invoices/InvoiceViewDrawer.tsx` | Add Share button |
| `src/components/settings/NotificationSettings.tsx` | Fix `.single()` → `.maybeSingle()` |
| `src/components/invoices/SendPaymentLinkDrawer.tsx` | Add field validation |
| `src/components/settings/LeadNotificationSettings.tsx` | Add disabled-channels warning |

