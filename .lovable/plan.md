
## Why this is happening (audit findings)

I traced Bhagirath Gurjar's case end-to-end. He IS a member (`INC-26-0003`, phone stored as `7014492634`), yet the AI greeted him as a stranger and a duplicate lead `917014492634` was created on 2026-05-04. Three independent bugs combined to cause this — and the same bugs also break Instagram/Facebook recognition.

### Bug 1 — Phone variant generator misses bare 10-digit numbers
In both `whatsapp-webhook/index.ts` (line 388) and `_shared/ai-agent-brain.ts` (line 382):
```
const cleanPhone = phoneNumber.replace(/[\s\-\+]/g, "");      // "917014492634"
const variants = [cleanPhone, `+${cleanPhone}`, cleanPhone.replace(/^91/, "+91")];
// → ["917014492634", "+917014492634", "+917014492634"]
```
Bhagirath's profile stores the phone as `7014492634` (bare 10-digit). None of the three variants match. A bare 10-digit form and the `+91 70144 92634` (with space) form are never tried. We already have a canonical helper `phoneVariants()` in `src/lib/contacts/phone.ts` that produces all four variants — but it lives client-side and isn't used in edge functions.

### Bug 2 — `_shared/ai-agent-brain.ts` queries non-existent columns (Instagram / Facebook completely broken)
- Line 391: `.from("members").or("phone_number.eq.…")` — the `members` table has no `phone_number` column. The query silently returns nothing.
- Line 401-402: `.from("profiles").select("user_id, full_name").eq("phone", variant)` — the column is `id`, not `user_id`. The downstream `profile?.user_id` is always undefined.
Net effect: the unified Meta agent (used by `meta-webhook` for IG/FB/Messenger) **never** identifies a member, so even Bhagirath messaging from IG would be treated as a brand new lead.

### Bug 3 — No "is this number already a lead/member?" guard before AI captures a lead
`whatsapp-webhook/index.ts` calls `hydrateContactContext` which sets `isMember=true` only when both phone-lookup steps succeed. When Bug 1 makes them fail, the agent enters lead-capture mode and the captured-lead INSERT (line 1437) writes a fresh row regardless of whether a member or another lead already exists for that phone. There is no `ON CONFLICT` guard and no "is this phone a member?" recheck just before INSERT.

### Bug 4 — Meta template submission attaches sample URLs in the wrong field
`error_logs` shows ~14 rejections in the last 48h: *"Templates with IMAGE/DOCUMENT header type need an example/sample"*. Root cause in `supabase/functions/manage-whatsapp-templates/index.ts` line 348:
```
example: { header_handle: [header_sample_url] }   // expects a Meta media handle (from /uploads)
```
Meta's `header_handle` MUST be a handle obtained from the resumable-upload `/uploads` endpoint, NOT a `https://placehold.co/...` public URL. AI-generated templates with image/document/video headers get auto-rejected. The previous "MIME error" the user mentioned is this rejection chain (the AI email generator itself is fine).

### Bug 5 — Email AI generator returns `body_html` only when channel='email' but the same `propose_templates` schema marks `subject`/`body_html` as required for all channels in `ai-generate-whatsapp-templates/index.ts` (line 81-86) — already correct, no change needed. Audited and confirmed.

---

## What to build

### A. Shared phone helper for edge functions (kills Bug 1 & enables Bug 3 fix)
Create `supabase/functions/_shared/phone.ts` mirroring `src/lib/contacts/phone.ts` exactly:
- `normalizePhone(input)` → e.g. `+917014492634`
- `phoneVariants(input)` → returns the full set: `+917014492634`, `917014492634`, `+917014492634`, `7014492634` (last-10), plus the original raw form. De-duped.

Replace the inline 3-variant arrays in:
- `supabase/functions/whatsapp-webhook/index.ts` line 388-389 (member lookup) and line 524 (lead lookup) — switch `.eq()` to `.in('phone', variants)`.
- `supabase/functions/_shared/ai-agent-brain.ts` line 382-383 — same.

### B. Fix the broken column references in `_shared/ai-agent-brain.ts` (Bug 2)
- Drop the `.from("members").or("phone_number.eq.…")` block entirely (the column doesn't exist).
- Change `.from("profiles").select("user_id, full_name")` to `select("id, full_name")` and `.eq("user_id", profile.user_id)` to `.eq("user_id", profile.id)`.
- Result: Instagram/Facebook/Messenger now correctly recognise members.

### C. Hard guard against duplicate lead capture (Bug 3)
In `whatsapp-webhook/index.ts` just before the lead INSERT around line 1437, and in `_shared/ai-agent-brain.ts` in `tryParseAndCaptureLead`:
1. Re-run `phoneVariants(phoneNumber)` and re-check `profiles → members` for an active member. If found, **skip the lead INSERT**, log `"skipped_duplicate_member"`, and have the AI send a member-aware acknowledgement instead.
2. Re-check `leads.phone IN variants`. If a lead already exists, **UPDATE** it (merge the new fields, bump `last_contacted_at`) rather than INSERT a new row.
3. Backfill the existing duplicate: a one-time SQL migration that:
   - Deletes lead `bb5c0647-f078-4477-a7fb-773bd703b1cc` (Bhagirath's wrong duplicate).
   - Adds a partial unique index `leads_phone_active_uidx` on `(branch_id, phone)` where `status NOT IN ('converted','lost','disqualified')` to make accidental duplicates impossible at the DB level going forward.

### D. Member-first AI greeting (training)
Update both system prompts (`whatsapp-webhook` line 1062-area and `_shared/ai-agent-brain.ts` line 122-area):
- Insert a hard rule at the top: *"If `Context: Speaking to <name>, an Active Member` is present, GREET BY NAME AND MEMBER CODE. Never ask for name/email/goal/budget. Never run lead-capture JSON. Use member tools for any account questions. Politely note that the gym is in pre-opening if they ask about visiting."*
- Apply the same rule for IG/FB by using the unified brain after Bug 2 is fixed.

### E. Stop the Meta "Missing sample" rejections (Bug 4)
In `supabase/functions/manage-whatsapp-templates/index.ts` line 342-350:
- If `header_type` is image/document/video AND `header_sample_url` is NOT a Meta upload handle (i.e. it's an http URL), do ONE of these:
  - **Preferred**: Call Meta's resumable upload (`POST /{app-id}/uploads` → `POST {upload-session-id}` with the bytes) to obtain a real handle, then use that handle in `example.header_handle`.
  - **Fallback**: If upload fails or the URL is a placeholder (`placehold.co`), coerce the template to `header_type='none'` and prepend the URL/link into the body (matching the dispatcher's existing `{{document_link}}` pattern). Log a warning.
- Add a `META_APP_ID` env-var check; if missing, take the fallback path.

### F. Tighten AI template generator (preventive)
In `ai-generate-whatsapp-templates/index.ts`:
- Strip the `https://placehold.co/...` default sample URL when the channel is whatsapp — replacing it with a clear "must upload sample first" placeholder is misleading. Instead emit `header_type='none'` with a `{{image_link}}` body variable for marketing/event templates that need media. Send-time the dispatcher injects the actual uploaded image (same pattern already used for documents).
- Extend `DOCUMENT_EVENTS` if any new transactional events appear (audit `src/lib/templates/systemEvents.ts` for events flagged `document: true`).

### G. Audit & sync templates ↔ events
- Run a one-shot script (read-only `supabase--read_query`) that diffs `systemEvents.ts` against existing rows in `whatsapp_templates`, `sms_templates`, `email_templates` per branch and reports missing events. Used to pre-load the AI Generate Drawer's "missing events" default selection — it already does this; we'll just verify.

### H. Verify nothing else writes leads behind our back
Grep for `from('leads').insert` across `supabase/functions/**` — confirm only `whatsapp-webhook`, `_shared/ai-agent-brain.ts`, `meta-webhook`, `capture-lead`, `webhook-lead-capture`, `notify-lead-created` touch the table, and apply the same "member-first guard + variant-aware match" to each.

---

## Files to change

- `supabase/functions/_shared/phone.ts` — **new**
- `supabase/functions/whatsapp-webhook/index.ts` — variants, member-first guard, prompt update
- `supabase/functions/_shared/ai-agent-brain.ts` — variants, fix column refs, prompt update, dedupe guard
- `supabase/functions/meta-webhook/index.ts` — pass `phone` and use the unified brain after fixes
- `supabase/functions/capture-lead/index.ts`, `webhook-lead-capture/index.ts` — apply variant-aware dedupe
- `supabase/functions/manage-whatsapp-templates/index.ts` — Meta upload-handle flow + fallback
- `supabase/functions/ai-generate-whatsapp-templates/index.ts` — remove placeholder media URL default
- New migration: delete duplicate lead + add partial unique index on `leads(branch_id, phone)`
- Memory: update `whatsapp-crm-system-v25-0` and `whatsapp-transactional-ai-agent` notes with the variant + dedupe contract

## Acceptance test (manual)

1. From Bhagirath's WhatsApp number, send "Hi" → AI responds "Hi Bhagirath! Your INC-26-0003 plan is active for X days." No new lead row.
2. From the same number on Instagram DM (when IG connected) → same recognition.
3. AI Generate WhatsApp Templates → submit one with image header → Meta returns `id` (no "Missing sample" error).
4. `SELECT count(*) FROM leads WHERE phone IN ('7014492634','917014492634','+917014492634')` → 0 (after cleanup).
