

# Fix Build Errors + Multi-Section Audit Plan

## Priority 0: Fix Build Error (BLOCKING)

**File**: `supabase/functions/contract-signing/index.ts` lines 184-215

The Supabase query uses FK joins `employees(...)` and `trainers(...)` which return **arrays**, but the code accesses them as single objects. Fix by accessing `[0]`:

```typescript
// Line 184: query already correct
// Lines 208-215: fix access pattern
const emp = Array.isArray(contract.employees) ? contract.employees[0] : contract.employees;
const trn = Array.isArray(contract.trainers) ? contract.trainers[0] : contract.trainers;

let resolvedName = emp?.profiles?.full_name ?? null;
let resolvedCode = emp?.employee_code ?? null;

if (!resolvedName && trn?.user_id) {
  // ... use trn.user_id
}
```

---

## Section 1: HRM Contract Templates

**Current state**: The template function `getEmploymentAgreementTemplate()` in `CreateContractDrawer.tsx` already generates role-specific content (trainer/staff/manager checkboxes, trainer PT commission section). The role dropdown already triggers template regeneration (line 511-524). This is **already working** — the template content DOES change when role changes.

**What's actually needed**: The user wants templates stored in a DB table for admin editability. Plan:
- DB migration: create `contract_templates` table with `id`, `role` (text), `content`, `created_at`
- Seed 3 templates based on the existing `getEmploymentAgreementTemplate()` function output
- On role change, fetch from `contract_templates` instead of using the hardcoded function
- Make Commission % field required + visible only for trainer role

---

## Section 2: Logo Upload RLS Fix

**Current state**: `OrganizationSettings.tsx` uploads to `avatars` bucket (line 80) and upserts `organization_settings` table. The `organization_settings` table already has an RLS policy `"Admin can manage org settings"` using `has_any_role(auth.uid(), ARRAY['owner','admin'])` for ALL operations with WITH CHECK.

**Diagnosis**: The RLS policy exists and looks correct. The issue is likely that the INSERT path (line 63-66) doesn't include all required fields or the `WITH CHECK` clause fails. Need to verify the exact error. The upload itself goes to the `avatars` bucket which is public, so that should work.

**Fix**: Ensure the `organization_settings` FOR ALL policy has both USING and WITH CHECK that match. Current migration shows `WITH CHECK(...)` — verify it allows INSERT by checking the exact SQL.

---

## Section 3: WhatsApp Provider-Specific Forms

**Current state**: `IntegrationSettings.tsx` has 4 WhatsApp providers (wati, interakt, gupshup, custom). The config form likely shows generic fields.

**Plan**: Add provider-specific field configurations + Meta Cloud API as a 5th provider. Update the config sheet to render different fields based on selected provider.

---

## Section 4: SMS Provider-Specific Forms

**Current state**: 4 SMS providers with generic fields. Need provider-specific forms for RoundSMS, MSG91, TextLocal, Twilio, Fast2SMS with DLT fields for Indian providers.

**Plan**: Add RoundSMS and Fast2SMS to SMS providers list. Create dynamic field rendering per provider. Add DLT fields section for Indian providers.

---

## Section 5: RoundSMS Edge Function

**Plan**: Create `send-sms` edge function that constructs the RoundSMS HTTP GET URL format. Create `sms_logs` table via migration. Add balance check endpoint.

---

## Section 6: WhatsApp Chat

**Current state**: `WhatsAppChat.tsx` (686 lines) already has a full chat UI with contacts, messages, realtime subscriptions. The `whatsapp_messages` table exists. Need to verify the queries are working and the realtime subscription is properly configured.

---

## Section 7: Edge Function Deployment

Edge functions auto-deploy in Lovable Cloud. No "Redeploy" button needed. Will verify CORS headers on all edge functions.

---

## Implementation Order

| Step | Description | Files |
|---|---|---|
| 1 | **Fix build error** in contract-signing | `supabase/functions/contract-signing/index.ts` |
| 2 | Fix org settings RLS for logo upload | DB migration |
| 3 | Contract templates table + seeding | DB migration + `CreateContractDrawer.tsx` |
| 4 | SMS provider-specific forms + RoundSMS | `IntegrationSettings.tsx` + new edge function |
| 5 | WhatsApp provider forms + Meta Cloud API | `IntegrationSettings.tsx` |
| 6 | WhatsApp chat debugging | `WhatsAppChat.tsx` |
| 7 | CORS audit on all edge functions | Multiple edge functions |

## Scope Note

This is a very large request spanning 7 sections. I'll implement them in priority order, starting with the blocking build error, then the RLS fix, then the contract templates, then the integration forms. The SMS/WhatsApp edge functions for external providers (RoundSMS, Wati, Gupshup) require API credentials from the user — I'll create the infrastructure and prompt for secrets when needed.

