I audited the live backend, webhook logs, integration row, and the CRM chat query path.

Root cause found: Meta is now delivering the webhook successfully, but our webhook parser is ignoring it.

Evidence:
- `meta-webhook` received a signed POST and signature verification passed.
- Log shows: `ACCEPTED object=instagram entries=1 sig=verified matched_secret_prefix=e40219`
- Immediately after, log shows: `[IG] unhandled change field=messages`
- No Instagram message was inserted into `whatsapp_messages`.

So this is no longer a tester-role / app-secret / webhook-not-delivered problem. The current bug is in our handler: Instagram Login webhooks can send DMs under `entry.changes[]` with `field: "messages"` and the actual DM in `change.value`. Our code only ingests DMs when they are in `entry.messaging[]`, so it drops the real payload as “unhandled”.

Plan to fix completely:

1. Update `meta-webhook` Instagram parser
   - Add support for Instagram Login `changes[]` payloads where:
     - `change.field === "messages"`
     - `change.value.sender`
     - `change.value.recipient`
     - `change.value.message`
   - Route that value into the existing `ingestMessagingEvent(...)` function so the message is inserted into `whatsapp_messages` exactly like the older `entry.messaging[]` format.
   - Also handle related Instagram Login fields safely:
     - `message_reactions`
     - `messaging_postbacks`
     - `messaging_seen`
     - `messaging_referral`
     - `message_edit`
     - `message_echoes`
   - Unknown fields will still be logged, but `messages` will no longer be dropped.

2. Add webhook ingress logging for future audits
   - Create `webhook_ingress_log` table to record accepted webhook arrivals, object type, fields received, entry count, signature status, and a sanitized payload sample.
   - This solves the current blind spot: today only failures are persisted, but successful-but-ignored payloads are visible only in short-lived function logs.
   - RLS will be enabled and admin/manager read policies will be added.

3. Harden diagnostics
   - Update `meta-diagnose` to check the new ingress log and report:
     - “Meta delivered webhook”
     - “Payload field received: messages”
     - “CRM inserted message” or “handler dropped message”
   - Improve the existing `recent_traffic` message so it no longer incorrectly says “Meta has not delivered ANY webhook” when accepted webhook logs exist.

4. Add a synthetic signed webhook test path
   - Create a diagnostic-only backend function or internal test mode to send a signed Instagram Login-style webhook payload into `meta-webhook`.
   - Verify the full pipeline:
     - signature validation
     - `changes[].field=messages` parsing
     - database insert
     - CRM contact list visibility
   - This lets us prove the CRM ingestion path without waiting for Meta.

5. Verify the CRM chat query path
   - Confirm the inserted Instagram message appears in `src/pages/WhatsAppChat.tsx`, which already reads from `whatsapp_messages` and filters by `platform: instagram` correctly.
   - If needed, adjust branch/global filtering so a globally configured Instagram integration still appears for the selected branch.

Expected result after implementation:
- When a tester profile sends a DM to `theinclinelife`, the webhook will be accepted and inserted as an inbound Instagram message.
- The chat will appear in CRM under the Instagram filter / unified chat list.
- Diagnostics will show whether Meta delivered, whether the handler parsed it, and whether the database insert succeeded.