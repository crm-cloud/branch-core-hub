
# Audit + fix plan

## What I found
- The raw JSON leak is real. In `supabase/functions/whatsapp-webhook/index.ts`, the AI is told to return pure JSON for interactive replies, but `sendAiReply()` only parses replies that are exactly JSON. In your example the model returned normal text plus a fenced JSON block, so the parser missed it and the JSON was stored/sent as plain text.
- Your live WhatsApp AI “brain” is already `whatsapp-webhook`, not `ai-auto-reply`. `ai-auto-reply` is only the manual staff suggestion helper used from `WhatsAppChat.tsx`, so it is not the blocker here.
- Lead nurture likely is not running automatically. The `lead-nurture-followup` function exists, but I could not find a scheduler/invoker path for it in the repo. So “more than 4 hours” can still mean “nothing ever executed”.
- Lead capture is still inconsistent: the UI allows target fields without email, while the backend prompt later says email is mandatory. That mismatch can create incomplete or confusing flows.
- The current lead-capture behavior is too aggressive and too gated: it keeps pushing “registration” instead of first answering simple questions like location and fees.
- Dynamic GST rates already exist, but they are placed inside `OrganizationSettings`; HSN/HSN-SAC support is missing from schema/UI/export.
- Logo upload is using the `avatars` bucket with a path like `org-logo-...`; the current storage policy only allows uploads inside a user-id folder, so the RLS error is expected.
- System Health already has bulk buttons, but `error_logs` has no DELETE policy, so “Clear Resolved” cannot work. “Resolve All Open” also needs stronger backend feedback and real log triage.

## Implementation plan

### 1) Fix WhatsApp reply formatting so users never see raw JSON
- Harden `whatsapp-webhook` reply handling to:
  - strip markdown fences,
  - extract interactive JSON even if the model wraps it in prose,
  - send/store a clean display message,
  - keep interactive payload separate from human-readable content.
- Tighten the AI prompt so it does not mix prose and JSON in the same reply.
- Add recovery logic for free-text replies like “ok” / “ok maam” after button prompts, so the bot rephrases clearly instead of looping the same question.

### 2) Rework lead capture so it answers first, qualifies second
- Update the WhatsApp AI system prompt so the bot:
  - answers direct questions first (location, timings, pricing context),
  - then collects lead details naturally,
  - stops gatekeeping every answer behind “registration”.
- Make required lead fields consistent everywhere:
  - full name,
  - phone (already known),
  - email,
  - at least one additional qualifier.
- Update `AIFlowBuilderSettings` so required fields are locked in the UI instead of optional.
- Save partial lead progress from the conversation state itself, not only from regex over AI-generated replies.

### 3) Make lead nurture actually run and make it visible
- Wire `lead-nurture-followup` into a real scheduled execution path.
- Add proper cooldown logic using:
  - last outbound AI question,
  - delay threshold,
  - max retries,
  - last nurture timestamp.
- Improve follow-up generation so it asks for the exact missing field.
- Add observability in the AI Agent Hub:
  - last nurture run,
  - eligible stale chats,
  - last nudge time,
  - manual “Run now” test action.

### 4) Move GST/HSN into proper tax settings
- Move GST slab management out of `OrganizationSettings` into a dedicated tax/settings area.
- Keep the existing dynamic GST rates, but present them in a cleaner finance/tax settings UI.
- Add HSN/HSN-SAC support:
  - configurable code catalog/defaults,
  - saved code on invoice items,
  - defaults on memberships/products where needed.
- Update GST report/export so HSN appears in downloaded output.

### 5) Fix organization logo upload correctly
- Stop using the `avatars` bucket for org branding.
- Create a dedicated organization-branding bucket/policies for staff/admin uploads.
- Store logos with branch-safe paths.
- Harden `OrganizationSettings` for multi-branch “all branches” state so it does not rely on `.maybeSingle()` across multiple rows.

### 6) Repair System Health actions and clear the current backlog
- First audit the current open `error_logs` records so fixes target the real 25 errors, not guesses.
- Add a reliable bulk-action path for:
  - resolve all open,
  - clear resolved.
- Prefer secured backend bulk actions / proper RLS support so the buttons are reliable.
- Fix the likely recurring root causes first:
  - organization settings multi-row/single-row issues,
  - logo upload/storage RLS failures,
  - remaining payment/integration validation issues,
  - any notification/settings query errors still showing in logs.

## Files likely involved
- `supabase/functions/whatsapp-webhook/index.ts`
- `supabase/functions/lead-nurture-followup/index.ts`
- `src/components/settings/AIFlowBuilderSettings.tsx`
- `src/components/settings/LeadNurtureSettings.tsx`
- `src/components/settings/WhatsAppAISettings.tsx`
- `src/components/settings/AIAgentControlCenter.tsx`
- `src/components/settings/OrganizationSettings.tsx`
- `src/pages/Settings.tsx`
- `src/pages/Finance.tsx`
- `src/components/invoices/CreateInvoiceDrawer.tsx`
- `src/components/members/PurchaseMembershipDrawer.tsx`
- `src/pages/SystemHealth.tsx`
- migration(s) for branding storage, HSN support, and error-log bulk actions/RLS

## Technical notes
- I will not rebuild the AI tool registry from scratch; the live tool-calling layer already exists in `whatsapp-webhook`.
- I will refine the existing GST system rather than replace it; the main gap is HSN support and better settings placement.
- The nurture issue looks architectural, not cosmetic: the function exists, but the repo does not show a reliable automatic runner for it.
