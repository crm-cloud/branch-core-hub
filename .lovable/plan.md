

# Plan: Lead Capture Fix, GST Reports, Dynamic GST Rates & AI Chat Enhancements

## Module 1: Fix AI Lead Capture — Must Collect All Fields Before Capturing

**Problem:** The AI captures a lead immediately with just a greeting + WhatsApp profile name, skipping required fields (email, goal, etc.). The lead nurture system can only follow up with *existing* leads, but if leads are captured incomplete, there's nothing to nurture.

**Root Cause:** The system prompt tells the AI to collect fields "naturally, one at a time" but the fallback extraction (line 1282-1318) fires too early. Also, the lead nurture function only nudges leads that *already exist* — it doesn't help incomplete conversations that were never captured.

**Fix (whatsapp-webhook/index.ts):**
1. **Strengthen system prompt** — Add explicit instruction: "Do NOT output the lead_captured JSON until ALL required fields have been collected. If any field is still missing, continue asking. The minimum required fields are: full name, phone (already known), and email. Without these, the lead is useless."
2. **Fix fallback extraction threshold** — Change from requiring 2 extracted fields to requiring **name + email at minimum** (phone is already known). The fallback should only fire when `nameMatch && emailMatch` are both present.
3. **Add "incomplete lead" tracking** — When the AI has started collecting but user goes silent, store a partial record in `whatsapp_chat_settings.partial_lead_data` (JSONB) so the nurture function can reference it.
4. **Upgrade lead-nurture-followup** — Currently it only nudges existing leads. Update it to also handle chats where `partial_lead_data` exists but no lead was created yet. The nurture message should ask for the specific missing fields (e.g., "Could you share your email so we can send you our plans? 📧").

**Files:**
- `supabase/functions/whatsapp-webhook/index.ts` — System prompt + fallback logic
- `supabase/functions/lead-nurture-followup/index.ts` — Handle incomplete leads
- Migration: Add `partial_lead_data JSONB` to `whatsapp_chat_settings`

---

## Module 2: GST vs Non-GST Finance Report

**Problem:** No way to separate GST income from non-GST income in the Finance dashboard for GST return filing.

**Fix (src/pages/Finance.tsx):**
1. Add a new **"GST Report"** tab alongside existing Income/Expenses tabs
2. Query invoices with `is_gst_invoice = true` and group by GST rate to show:
   - **GST Income**: Total taxable value (subtotal), CGST collected, SGST collected, total tax, gross amount
   - **Non-GST Income**: All payments linked to non-GST invoices
   - **Summary card**: Total tax liability, profit ex-GST
3. Add **"Download GST Report"** button that exports CSV with columns: Invoice Number, Date, Customer GSTIN, Taxable Value, GST Rate, CGST, SGST, Total
4. Add date range filter (reuse existing DateRangeFilter)

**Files:**
- `src/pages/Finance.tsx` — New GST Report tab with query and table

---

## Module 3: Dynamic GST Rates in Settings

**Problem:** GST rate is hardcoded to 18% (default) in CreateInvoiceDrawer and PurchaseMembershipDrawer. India has multiple GST slabs (0%, 5%, 12%, 18%, 28%).

**Fix:**
1. **Migration**: Add `gst_rates JSONB DEFAULT '[5, 12, 18, 28]'` column to `organization_settings`
2. **New settings UI** in Organization Settings — Allow admin to configure available GST rate options (e.g., add custom rates like 6% for specific services)
3. **Update CreateInvoiceDrawer** — Replace hardcoded `gstRate` state with a Select dropdown populated from org settings' `gst_rates` array
4. **Update PurchaseMembershipDrawer** — Same dropdown approach
5. **Update membership_plans** — The `gst_rate` column on plans should also use the dynamic rates dropdown in AddPlanDrawer/EditPlanDrawer

**Files:**
- Migration: Add `gst_rates` to `organization_settings`
- `src/components/settings/OrganizationSettings.tsx` — GST rates editor
- `src/components/invoices/CreateInvoiceDrawer.tsx` — Dynamic rate selector
- `src/components/members/PurchaseMembershipDrawer.tsx` — Dynamic rate selector
- `src/components/plans/AddPlanDrawer.tsx` / `EditPlanDrawer.tsx` — Dynamic rate selector

---

## Module 4: Smarter AI Chat — Quick Reply Buttons & Nurture Training

**Problem:** The AI responds with plain text only. WhatsApp supports interactive buttons and lists for quick responses. Also, the nurture follow-up uses a hardcoded generic message instead of being configurable.

**Current state:** The `sendAiReply` function (line 1388) already parses JSON for interactive buttons and lists. The system prompt already instructs the AI to use `{"type":"interactive","buttons":[...]}` format. This is already working for lead capture questions.

**Enhancements:**
1. **Extend interactive prompt to member conversations** — Currently only lead capture gets button instructions. Add similar instructions for members: "When presenting options (e.g., available slots, facility types), use the interactive button format."
2. **Configurable nurture messages** — Add a `nurture_messages` array field to `lead_nurture_config` in the LeadNurtureSettings UI, allowing admins to write custom follow-up templates with placeholders (`{{name}}`, `{{missing_fields}}`).
3. **Nurture context awareness** — Update `lead-nurture-followup` to use the AI gateway to generate contextual follow-ups based on `partial_lead_data` instead of a static message. This makes the nurture feel like a natural continuation of the conversation.
4. **Add nurture system prompt** — In LeadNurtureSettings, add a "Nurture AI Prompt" textarea so admins can customize the tone/context of follow-up messages (e.g., mention current offers, gym USPs).

**Files:**
- `supabase/functions/whatsapp-webhook/index.ts` — Add interactive button instructions for member tools
- `supabase/functions/lead-nurture-followup/index.ts` — AI-powered contextual follow-ups
- `src/components/settings/LeadNurtureSettings.tsx` — Add custom nurture message templates and system prompt fields

---

## Summary of Files Changed

| File | Change |
|---|---|
| Migration | Add `partial_lead_data` to `whatsapp_chat_settings`, `gst_rates` to `organization_settings` |
| `supabase/functions/whatsapp-webhook/index.ts` | Fix lead capture prompt, strengthen fallback, add interactive buttons for members |
| `supabase/functions/lead-nurture-followup/index.ts` | Handle incomplete leads, AI-powered contextual nudges |
| `src/pages/Finance.tsx` | New GST Report tab with breakdown and CSV export |
| `src/components/settings/OrganizationSettings.tsx` | GST rates configuration UI |
| `src/components/settings/LeadNurtureSettings.tsx` | Custom nurture messages and AI prompt config |
| `src/components/invoices/CreateInvoiceDrawer.tsx` | Dynamic GST rate selector |
| `src/components/members/PurchaseMembershipDrawer.tsx` | Dynamic GST rate selector |
| `src/components/plans/AddPlanDrawer.tsx` | Dynamic GST rate selector |

