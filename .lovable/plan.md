## Scope

Three things on `/announcements` Live Feed + one backend fix:

1. Recipient row should show **Name + Number**, not just the digits.
2. The inline **Queued · Sent · Delivered · Read** progress pill is too plain — make it premium and on-brand.
3. Audit why the AI-generated lead nudge ("Hey Jawahar! 👋 Just checking in…") was sent **outside Meta's 24h customer-service window** (Meta error 131047 territory).

---

## 1. Live Feed — Name + Number on each row

`communication_logs` only stores `recipient` (phone/email) and an optional `member_id`. To show a friendly name without N+1 queries:

- In `LiveFeed.tsx`, after fetching the latest 200 logs, build a single batched lookup:
  - Collect distinct `member_id`s → one query against `members(id, full_name)`.
  - For rows without `member_id` and `type` ∈ {whatsapp, sms}, collect normalized phone variants (using existing `phoneVariants` helper) and look up names from `whatsapp_chat_settings.contact_name`, then `leads(full_name, phone)`, then `members(full_name, phone_number)` as fallbacks.
  - For email rows, look up `profiles(full_name, email)` / `members(email)`.
- Render row header as:
  ```
  <Name>          <Badge>WhatsApp</Badge>
  <muted>+91 94626 79897</muted>
  ```
  Falls back to just the recipient when no name is found ("Unknown · +91…").
- Pretty-print Indian numbers (`+91 94626 79897`) using a small util in `src/lib/contacts/phone.ts` (already used elsewhere — reuse if a formatter exists, otherwise add `formatIndianPhone()`).

## 2. Polish the Delivery Timeline pill (`DeliveryTimeline.tsx`)

Today it's 4 grey circles + plain labels on a thin track. Redesign while keeping the same data model:

- Wrap the track in a soft card: `rounded-2xl bg-gradient-to-br from-muted/40 via-card to-muted/20 border border-border/40 shadow-sm` (rose-tinted variant on failure stays).
- Replace the thin 0.5px line with a 2px capsule track (`bg-border/60`) and an animated gradient fill (`bg-gradient-to-r from-sky-500 via-emerald-500 to-violet-500`) that grows to the latest reached stage; animate width with `transition-all duration-700 ease-out`.
- Stage dots become 8×8 with a subtle outer glow ring on the *active* stage (`shadow-[0_0_0_6px_hsl(var(--primary)/0.12)]`) plus a slow pulse halo. Reached dots get a soft check-mark inside; unreached dots show a hollow ring (no icon).
- Labels: smaller, semibold, `text-[11px] uppercase tracking-wide`, with timestamp underneath in `tabular-nums text-[10px] text-muted-foreground/70`. Center each label under its dot.
- Failure mode: track turns rose, last dot becomes a filled `XCircle` with a gentle shake-once animation, error card below stays as-is but uses `rounded-xl shadow-sm shadow-rose-500/10`.
- Add subtle `from-card to-muted/10` background panel inside the row's expanded area so the timeline visually separates from the list.

No data/query changes — purely presentational.

## 3. 24h-window leak in `lead-nurture-followup`

**Root cause:** `supabase/functions/lead-nurture-followup/index.ts` sends nudges by calling `send-whatsapp` directly (lines ~207–214). It bypasses `dispatch-communication`, which is the only place that enforces the **24h customer-service window pre-flight guard** (see `dispatch-communication/index.ts` v1.7.0, lines 520–551). So nudges go out as freeform text even when the last *inbound* message from the lead is older than 24h, and Meta accepts them only if they happen to fall inside a still-open session — otherwise it rejects with 131047, or worse, the message is delivered as a policy-violating freeform.

**Fix:**

- In `lead-nurture-followup`, before composing the nudge, look up the most recent *inbound* `whatsapp_messages` row for `phone_number` and skip the nudge entirely if it's older than 24h **unless** an approved Meta template is configured for `re_engagement`/`lead_nurture` events.
- Resolve that template via existing `whatsapp_triggers` registry (event key `lead_nurture` — add the row if missing) → if found, route the send through `dispatch-communication` with `template_id` set so the canonical pre-flight + template path runs.
- If no template and outside window → mark `last_nurture_at` so we don't loop, log a single info row (`reason: 'outside_24h_no_template'`) and `continue`.
- Bump version comment to `v3.4.0` and update the function's purpose header.

Optional hardening (still in this task):

- Add the same pre-send 24h check to any other edge functions that call `send-whatsapp` directly. Quick `rg "functions/v1/send-whatsapp"` audit; route stragglers through `dispatch-communication`.

No DB schema change required — `whatsapp_triggers` already exists. We only insert a default `lead_nurture` row if absent.

---

## Files to change

- `src/components/communications/LiveFeed.tsx` — batched name lookup + new row layout.
- `src/components/communications/DeliveryTimeline.tsx` — visual redesign only.
- `src/lib/contacts/phone.ts` — add `formatIndianPhone()` if not present.
- `supabase/functions/lead-nurture-followup/index.ts` — 24h guard + template path.
- (Optional audit) any other edge fn calling `send-whatsapp` directly.

## Out of scope

- KPI strip, channel tabs, search bar — already look fine.
- Composer / inbox UI on the second screenshot.
- DB schema changes.
