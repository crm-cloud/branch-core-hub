## Audit Findings

### 1. Public website crash on `/`
- The live root page is currently rendering the older 3D `InclineAscent` experience, not the `PublicWebsiteV1` marketing website.
- The crash is real: browser logs show React Router `Link` is rendering outside router context:
  - `Cannot destructure property 'basename' of React2.useContext(...) as it is null`
- Root cause: `ScrollOverlay` is rendered inside React Three Fiber/Drei `<Scroll html>`. That HTML subtree is outside the normal React Router provider context, but it uses `<Link>` for Privacy / Terms / Data Deletion. This causes load-time crash.
- Secondary runtime issue also exists in the 3D landing bundle: `Cannot read properties of null (reading 'style')`, likely from Drei/HTML scroll internals during unmount/render timing.
- The safest production fix is to make `/` serve the stable public website (`PublicWebsiteV1`) and keep the 3D ascent as an optional route, not the public homepage.

### 2. Legal pages and crawler visibility
- `/privacy-policy` exists.
- `/terms` exists, but Meta commonly expects `/terms-of-service`; current route alias is missing.
- `sitemap.xml` does not list Privacy, Terms, Terms of Service, Data Deletion, or the public website route, so crawler discovery is weak.
- `robots.txt` already allows Meta/social/AI crawlers and blocks private app routes. It can be kept, with only small hardening if needed.

### 3. Instagram / WhatsApp / Messenger AI inconsistency
- WhatsApp has a large, mature AI path in `whatsapp-webhook` with:
  - context hydration,
  - lead capture JSON parsing,
  - partial lead storage,
  - lead creation,
  - handoff,
  - member tools,
  - nurture state.
- Instagram/Messenger use a separate lighter path in `meta-webhook`:
  - short generic system prompt,
  - no equivalent lead capture parser,
  - no `partial_lead_data`,
  - no `captured_lead_id`,
  - weaker member/lead detection,
  - no consistent source tagging.
- This explains why AI replies differ across channels and why Instagram DMs are stored in chat but not converted into leads.

### 4. Instagram story replies triggering AI
- Confirmed in database: an Instagram `story_reply` inbound immediately generated an AI outbound reply.
- Current logic treats story replies exactly like normal DMs.
- There is no member/known-contact guard for Instagram because `members` currently has no Instagram ID column and the member matching in `meta-webhook` only checks a non-existent/invalid `whatsapp_id` style path.

### 5. Lead nurture follow-up
- The cron job exists and is active hourly.
- But nurture only processes `whatsapp_chat_settings` records that have `partial_lead_data` or an existing lead.
- Instagram/Messenger never populate `partial_lead_data`, so they are skipped.
- WhatsApp captured leads are not always linked back through `captured_lead_id`, so some converted chats can still look incomplete to automation.
- Some old WhatsApp nurture rows have maxed retry count and pending outbound messages, which explains why follow-up appears stuck for those contacts.

## Implementation Plan

### Epic 1: Stabilize the public website
1. Change `src/App.tsx` routing:
   - `/` -> `PublicWebsiteV1`
   - `/website-v1` -> `PublicWebsiteV1`
   - `/ascent` or `/legacy-3d` -> `InclineAscent` for optional 3D showcase/testing.
2. Add route alias:
   - `/terms-of-service` -> `TermsPage`
3. Update public path list so WhatsApp/public widgets only appear on intended public routes.
4. In `ScrollOverlay.tsx`, replace React Router `<Link>` with normal `<a href="...">` because it renders inside Drei HTML and cannot depend on router context. This prevents crashes if the 3D route is still used.
5. Ensure footer legal links are visible on `PublicWebsiteV1` and point to:
   - `/privacy-policy`
   - `/terms-of-service`
   - `/data-deletion`
6. Update `public/sitemap.xml` to include:
   - `/`
   - `/privacy-policy`
   - `/terms`
   - `/terms-of-service`
   - `/data-deletion`
   - `/website-v1`

### Epic 2: Unified AI Agent across WhatsApp, Instagram, Messenger
1. Create a shared agent module inside `supabase/functions/_shared/` for:
   - loading `organization_settings.whatsapp_ai_config`,
   - building one master prompt,
   - normalizing platform labels,
   - loading conversation history,
   - hydrating lead/member context,
   - calling Lovable AI,
   - parsing `lead_captured` JSON,
   - storing partial lead data,
   - creating/updating leads,
   - triggering handoff and notifications.
2. Refactor `meta-webhook` so Instagram and Messenger use the same AI brain as WhatsApp, instead of the current lighter `triggerAiReply`.
3. Refactor `whatsapp-webhook` to call the shared helper where practical, while preserving WhatsApp-specific interactive button/list sending.
4. Make prompt behavior consistent across channels:
   - same Ananya persona,
   - same “do not share pricing/opening date” rules,
   - same lead capture requirements,
   - same concise bilingual behavior,
   - same handoff rules.
5. Ensure platform-specific delivery stays separate:
   - WhatsApp sends via WhatsApp API.
   - Instagram/Messenger send via `send-message`.
   - The AI brain and lead capture logic remain shared.

### Epic 3: Fix Instagram/Messenger lead capture
1. In `meta-webhook`, after AI response:
   - parse `lead_captured` JSON just like WhatsApp,
   - create a `leads` row with source like `instagram_ai` or `messenger_ai`,
   - use sender ID as the contact identifier when no phone is available,
   - store notes showing original platform ID,
   - update `whatsapp_chat_settings.captured_lead_id`,
   - pause bot after successful capture if configured.
2. Store partial data for Instagram/Messenger in `whatsapp_chat_settings.partial_lead_data` so nurture can continue later.
3. When Instagram profile resolution succeeds, persist `contact_name` into both the inbound message and chat setting partial data.
4. Add dedupe logic before creating a lead:
   - match by email if available,
   - match by phone if available,
   - for Instagram/Messenger, match by platform ID in notes/source metadata if needed.

### Epic 4: Stop unwanted AI replies on Instagram story replies
1. Add story-reply policy in `meta-webhook`:
   - Store story replies in CRM for visibility.
   - Do not auto-reply when the story reply has no text or is only an attachment/reaction.
   - Do not auto-reply to story mentions or outbound story events.
2. Add member/known-contact guard:
   - If the sender is already linked to a member/lead/chat with bot disabled, skip AI.
   - If sender has a recent staff/human handoff or bot paused, skip AI.
3. For real story replies with text from non-known users, optionally allow a softer lead reply, but only if configured; default should be no auto-reply for attachment-only story replies.

### Epic 5: Repair nurture automation
1. Update `lead-nurture-followup` so it handles all platforms:
   - WhatsApp: send via `send-whatsapp`.
   - Instagram/Messenger: send via `send-message` with `platform`.
2. Only nudge when:
   - bot is active,
   - last message is outbound,
   - delay/cooldown passed,
   - no captured lead exists,
   - not linked to an existing member,
   - not max retry count.
3. Fix converted chats by setting `captured_lead_id` when AI creates a lead.
4. Add clearer logs/results: skipped reason counts, nudged count by platform, send failure details.

### Epic 6: Verification checklist after implementation
1. Browser test `/`:
   - no crash,
   - `PublicWebsiteV1` loads,
   - footer legal links visible.
2. Browser/direct route test:
   - `/privacy-policy`
   - `/terms`
   - `/terms-of-service`
   - `/data-deletion`
   - `/ascent` or `/legacy-3d` no longer crashes.
3. Meta crawl readiness:
   - sitemap includes legal URLs,
   - robots allows Meta crawler,
   - legal pages publicly accessible without auth.
4. Live Meta test:
   - send fresh Instagram DM with joining question,
   - confirm inbound stored,
   - confirm AI reply uses same Ananya prompt as WhatsApp,
   - confirm partial lead data saved,
   - provide name/email/goal and confirm lead row created.
5. Story reply test:
   - reply to story with attachment/reaction only,
   - confirm it stores in CRM but does not auto-reply.
6. Nurture test:
   - invoke `lead-nurture-followup` manually,
   - confirm eligible WhatsApp/Instagram/Messenger chats are processed correctly and ineligible chats are skipped with reason.

## Files Expected to Change
- `src/App.tsx`
- `src/components/ui/ScrollOverlay.tsx`
- `src/pages/PublicWebsiteV1.tsx`
- `public/sitemap.xml`
- possibly `public/robots.txt` for final hardening only
- `supabase/functions/_shared/ai-agent.ts` or similar new shared module
- `supabase/functions/meta-webhook/index.ts`
- `supabase/functions/whatsapp-webhook/index.ts`
- `supabase/functions/lead-nurture-followup/index.ts`
- possibly one migration if we add safer metadata fields/indexes for platform identity and lead dedupe

## Security / Reliability Notes
- No credentials will be hard-coded.
- Existing `integration_settings` dispatcher pattern will be preserved.
- Edge functions will keep strict CORS and try/catch responses.
- Public pages remain unauthenticated; private app routes remain blocked from crawlers.
- If a migration is needed, it will be minimal and RLS-safe.