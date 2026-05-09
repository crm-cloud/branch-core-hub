Audit result:
- The PDF is being attached, but the plan sender still passes a fallback message body containing `Download: <signed URL>`.
- The dispatcher has a bug: `appendAttachmentLinkForBodyOnlyTemplate()` runs even for approved WhatsApp document-header templates, so the signed PDF URL can leak into template body variables even when the PDF is attached as a native document.
- The local WhatsApp/audit row stores the fallback body, so the inbox/history can show the link format even when the send path is intended to be a document attachment.
- Workout/diet template variable metadata is stale: the approved Meta templates use 2 body variables, but local rows only list `member_name` in some rows.

Plan to fix:

1. Stop URL leakage for document-header templates
- Update `supabase/functions/dispatch-communication/index.ts` so `appendAttachmentLinkForBodyOnlyTemplate()` is only used when the selected template has `header_type='none'`.
- For `header_type='document'`, always send the PDF only through the WhatsApp HEADER document component.
- Add defensive metadata like `send_mode: 'template_document_header'` and `template_header_type` to `delivery_metadata` for future audit clarity.

2. Clean the workout/diet plan message body
- Update `src/utils/sendPlanToMember.ts` so when a document-header template is found, the body/caption is clean:
  - `Hi YOGITA LEKHARI, your workout plan YOGITA PLAN is attached as a PDF.`
- Keep the `Download:` link fallback only when there is no approved document-header template and the system must fall back to link delivery.

3. Fix local audit/inbox display
- In the dispatcher, derive a clean `displayContent` from the chosen template and variables for document-template sends.
- Store that clean content in `communication_logs` and `whatsapp_messages`, not the fallback signed URL body.
- This prevents the WhatsApp inbox/history from showing the long storage URL.

4. Correct template variable metadata
- Update the backend template rows for:
  - `workout_plan_ready_doc`
  - `diet_plan_ready_doc`
- Ensure variables match the approved Meta template body: `member_name` + `plan_title`.
- Keep `header_type='document'`, `attachment_source='dynamic'`, and active approved status.

5. Validate with curl tests after implementation
- Deploy/test the updated dispatcher.
- Send a WhatsApp test to the same number using an existing PDF URL and `workout_plan_ready_doc`.
- Verify:
  - `communication_logs.content` has no `Download:` and no signed URL.
  - `whatsapp_messages.message_type='document'` with `media_url` present.
  - `delivery_metadata.send_mode='template_document_header'`.
  - provider status is `sent/read`, not failed.
- Also run an email curl test to confirm PDF attachment behavior remains unaffected.