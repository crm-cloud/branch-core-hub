

# CRM Schema Mapping, Template UI Tabs & Auth Clarification

## Key Findings

1. **Lead capture mapping**: The `leads` table already has `budget` and `goals` columns. The webhook correctly maps these. However, fields like `fitness_goal`, `expected_start_date`, `fitness_experience`, `preferred_time` get dumped into `notes`. We need to add dedicated columns.

2. **"Missing Authorization header" is expected behavior**: The `manage-whatsapp-templates` function intentionally requires a JWT (lines 44-51). When you hit the URL directly in a browser, there's no auth token — so it returns 401. The frontend calls via `supabase.functions.invoke()` which automatically includes the auth header when logged in. **This is not a bug.** If it fails from the UI, ensure you're logged in with an owner/admin/manager role.

3. **Meta template pricing (India)**: Marketing templates cost ~₹0.77/conversation, Utility templates cost ~₹0.15/conversation, Authentication templates cost ~₹0.13/conversation. Service conversations (user-initiated within 24h window) are free. Moving broadcast/promotional templates from UTILITY to MARKETING category is actually more expensive — the current setup is already cost-optimal. The real cost saver is the WhatsApp FAB (zero-cost user-initiated conversations).

---

## Epic 1: Lead Capture Schema & Extraction Mapping

**Migration**: Add columns to `leads` table:
```sql
ALTER TABLE leads ADD COLUMN IF NOT EXISTS fitness_goal text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS expected_start_date text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS fitness_experience text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS preferred_time text;
```

**Edge function update** (`whatsapp-webhook/index.ts`, ~line 605-618): Update the lead insertion mapping to use dedicated columns instead of dumping to notes:
```typescript
const leadData = {
  phone: phoneNumber,
  source: "whatsapp_ai",
  branch_id: branchId,
  full_name: parsed.data.name || parsed.data.full_name || inboundMsg.contact_name || "WhatsApp Lead",
  email: parsed.data.email || null,
  goals: parsed.data.goal || parsed.data.fitness_goal || null,
  budget: parsed.data.budget || null,
  fitness_goal: parsed.data.fitness_goal || parsed.data.goal || null,
  expected_start_date: parsed.data.expected_start_date || parsed.data.start_date || null,
  fitness_experience: parsed.data.fitness_experience || parsed.data.experience || null,
  preferred_time: parsed.data.preferred_time || null,
  notes: `AI-captured via WhatsApp conversation`,
  status: "new",
  temperature: "warm",
  score: 50,
};
```

Also update the AI Flow Builder's target fields list to match these DB columns, and update any lead display components to show the new fields.

## Epic 2: Template Manager Tabs Refactor

**File**: `src/components/settings/TemplateManager.tsx`

Replace the current stacked Card-per-type layout (lines 324-325) with Shadcn `<Tabs>`:
- Default tab: `whatsapp`
- Three tabs: WhatsApp, SMS, Email
- Each tab renders only its filtered templates
- "Add Template" button stays in the header
- Meta submission dialog only shows in WhatsApp tab

## Epic 3: Auth Clarification & Cost Notes

**No code changes needed for auth** — the function works correctly when called from the logged-in UI via `supabase.functions.invoke()`.

**Template category guidance**: Add a helper note in the Meta submission dialog (`TemplateManager.tsx`) indicating:
- MARKETING: Promotional messages, offers, re-engagement (~₹0.77/conv in India)
- UTILITY: Transaction confirmations, account updates (~₹0.15/conv in India)
- Recommend MARKETING for broadcasts/promos, UTILITY for transactional only

---

## Files Changed

| File | Change |
|---|---|
| **Migration** | Add `fitness_goal`, `expected_start_date`, `fitness_experience`, `preferred_time` to `leads` |
| `supabase/functions/whatsapp-webhook/index.ts` | Map AI-extracted fields to dedicated columns |
| `src/components/settings/TemplateManager.tsx` | Refactor to tabbed layout + add pricing hints |

