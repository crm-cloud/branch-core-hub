# Plan: Communications Audit + AI Memory & Duplicate-Lead Fix

## Part 1 — Communications Audit Report (`/announcements`)

### Goal
Surface a real-time **Audit Report** card next to the Live Logs that shows trigger health, failure breakdown, and a retry queue for failed messages.

### Findings
- `communication_logs` already has `delivery_status`, `attempt_count`, `error_message`, `delivery_metadata`, `provider_message_id` — but the UI only shows raw rows.
- Currently: only `sent` status exists in DB (2 rows). No automated retry on failures.
- `whatsapp_triggers` table maps system events → outreach but has no health view.

### Changes

**A. Database (migration)**
- Add `communication_retry_queue` table:
  ```
  id, original_log_id, branch_id, type, recipient, subject, content,
  retry_count (int default 0), max_retries (int default 3),
  next_retry_at (timestamptz), last_error, status ('pending'|'processing'|'succeeded'|'exhausted'),
  created_at, updated_at
  ```
- RLS: admin/owner/manager read; service role write.
- Trigger on `communication_logs`: when `status='failed'` inserted/updated AND no existing pending row → enqueue with exponential backoff (5m, 30m, 2h).

**B. Edge function `process-comm-retry-queue`** (new)
- Reads `pending` rows where `next_retry_at <= now()`.
- Re-dispatches via the existing `send-whatsapp` / `send-sms` / `send-email` functions.
- Updates retry_count, marks `succeeded` or `exhausted` after `max_retries`.
- Schedule: pg_cron every 5 minutes.

**C. Frontend — `src/pages/Announcements.tsx`**
Add a third tab **"Audit Report"** (alongside Announcements / Live Logs) containing:

1. **Trigger Health card** — for each trigger event (lead_created, payment_received, etc.):
   - Last 24h: total sent / failed / success rate %
   - Last fired timestamp
   - Green/Yellow/Red badge
2. **Channel Health** — Email/SMS/WhatsApp success rate cards (last 7d) with sparkline.
3. **Failure Breakdown** — top 5 error messages grouped by `error_message` with counts.
4. **Retry Queue table** — pending/processing rows with manual "Retry now" and "Cancel" buttons.
5. **Export CSV** of the audit window.

New file: `src/components/communication/CommAuditReport.tsx`
New service methods in `src/services/communicationService.ts`: `fetchAuditStats()`, `fetchRetryQueue()`, `manualRetry(id)`, `cancelRetry(id)`.

---

## Part 2 — Fix WhatsApp AI Duplicate Leads + Persistent Memory

### Root Cause Analysis
In `supabase/functions/whatsapp-webhook/index.ts` (line 1340):
```ts
const { data: newLead } = await supabase.from("leads").insert(leadData)...
```
- **No dedup check** — every time the AI re-extracts a `lead_captured` JSON for the same phone, a fresh row is inserted.
- **No DB constraint** — `leads.phone` has only a non-unique index.
- Memory window is **only the last 10 messages** (line 940), so after a few exchanges the AI forgets it already captured this person and re-asks/re-captures.
- After successful capture the bot is paused (`bot_active=false`), but if the user replies later and bot is reactivated, it captures again.

### Fix Strategy

**A. Database migration**
- Add **partial unique index** on `leads(phone, branch_id) WHERE source = 'whatsapp_ai'` to hard-block duplicates.
- Add `whatsapp_chat_settings.captured_lead_id uuid references leads(id)` — single source of truth linking a chat thread to its lead.
- Add `whatsapp_chat_settings.conversation_summary text` and `summary_updated_at timestamptz` — long-term memory store.

**B. Webhook changes (`whatsapp-webhook/index.ts`)**
1. **Pre-insert dedup guard** — before calling `.insert()`:
   - Check `whatsapp_chat_settings.captured_lead_id` for this phone+branch. If set → **UPDATE** that lead with any new fields instead of inserting.
   - Also fallback `SELECT id FROM leads WHERE phone=? AND branch_id=? ORDER BY created_at DESC LIMIT 1`.
2. **Insert path** uses `.upsert()` with `onConflict: 'phone,branch_id'` (via the new partial index) and `ignoreDuplicates: false` so re-extractions enrich rather than duplicate.
3. After successful capture, write `captured_lead_id` back to `whatsapp_chat_settings`.

**C. Persistent conversation memory**
1. Increase short-term window from **10 → 30 messages** (keeps full context for current session).
2. Add **rolling summary**:
   - When a chat thread crosses 20 messages, call Lovable AI (`gemini-2.5-flash-lite`) once to summarize the older portion → store in `whatsapp_chat_settings.conversation_summary`.
   - On each subsequent reply, prepend the summary to the system prompt as: `"Prior conversation summary: …"`.
3. Inject **known lead context** into the prompt when `captured_lead_id` exists:
   - "You have already captured this lead's details: name=…, email=…, goal=…. Do NOT ask again. Continue helping."
4. New helper function `buildConversationContext(phone, branchId)` centralises memory assembly (summary + recent + lead snapshot).

**D. Cleanup of existing duplicates**
- One-time SQL in migration: keep the oldest `whatsapp_ai` lead per (phone, branch_id), move activities/followups to it, mark the rest as `lost` with reason `merged_duplicate`.

---

## Files Touched

**Migrations**
- `communication_retry_queue` table + RLS + trigger + pg_cron.
- `leads` partial unique index + duplicate cleanup.
- `whatsapp_chat_settings` new columns (captured_lead_id, conversation_summary, summary_updated_at).

**Edge Functions**
- `supabase/functions/process-comm-retry-queue/index.ts` (new)
- `supabase/functions/whatsapp-webhook/index.ts` (dedup + memory)

**Frontend**
- `src/pages/Announcements.tsx` (add Audit tab)
- `src/components/communication/CommAuditReport.tsx` (new)
- `src/components/communication/RetryQueueTable.tsx` (new)
- `src/services/communicationService.ts` (audit + retry methods)

## Verification
- Send a known-failing email → confirm row enters retry queue, retries 3× with backoff, then marks exhausted.
- Simulate WhatsApp AI conversation: send name+email twice → assert only 1 lead row, `captured_lead_id` populated, second extraction enriches.
- After 25 messages, verify `conversation_summary` is generated and prepended on next reply.
- Audit Report shows trigger health badges and channel success rates within 5 seconds.
