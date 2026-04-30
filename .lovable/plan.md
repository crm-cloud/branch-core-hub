## Audit Findings (what already exists)

Good news — a large portion of this Epic is already shipped. We will **build on existing infra**, not duplicate it.

| Feature | Status |
|---|---|
| Per-contact `bot_active` (in `whatsapp_chat_settings`) | Done |
| Internal notes (`is_internal_note` column + yellow-style render) | Done |
| Realtime channel + auto-scroll on new messages | Done |
| "Pause AI" toggle in chat header | Done |
| AI memory hydration from `whatsapp_messages` (last 10) | Done |
| Context Panel scaffold (right rail, profile + stats) | Done |
| `send-broadcast` edge function (provider-agnostic) | Done |

**Real gaps** = AI Handoff tool-call, Campaigns UI/page/sidebar entry, Context Panel enrichment (membership / MIPS / quick-action insert), and adding `bot_active` to `leads`/`members` for cross-channel persistence.

---

## Epic 1 — AI Handoff Tool & Memory Persistence

**Schema**
- Add `bot_active boolean DEFAULT true` to `public.leads` and `public.members` (separate from per-contact override in `whatsapp_chat_settings` — these become the entity-level source of truth).
- Trigger: when `whatsapp_chat_settings.bot_active` flips, mirror into linked `members.bot_active` / `leads.bot_active` (best-effort by `phone_number`).

**`supabase/functions/ai-auto-reply/index.ts`**
- Memory: already pulls last 10 from `whatsapp_messages`. Extend to also resolve the linked member/lead and inject a **profile block** (name, status, membership end date, last attendance) into the system prompt.
- Add `tools: [trigger_human_handoff]` and `tool_choice: 'auto'` on the gateway call.
  - Tool params: `{ reason: string, urgency: 'low'|'medium'|'high' }`
  - On tool call: service-role update `whatsapp_chat_settings.bot_active = false` for that phone, mirror to `leads/members`, insert into `notifications` for staff (role='manager','staff'), and return `{ handoff: true, reason }` to caller.
- Prompt instructs the model to call the tool when user is frustrated, asks for human, asks pricing/refund/medical, or fails twice on the same intent.

**Migrations**
- `ALTER TABLE leads ADD COLUMN bot_active boolean NOT NULL DEFAULT true;`
- `ALTER TABLE members ADD COLUMN bot_active boolean NOT NULL DEFAULT true;`
- New SECURITY DEFINER function `set_handoff(_phone text, _reason text)` used by the edge function for atomic flip + notification insert.

---

## Epic 2 — Real-Time Inbox (verification + small additions)

Most already implemented. Additions only:
- Confirm realtime subscription also covers `whatsapp_chat_settings` UPDATE so the **Pause AI** switch in another tab/device reflects instantly.
- Add a small **"AI paused — handoff reason"** banner in chat header sourced from the latest `notifications.metadata.reason` for that phone.
- No duplicate work on internal notes / send button toggle (already present).

---

## Epic 3 — Marketing & Campaigns Page

**Sidebar**
- `src/config/menu.ts`: add **Marketing & Campaigns** entry (icon: `Megaphone`) above existing CRM block, RBAC: owner/admin/manager.

**New page** `src/pages/Campaigns.tsx` + route in `src/App.tsx` at `/campaigns`.
- Vuexy card list of past campaigns + "New Campaign" button (opens right-side **Sheet** wizard — never a Dialog, per project rule).

**Database (new tables)**
- `campaigns (id, branch_id, name, channel, audience_filter jsonb, message text, subject text, trigger_type ['send_now'|'automated'], status, created_by, created_at, sent_at, recipients_count, success_count)`
- `campaign_runs (id, campaign_id, recipient_id, recipient_type, channel, status, error, sent_at)`
- RLS: staff/manager/admin/owner can manage within their branch; service role for edge function inserts.

**Wizard (3 steps in a Sheet)**
1. **Audience** — query builder filters: status (Active/Lead/Expired), `last_attendance` date range, `goal` (from `members.fitness_goal`), branch. Live count via `useQuery` re-running on filter change against members + leads.
2. **Message** — channel chips (WhatsApp / Email / SMS), textarea with chip-insertable variables `{{first_name}}`, `{{membership_end}}`, `{{branch_name}}`. Email shows subject field.
3. **Trigger** — radio: *Send Now* (calls `send-broadcast` with the resolved audience) or *Save as Automated Rule* (persists with `status='scheduled'`, future cron will pick up).

**Reuses** existing `send-broadcast` function — just passes the resolved `audience` array. No new send pipeline.

---

## Epic 4 — Omnichannel Context Panel Enrichment

In `src/pages/WhatsAppChat.tsx` Context Panel block (line 1348+), add three new cards above the existing "Stats" card, gated on `selectedContact.member_id`:

1. **Membership card** — fetch active row from `memberships` (plan name, end_date, days remaining, color-coded badge: green >30d, amber 7-30d, red <7d/expired).
2. **Last Attendance card** — `member_attendance` MAX(checked_in_at) for the member; show relative time + "X days since last visit".
3. **Quick Actions** (replaces nothing — adds two buttons):
   - **Send Payment Link** → opens existing `create-razorpay-link` modal (or for leads, calls function and inserts `Pay here: <url>` into the message input).
   - **Book PT Session** → inserts `Hi {{name}}, ready to book your next PT? Tap: <baseUrl>/pt-booking?member=<id>` into the input box (does not auto-send).

Implementation: a small `useQuery` per card keyed on `member_id`; data flows into the input via existing `setMessageInput` setter.

---

## Technical Details

**Files to create**
- `src/pages/Campaigns.tsx`
- `src/components/campaigns/CampaignWizard.tsx` (3-step Sheet)
- `src/components/campaigns/AudienceBuilder.tsx`
- `src/services/campaignService.ts`
- `src/components/communications/ContextMembershipCard.tsx`
- `src/components/communications/ContextAttendanceCard.tsx`
- 2 migrations (bot_active columns + handoff RPC; campaigns tables + RLS)

**Files to edit**
- `supabase/functions/ai-auto-reply/index.ts` — add tool definition, profile injection, handoff dispatch
- `src/pages/WhatsAppChat.tsx` — enrich Context Panel, add handoff-reason banner, ensure realtime covers `whatsapp_chat_settings`
- `src/config/menu.ts` — Marketing entry
- `src/App.tsx` — `/campaigns` route

**Out of scope (already done — will not redo)**
- Internal note send toggle, yellow note rendering, realtime auto-scroll, Pause-AI switch UI, AI memory base hydration, broadcast sending pipeline.

---

## Acceptance

- AI auto-reply that detects "I want to talk to someone" automatically pauses bot and pings staff via notification bell.
- Marketing page reachable from sidebar; wizard sends a real broadcast and persists campaign row.
- Selecting a member chat shows their plan expiry + last MIPS check-in + working "Send Payment Link" / "Book PT" inserts.
- `leads.bot_active` and `members.bot_active` exist and stay in sync with chat-level overrides.

Approve to implement.