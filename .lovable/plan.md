Audit result: Meta is delivering to our webhook successfully. This is not a tester-role or app-secret delivery failure anymore.

What I found:
- Live webhook payloads are arriving as `object=instagram`, signature verified with the Instagram App Secret prefix `e40219`.
- The latest ingress rows show Meta sends only `messaging[].message_edit.mid` with no `sender`, no `recipient`, and no `text`.
- Our current fallback tries to fetch message details by MID, but the code only logs `unresolved contact` and then drops it, so no CRM message row is created.
- Your integration row is active, token is valid, and `/subscribed_apps` reports the correct fields: `messages`, `messaging_postbacks`, `messaging_seen`, `comments`, `mentions`, `story_insights`, `messaging_referral`.
- Official Meta docs say Business Login messaging payloads should normally include `sender`, `recipient`, and `message.text`; `message_edit` should include `text`. Your live payload is a stripped/minimal `message_edit` shape, so we need a more robust recovery path instead of dropping it.
- One configuration mismatch also exists: the row is stored as `integration_type='instagram'` + `provider='instagram_meta'`, but it contains an IGAA Instagram Login token. The code mostly auto-detects IGAA now, but some UI/diagnostic paths still classify it as the Facebook-login provider, which is risky.

Plan to fix:

1. Harden the webhook for stripped `message_edit` payloads
- Update `meta-webhook` so `messaging[].message_edit` is never silently dropped.
- If Meta includes `message_edit.text`, ingest that directly.
- If text/sender is missing, fetch the MID from the Graph conversations/message endpoint using the IGAA token and log the exact Meta API response shape when resolution fails.
- Support both response shapes from Meta:
  - `{ from, to, message }`
  - conversation-style nested message arrays if Meta requires conversation lookup first.
- If Meta still refuses to expose the message body, store a forensic placeholder inbound row like `[Instagram message received — content unavailable from Meta]` instead of dropping it, so the CRM shows the conversation and contact trail.

2. Add an explicit webhook processing audit table
- Add a `webhook_processing_log` table with fields such as:
  - source/object_type
  - platform_message_id
  - processing_status: `stored`, `deduped`, `dropped`, `resolve_failed`, `placeholder_stored`
  - reason
  - meta_error_code/subcode/message
  - sample payload
- This is different from the existing ingress log: ingress confirms Meta delivered; processing log confirms whether our parser stored or dropped the message.

3. Improve `meta-diagnose` to show the real failure
- Add checks for:
  - last Meta delivery time
  - last payload shape (`message`, `message_edit`, `changes[]`, etc.)
  - last processing result
  - last resolved/stored message
- The diagnosis should no longer say “all checks passed” when traffic arrives but messages are being dropped.

4. Fix Instagram Login classification
- Normalize the integration lookup so IGAA tokens are treated as Instagram Login regardless of the saved `provider` label.
- Update diagnostics/help text to show that this integration is actually using Instagram Business Login (`graph.instagram.com`) even if the older row says `instagram_meta`.
- Avoid relying on the stored provider string for host selection; use token prefix and account ID.

5. Add live curl/synthetic tests after implementation
- Run a signed webhook test with:
  - standard `messaging[].message` payload
  - `changes[].field='messages'` payload
  - stripped `messaging[].message_edit.mid` payload
  - `message_edit` with `text` included
- Verify each case produces either a real inbound CRM message or a visible placeholder plus processing log.
- Re-run `meta-diagnose` and read latest function/database logs to confirm the pipeline is no longer silently dropping live Meta deliveries.

6. Manual Meta setting to verify in parallel
- In Meta’s Instagram API setup with Instagram Login, ensure the webhook subscription has “Include Values” enabled. Meta docs state payloads can be sent as reduced changed-field notifications when values are not included. Your payload looks stripped, so this is a likely dashboard-side contributor.
- Also verify the Instagram account has “Allow access to messages / connected tools” enabled in Instagram message controls. Official docs call this out for professional accounts using messaging APIs.

Expected result:
- Fresh Instagram DMs from tester accounts should appear in the CRM chat.
- If Meta sends only MID and refuses detail fetch, the CRM will still show an inbound placeholder instead of nothing, and diagnostics will show the exact Meta reason so we can escalate/fix settings precisely.