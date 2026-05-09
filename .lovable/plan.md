## Audit findings

### 1. Why error `131047` keeps appearing

Meta returns **131047 — "Re-engagement message"** when you send a non-template (freeform) message to a user whose 24-hour customer service window is closed. Per Meta policy:
- Inside 24h of an inbound message → freeform allowed (text, document, image).
- Outside 24h → **only an approved template** can be sent.

In the codebase, `dispatch-communication` (channel = whatsapp) only sends a Meta **template** when the caller passes `template_id` AND the row in `templates` has a non-null `meta_template_name`. Otherwise it sends raw text / a document with caption — which Meta rejects with 131047 once the session expires.

Today the following call sites send freeform / document-with-caption with **no `template_id`** (so they always become "service messages"):

- `src/utils/sendPlanToMember.ts` — workout / diet PDF delivery (this is the exact "Hi RYAN LEKHARI, here is your new workout plan…" message in the screenshot).
- `src/utils/whatsappDocumentSender.ts` — generic document send (POS receipts, scan reports, etc., when used directly).
- A few transactional helpers that pass `payload.body` only.

The DB confirms it:
- `templates` rows for `workout_plan_ready`, `diet_plan_ready`, `plan_assigned_workout`, `plan_assigned_diet` all exist but have `meta_template_name = NULL` and `meta_template_status = 'pending'` → never registered with Meta, so dispatcher silently falls back to a freeform document message.
- Per project memory ("Templates Hub" / `ai-generate-whatsapp-templates v2.1.0`), document events MUST use `header_type = 'none'` + `{{document_link}}` body variable. Current rows use `header_type = 'document'`, which Meta rejects on submission, which is why nothing got approved.

### 2. Delivery timeline UI (Queued / Sent / Delivered)

`src/components/communications/DeliveryTimeline.tsx` currently:
- Uses a connector with `top-3.5 left-1/2 right-0 width: calc(100% - 0px)` — the bar overshoots, sits behind the next dot, and looks misaligned (visible in the screenshot).
- Only colorises the bar when the **next** stage is reached, which means the bar between Sent and Delivered stays grey even when Sent succeeded.
- Does not apply any visual treatment for `failed`, so the user sees grey "Queued / Sent / Delivered" + a separate red error block (also visible in the screenshot).
- Renders `max-w-sm mx-auto` inside a wide row, so on wide screens it floats with awkward whitespace.

## Plan

### A. Stop 131047 — always send via approved template outside 24h

1. **Add canonical document-template events** to `src/lib/templates/systemEvents.ts` and ensure `ai-generate-whatsapp-templates` (already v2.1.0 enforces this) regenerates them with:
   - `header_type = 'none'`
   - body contains `{{document_link}}` (and `{{member_name}}`, `{{plan_name}}` etc.)
   - `attachment_source = 'dynamic'` so dispatcher injects the real PDF URL.
   Events covered: `workout_plan_ready`, `diet_plan_ready`, `pos_receipt_ready`, `invoice_ready`, `scan_report_ready`.

2. **Migration** to:
   - Mark existing 6 broken plan templates (`header_type='document'`, `meta_template_name IS NULL`) as `is_active = false` so they don't shadow the new ones.
   - Insert fresh rows with the document-link pattern. Owner can then click "Submit to Meta" from the Templates Hub to get `meta_template_name` populated.

3. **Refactor `sendPlanToMember.ts`** to:
   - Look up the matching template via `trigger_event` (`workout_plan_ready` / `diet_plan_ready`) for the branch (fallback to global), and pass its `template_id` to `dispatchCommunication`.
   - Pass variables `{ member_name, trainer_name, plan_name, valid_until, document_link: pdfUrl }`.
   - Keep the `attachment` so the actual PDF is delivered as a Meta-uploaded document (per dispatcher v1.6.0).

4. **Refactor `whatsappDocumentSender.ts`** the same way — accept a `triggerEvent` param and resolve the template on the server side; never send a freeform document caption when no template_id is available — instead surface a clear error ("No approved WhatsApp template for `<event>`. Submit one in Settings → Communication Templates").

5. **Dispatcher safety net (`supabase/functions/dispatch-communication`)** — when `channel = 'whatsapp'` and we don't have a `meta_template_name` AND we don't have a recent inbound message from the recipient (lookup `whatsapp_messages` direction='inbound' within 24h), fail fast with a structured `reason = 'no_active_session_no_template'` and write that into `communication_logs.error_message` (instead of letting Meta return 131047). This makes the failure obvious in the Live Feed.

### B. Polish the Queued → Sent → Delivered visual

Rewrite `src/components/communications/DeliveryTimeline.tsx`:

- Card-style strip with proper padding, no `max-w-sm` clamp; let it span the row.
- Connector lines: render as a single absolutely-positioned track behind all dots, then render a coloured fill from the first dot to the latest reached dot (gradient amber → sky → emerald). No more per-segment `width: 100%` overshoot.
- Reached dots get the colour from `stageMeta`; current stage gets a soft `ring + animate-pulse`; unreached dots get `bg-muted` with subtle border.
- When `failed` / `bounced`:
  - Replace the trailing dots after last reached stage with a red `XCircle` "Failed" pill.
  - Tint the whole strip background `bg-rose-50/50` and show the Meta error code (e.g. `131047 — Re-engagement message`) inline with a friendly explanation: *"Outside 24h — must use an approved template."*
- Add accessible labels (`aria-label`) under each dot and a tabular timestamp.
- Use design tokens (`text-emerald-600`, `bg-amber-500`, etc. — these are already approved in the project's Vuexy palette).

### C. Verification

- After migration, open Settings → Communication Templates → WhatsApp → CRM Templates: confirm new `workout_plan_ready` + `diet_plan_ready` rows with `header_type=none` + `{{document_link}}`.
- Submit them to Meta from the UI. Once `meta_template_name` populates, send a test plan to a member who is **outside** 24h: dispatcher should call Meta as `type=template`, no 131047.
- Live Feed: open a sent log and confirm Queued / Sent / Delivered timeline is aligned, coloured progressively, and failures show inline with the Meta error code.

## Files to touch

- `src/lib/templates/systemEvents.ts` (event metadata)
- `src/utils/sendPlanToMember.ts` (resolve + use template)
- `src/utils/whatsappDocumentSender.ts` (resolve + use template)
- `supabase/functions/dispatch-communication/index.ts` (no-session/no-template guard, bump to v1.7.0)
- `src/components/communications/DeliveryTimeline.tsx` (visual rewrite)
- New migration: deactivate broken plan templates + seed canonical document-link templates.
