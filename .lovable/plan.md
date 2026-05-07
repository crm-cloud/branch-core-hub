# Audit & Fix Plan — Communications, Onboarding, AI

Six independent issues. Each is a small, targeted fix — no business-logic rewrites.

---

## 1. Payment-overdue WhatsApp message is a dumb plain-text line

**Where:** `supabase/functions/send-reminders/index.ts` — section "1. Payment reminders".

**Today:** Hard-codes `"Hi <name>, your payment is <state>. Open your invoices in the app to pay."` — no amount, no Razorpay link. The WhatsApp send also fails because no approved utility template is used (free-form WA outside 24h window is blocked).

**Fix:**
- Resolve the linked invoice (`reminder.invoice_id`) and pull `total_amount`, `amount_paid`, `pending_dues = total - paid`, `due_date`, `invoice_number`.
- If invoice has no live Razorpay short link, call `create-razorpay-link` edge fn to mint one and persist on the invoice row (skip if already minted & not expired).
- Switch to dispatch-communication using the canonical `payment_overdue` / `payment_due_soon` event so it picks the approved WhatsApp template + variables (`{{member_name}}`, `{{invoice_number}}`, `{{pending_amount}}`, `{{due_date}}`, `{{payment_link}}`). For email we send subject + HTML with the same variables; for SMS we keep DLT-approved short body with `{{payment_link}}`.
- If the relevant template is missing, surface a one-line warning in `notifications` for owner/admin instead of silently failing.

---

## 2. OTP WhatsApp not arriving at `/register` final step

**Where:** `supabase/functions/register-member/index.ts` send_otp branch.

**Root cause:** It calls `dispatch-communication` with `category: "transactional"` and a free-form body, but Meta blocks free-form WA to a phone outside the 24-hour customer-service window. The "Auth OTP" template (`otp_template`) we created earlier is not being invoked.

**Fix:**
- Replace the free-form `payload.body` with a template invocation: `event: 'otp_verification'` + `variables: { code }` (and let dispatcher resolve the AUTHENTICATION template with COPY_CODE button).
- Also send the same OTP via email when the request body includes `email` (optional second channel — WA stays primary). Add to PublicRegistration `verifyForm` so it passes `email` along on resend.
- Surface dispatcher errors back to the client (currently swallowed) so the UI can show "OTP send failed — retry".

---

## 3. Capture-Lead has no retry / nurture for stranger inbound

**Where:** AI Inbox shows numbers like `+91 70234 29039` ("Unknown / WhatsApp") with one inbound message and no follow-up.

**Today:** `lead-nurture-followup` only acts on chats with `partial_lead_data` OR an existing lead row. A bare inbound (just "Hi") never creates either, so it sits forever.

**Fix:**
- In `meta-webhook` (and WA inbound path) when a new unknown contact sends a message and no lead/profile match exists, auto-insert a minimal `leads` row (`source='whatsapp_inbound'`, `status='new'`, branch = AI agent default branch) so nurture eligibility kicks in.
- In `lead-nurture-followup`, allow nurture when `lead.status='new'` even without `partial_lead_data` — drop the "skip if nothing to nurture" guard for inbound-originated leads.
- Confirm pg_cron schedule `lead-nurture-followup` is enabled (verify in DB).

---

## 4. Instagram contact shows raw phone-like ID, no avatar/name

**Where:** Inbox header & list — `+1466606398344744` etc.

**Today:** `meta-webhook` already requests `name,username,profile_pic_url` from Graph API but stores result in `whatsapp_chats.contact_name` only when the Graph call succeeds. If perms are missing we keep the raw IGSID. UI never reads `profile_pic_url`.

**Fix:**
- Add `contact_avatar_url` column to `whatsapp_chats` (migration). Persist `profile_pic_url` from Graph in the same upsert.
- Inbox list + header: when `platform='instagram'`, prefer `contact_name → username → "Instagram User"` and never show the raw 17-digit IGSID. Show `contact_avatar_url` in the avatar circle (fallback to letter).
- Same treatment for WhatsApp contacts that have a `profile.full_name` linked by phone.

**Also issue 4 part 2 — "AI not following up after 'Hello'":** addressed in fix #3 above (the IG `+1466…` chat is exactly that case).

---

## 5. `/register` page UI/UX redesign — width mismatch, banner clutter

**Where:** `src/pages/PublicRegistration.tsx` + `src/components/registration/RegistrationHero.tsx`.

**Issues observed in the screenshot:**
- Right form column starts above the hero image top edge, leaving a teal strip.
- Left hero stacks 4 banners (Welcome / quote / 3 trust pills / footer) → cluttered.
- Right side card lacks vertical rhythm; "Continue" CTA is small.

**Redesign (presentation only, no logic change):**
- Layout: `grid lg:grid-cols-2 min-h-[100dvh]` — true 50/50 split. Hero image fixed height = `100dvh` with `sticky top-0` so it stays on screen as the right side scrolls.
- Hero: replace 3 stacked badges + rotating quote with a single calmer composition — brand mark top-left, headline + 1-line subcopy centered, ONE rotating testimonial pinned bottom. Remove the "5,000+ members / 3 branches / Bank-grade security" pill row (move to a thin footer strip below the form on mobile only).
- Right column: add a sticky top bar showing brand mark + step number (mobile) so user always knows progress. Increase form card padding, larger inputs (`h-12`), bigger Continue button (`h-12 w-full`), softer card shadow `shadow-2xl shadow-indigo-500/10`.
- Mobile (≤lg): hero collapses into a 180px gradient header strip with the brand mark and step pill — no horizontal scroll at 375px.
- Replace the cinematic photo with a generated cleaner athletic shot (cooler, less text overlay) so badges read naturally.

---

## 6. "Warm Follow-Up Needed" notification — what should it actually do?

**Where:** `send-reminders/index.ts` step 8 + `notifications` table renders the card in NotificationBell.

**Today:** Just shows a static message. No action.

**Proposed plan (recommend & implement):**
- Make the notification actionable: clicking opens `/leads?focus=member:<id>` deep link with a side-drawer "Retention Action" containing: member profile snapshot, last visit, nudge history, and 3 quick-action buttons:
  - **Call now** (`tel:` link, logs a call attempt to `member_activities`).
  - **Send WA nudge** (uses `retention_nudge_t3` template via dispatch).
  - **Assign to staff** (creates a `tasks` row with `category='retention'`, due in 24h).
- Auto-bump `retention_nudge_logs.stage_level` when a manual nudge is sent so the `0/3` counter is honest.
- Add a setting in **Automation Brain** → "Retention Follow-Up" rule (cron tick already exists) so admin can toggle frequency / minimum days absent / max nudges per member per month.

---

## 7. AI email template generator returns "edge error"

**Where:** `supabase/functions/ai-generate-whatsapp-templates/index.ts` (handles email channel too).

**Likely cause:** When `channel='email'`, the tool schema requires `subject` and `body_html` in `required`, but `propose_templates` is called with `additionalProperties: false` and the model occasionally returns `header_sample_url` for events flagged DOCUMENT — then we delete it post-hoc but JSON parse already happened. The actual failure usually comes from `body_html` exceeding the 8K token completion budget for Gemini Pro and being truncated → JSON parse fails → "Bad AI JSON".

**Fix:**
- Switch email channel to `model: 'google/gemini-2.5-flash'` AND chunk requests to **max 5 events per call** (frontend already loops); add a server-side guard to slice if more sent.
- Wrap `JSON.parse` in a tolerant parser that retries with a `repair_json` step (strip trailing commas, close braces) before bailing.
- On parse failure, save the AI raw output to `templates` table as `meta_template_status='DRAFT'` with the `body_html` we did manage to extract, so the user can edit + retry — same draft contract we set for WhatsApp.
- Surface a clear toast: "Email template saved as draft — open Templates → Email to review and finalise".
- Add `LOVABLE_API_KEY` presence check + retry-once on 502.

---

## Implementation order
1. Migration: `whatsapp_chats.contact_avatar_url`, retention rule rows.
2. Edge fns: `send-reminders` (payment), `register-member` (OTP), `lead-nurture-followup` + `meta-webhook` (auto-lead + avatar), `ai-generate-whatsapp-templates` (email parse).
3. Frontend: Inbox avatar/name fix, `/register` redesign (hero + form card), notification CTA drawer.
4. Verify: trigger one payment reminder, send OTP from /register, generate one email template, send "hi" from a fresh number.

## Out of scope
- Custom subdomain `api.theincline.in` (separate DNS/CNAME work, requires Supabase Pro custom domain — already discussed).
- FlutterFlow connection guide (no code change needed).
