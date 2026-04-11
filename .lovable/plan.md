

# AI Lead Capture Reliability, WhatsApp Interactive Buttons & Razorpay Payment Links

## Sprint 1: AI Lead Capture Reliability & WhatsApp Buttons

### Epic 1: Lead Insertion Reliability Fix

**File:** `supabase/functions/whatsapp-webhook/index.ts`

**Problem:** The AI sometimes generates a natural language confirmation instead of the required `{"status":"lead_captured","data":{...}}` JSON. Also, the `extractMessageContent` function does not handle WhatsApp interactive button replies (`button_reply.title`) or list replies (`list_reply.title`).

**Changes:**
1. **Strengthen system prompt** (line ~1027): Add explicit instruction: "When the user provides the LAST required piece of information, you MUST respond with ONLY the JSON object `{\"status\":\"lead_captured\",\"data\":{...}}`. No natural language before or after. Your failure to output valid JSON means the data is permanently lost."
2. **Add fallback extraction** (line ~1207): After the JSON regex match, add a secondary regex that tries to extract individual fields from natural language if JSON parse fails. If at least `name` is found, insert the lead with defaults.
3. **Fix `extractMessageContent`** (line 1493): Add handling for `message.interactive.button_reply.title` and `message.interactive.list_reply.title` so button selections are properly read and passed to AI.

### Epic 2: WhatsApp Interactive Buttons for Lead Capture

**Already partially implemented.** The system prompt already instructs the AI to output `{"type":"interactive","body":"...","buttons":["..."]}` JSON, and `sendAiReply` (line 1284) already parses this and builds Meta interactive payloads. 

**Remaining fix:**
1. **`extractMessageContent`** — Add `button_reply` and `list_reply` extraction so the AI receives the user's button selection text.
2. **`processIncomingMessages`** — Set `message_type` to `interactive` for button/list reply messages.

### Epic 3: Lead Audit Filter (Last 24h AI Attempts)

**File:** `src/pages/Leads.tsx`

**Changes:**
1. Add a new filter option "AI Capture (24h)" to the view modes.
2. Query `whatsapp_messages` where `content LIKE '%lead_captured%' OR direction = 'inbound'` joined with a NOT EXISTS on `leads` for that phone number, filtered to last 24 hours.
3. Show results in a simple table: phone, contact name, last message, timestamp, with a "Create Lead" button that opens `AddLeadDrawer` pre-filled.

---

## Sprint 2: Razorpay Payment Link API Integration

### Epic 1: `create-razorpay-link` Edge Function (NEW)

**File:** `supabase/functions/create-razorpay-link/index.ts`

**Logic:**
1. Accept `{ invoiceId, amount, branchId }` from frontend.
2. Fetch Razorpay `key_id` and `key_secret` from `integration_settings` (branch-specific then global).
3. Fetch member details (name, phone, email) via invoice → member → profile join.
4. Call `POST https://api.razorpay.com/v1/payment_links/` with:
   - `amount` in paise, `currency: "INR"`, `accept_partial: false`
   - `reference_id: invoiceId`
   - `customer: { name, contact, email }`
   - `notify: { sms: true, email: true }` (Razorpay sends SMS/Email automatically)
   - `callback_url` and `callback_method: "get"`
5. Return `{ short_url, plink_id }` and store in `payment_transactions`.

### Epic 2: UI Refactor — SendPaymentLinkDrawer

**File:** `src/components/invoices/SendPaymentLinkDrawer.tsx`

**Changes:**
1. Replace WhatsApp/Email manual buttons with primary "Generate & Send Official Payment Link" button.
2. On click: call `create-razorpay-link` edge function, show loading spinner "Generating secure link..."
3. On success: toast "Payment link sent via Razorpay SMS & Email", display `short_url` with Copy button.
4. Keep "Copy Link" and "Share via WhatsApp" as secondary actions using the Razorpay `short_url`.
5. Add fallback: if Razorpay not configured, show old manual link behavior.

### Epic 3: Payment Webhook — Handle `payment_link.paid`

**File:** `supabase/functions/payment-webhook/index.ts`

**Changes:**
1. Add handling for Razorpay `payment_link.paid` event alongside existing `payment.captured`.
2. Extract `reference_id` from `payload.payload.payment_link.entity.reference_id` (our `invoice_id`).
3. On capture: use existing `record_payment` RPC for atomic invoice update + membership activation.
4. After successful payment, check if invoice has membership items — if so, trigger `sync-to-mips` for turnstile access update.

### Epic 4: Integration Settings — Webhook Secret Field

**File:** `src/config/providerSchemas.ts`

**Already done.** The Razorpay schema already includes `webhook_secret` field (line 52). The webhook URL is already displayed via `getWebhookInfoForProvider`. No changes needed here.

---

## Files Changed

| File | Change |
|---|---|
| `supabase/functions/whatsapp-webhook/index.ts` | Fix `extractMessageContent` for button/list replies; strengthen lead capture prompt; add fallback extraction |
| `supabase/functions/create-razorpay-link/index.ts` | **NEW** — Razorpay Payment Link API integration |
| `supabase/functions/payment-webhook/index.ts` | Handle `payment_link.paid` event + MIPS sync trigger |
| `src/components/invoices/SendPaymentLinkDrawer.tsx` | Refactor to use Razorpay Payment Link API with fallback |
| `src/pages/Leads.tsx` | Add "AI Capture (24h)" audit filter view |
| `supabase/config.toml` | Add `create-razorpay-link` function config |

No new database migrations required.

