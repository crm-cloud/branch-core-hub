# Audit: Why admins didn't get WhatsApp alert for the new lead

## Root cause (confirmed)

The lead `RAJAT LEKHARI` (and all recent leads) has `source = 'whatsapp_ai'`, meaning it was captured by the **WhatsApp AI agent** inside `supabase/functions/whatsapp-webhook/index.ts` (lines 1340-1368). That code path inserts the row into the `leads` table — but **never invokes `notify-lead-created`**.

Evidence:
- `lead_notification_rules` is correctly configured for branch `MAIN`: `whatsapp_to_admins=true`, `whatsapp_to_lead=true`.
- Admin `Rajat Lekhari` has phone `+919887601200` on file.
- Active WhatsApp Meta Cloud integration exists globally (`is_active=true`, valid `phone_number_id` + `access_token`).
- Edge-function log query for `notify-lead-created` returns **zero invocations** — the function has never been called.
- `capture-lead`, `webhook-lead-capture`, and the `AddLeadDrawer` UI all fire `notify-lead-created` after insert. The AI capture path is the only one missing this dispatch.

So the rules + integrations + recipients are all healthy. The notification simply isn't being triggered for AI-captured leads.

## Fix plan

### 1. Wire `notify-lead-created` into the WhatsApp AI lead-capture flow (primary fix)
In `supabase/functions/whatsapp-webhook/index.ts`, immediately after the successful `leads` insert (line ~1348, inside `else if (newLead)`), add a fire-and-forget POST to `${SUPABASE_URL}/functions/v1/notify-lead-created` with `{ lead_id, branch_id }` — mirroring the exact pattern used in `capture-lead/index.ts` (lines 100-110). This guarantees admins, managers, and the lead all receive their configured SMS/WhatsApp alerts the moment the AI captures the lead.

### 2. Centralize the dispatch via a Postgres trigger (durability fix)
To prevent this class of bug recurring whenever a new code path inserts into `leads`, add a database trigger `on_lead_inserted` that calls `notify-lead-created` via `pg_net` for every new row in `public.leads`. This makes the notification a property of the data, not of each caller. Existing edge-function callers will then become redundant safety nets (idempotent — `notify-lead-created` is safe to call multiple times because it just sends messages; we'll add a tiny guard so duplicates are deduped via a `notified_at` column on `leads`).
- Add column `leads.notified_at timestamptz`
- Trigger fires only when `notified_at IS NULL`, then `pg_net.http_post` to the function
- `notify-lead-created` updates `notified_at = now()` on success

### 3. Optional cleanup
- Remove the redundant client-side `supabase.functions.invoke('notify-lead-created', …)` call from `AddLeadDrawer.tsx` (the trigger now handles it). Same for `capture-lead` and `webhook-lead-capture` edge functions — keep them as fallbacks but log when the trigger has already fired.

### 4. Backfill the missed lead (so you actually get the alert that was lost)
After deploying the fix, manually invoke `notify-lead-created` once for the most recent lead (`15ca537f-fec2-4fce-aeb4-42ef45b49d59`) so you receive the WhatsApp alert you were expecting. I'll do this as a one-shot curl after the deploy.

## Files I'll change
- `supabase/functions/whatsapp-webhook/index.ts` — add notify dispatch after AI lead insert
- New migration — `leads.notified_at` column + `on_lead_inserted` trigger calling `notify-lead-created` via `pg_net`
- `supabase/functions/notify-lead-created/index.ts` — set `notified_at` after successful dispatch; short-circuit if already set
- (Optional polish) `src/components/leads/AddLeadDrawer.tsx` — drop now-redundant client invoke

## Expected result
- New WhatsApp-AI-captured lead → admin (`+919887601200`) receives the configured "🔔 New Lead Alert" WhatsApp message within seconds.
- Lead also gets the welcome WhatsApp message (since `whatsapp_to_lead=true`).
- All current and future lead-creation paths are guaranteed to trigger notifications via the DB trigger — no more silent gaps.
