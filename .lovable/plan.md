# Audit: Channel On/Off Enforcement in Communication Dispatcher

## What I found

The system has **three layers** that send messages, but only one of them respects the
**Settings → Integrations → channel toggle (`is_active`)**:

| Layer | File | Respects `integration_settings.is_active`? |
|---|---|---|
| 1. Dispatcher (single entry point) | `dispatch-communication/index.ts` | NO — never reads `integration_settings` |
| 2. Member preferences RPC | `should_send_communication` (Postgres fn) | NO — only checks per-member `member_communication_preferences` |
| 3. Provider edge fns | `send-whatsapp`, `send-sms`, `send-email` | YES, but only at the very end |
| 4. Retry workers | `process-comm-retry-queue`, `process-whatsapp-retry-queue` | NO — keep retrying disabled channels |

### Consequence today

When SMS / WhatsApp / Email is toggled **off** in Settings → Integrations:

1. Caller (UI / cron / trigger) calls `dispatchCommunication(...)`.
2. Dispatcher inserts a `communication_logs` row, marks it `sending`, then invokes the provider fn.
3. Provider fn returns `400 "No active <X> provider configured"`.
4. Dispatcher catches the error → row flips to `delivery_status='failed'` with a generic error.
5. `whatsapp_send_queue` / `communication_retry_queue` keeps retrying the same payload up to N times — each attempt ending in the same 400 (this is exactly the loop visible in the screenshot: `send-whatsapp 400 … Next: in 4 minutes / 9 minutes`).
6. Live Feed in the Comms hub fills with red "Failed" rows that are not actionable — the only fix is to enable the channel.

### Additional gaps

- **No branch-level isolation.** A branch may have its own `integration_settings` row (with `is_active=false`) while a global row exists with `is_active=true`. Today only `send-whatsapp` falls back branch → global; SMS/email pick *any* active row. We need one consistent rule.
- **`should_send_communication`** ignores branch-level kill switches entirely. A member with all preferences ON will still be attempted on a disabled channel.
- **WhatsApp triggers / Automation Brain / Campaigns** all eventually call `dispatchCommunication`, so a single dispatcher-level check fixes every entry point.
- **In-app channel** is internal (notifications table) and should always be allowed regardless of integration_settings.

---

## Plan

### 1. New helper: `channel_active_for_branch(branch_id, channel)` (Postgres fn)
Returns `boolean`:
- `true` for `in_app`.
- For `whatsapp/sms/email`: looks for `integration_settings` row with matching `integration_type`, `is_active=true`, scoped first to `branch_id`, then global (`branch_id IS NULL`). If neither exists → `false`.

### 2. Pre-flight gate in `dispatch-communication`
Right after validation (before dedupe, before the log insert), call the new fn:

```ts
const { data: chActive } = await supabase.rpc('channel_active_for_branch', {
  p_branch_id: input.branch_id, p_channel: input.channel,
});
if (chActive === false) {
  // Insert a single suppressed log row (idempotent on dedupe_key) and return.
  return ok({ status: 'suppressed', reason: 'channel_disabled' });
}
```

The suppressed row uses `delivery_status='suppressed'`, `error_message='channel_disabled_in_settings'` so Live Feed can render a neutral chip ("Channel off") instead of a red "Failed".

### 3. Extend `should_send_communication` (defense in depth)
Add the same branch-level check inside the RPC so any future caller that bypasses the dispatcher (e.g. a database trigger writing directly to `communication_logs`, although the CI guard blocks that for new code) still gets the right answer.

### 4. Update retry workers
`process-comm-retry-queue` and `process-whatsapp-retry-queue`: before re-invoking the dispatcher, run the same `channel_active_for_branch` check; if disabled, mark the queue row `abandoned` with `last_error='channel_disabled_in_settings'` instead of consuming retry attempts.

### 5. UI surfacing (small but important)
- **Settings → Integrations**: when a channel is toggled OFF, show a yellow banner "Outbound <X> messages will be suppressed until re-enabled. Existing scheduled retries will be abandoned."
- **Comms Hub Live Feed**: render `delivery_status='suppressed'` with reason `channel_disabled_in_settings` as a grey "Channel off" chip (today it just shows "Suppressed").
- **WhatsApp Automations / Campaign Wizard**: when picking a channel that's off, show an inline warning so users don't schedule something that will be silently suppressed.

### 6. Tests
- Unit test the new SQL fn (branch row wins over global; missing rows = false; in_app always true).
- Edge function curl test: with `meta_cloud` `is_active=false`, dispatcher returns `{status:'suppressed', reason:'channel_disabled'}` and writes exactly one suppressed `communication_logs` row, no `whatsapp_messages` / queue rows created.

---

## Files to change

- new SQL migration: `channel_active_for_branch(...)` + extend `should_send_communication`
- `supabase/functions/dispatch-communication/index.ts` (pre-flight gate, log writer)
- `supabase/functions/process-comm-retry-queue/index.ts`
- `supabase/functions/process-whatsapp-retry-queue/index.ts`
- `src/pages/Integrations.tsx` (banner)
- Comms Hub Live Feed component (chip rendering)
- `CampaignWizard` + `WhatsAppAutomations` (inline warning)

## Out of scope
- Member-level preference UX (already handled).
- Provider credential validation (already handled in provider fns).
- Changing the existing per-channel template flow (PDF/header logic stays as-is).
