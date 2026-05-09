## Audit Findings

1. **Current Yogita send did deliver, but only as a text template with a PDF link**
   - Latest log for `919928910901` used template `workout_plan_ready_doc` and is marked delivered.
   - The WhatsApp row is `message_type = text`, `media_url = null`, and the message body contains a signed PDF URL.
   - This is why the member sees a link instead of a native PDF document attachment.

2. **The active workout/diet templates are configured as BODY-only templates**
   - `workout_plan_ready_doc` is active, linked to Meta, but has `header_type = none` and only `member_name` in variables.
   - Because it is not a Meta document-header template, the dispatcher cannot attach the PDF natively for that template.

3. **Retry queue is calling the wrong function contract**
   - `process-comm-retry-queue` retries WhatsApp by calling `send-whatsapp` directly with `{ branch_id, recipient, content, phone, message }`.
   - `send-whatsapp` requires `message_id`, `phone_number`, and `branch_id`.
   - That mismatch causes: `send-whatsapp 400: Missing required fields: message_id, phone_number, branch_id`.

4. **Retry rows lose the original attachment payload**
   - The database trigger that enqueues failed communication rows only copies text fields into `communication_retry_queue`.
   - It does not copy `delivery_metadata.attachment`, so retries cannot resend the PDF attachment even if the original log had it.

## Fix Plan

1. **Make plan PDF WhatsApp use native document attachments again**
   - Update the active workout/diet plan template rows to use document-header delivery:
     - `header_type = document`
     - `attachment_source = dynamic`
     - keep `meta_template_name = workout_plan_ready_doc` / `diet_plan_ready_doc`
   - Ensure the template body does not require `document_link`; the PDF will be passed in the Meta template `HEADER` component.

2. **Update template selection for document events**
   - Adjust `findTemplate()` so workout/diet/body-scan/payment document events prefer active templates with `header_type = document` when a PDF attachment is being sent.
   - Keep text/link fallback only if no approved document-header template exists.

3. **Harden dispatcher behavior**
   - In `dispatch-communication`, when a WhatsApp template has `header_type = document` and an attachment URL is present, always build a native Meta `HEADER` document component.
   - Do not append the PDF URL into body variables for document-header templates.
   - Store `media_url` on the `whatsapp_messages` row so the audit trail clearly shows a document was sent.

4. **Fix failed retry queue processing**
   - Change `process-comm-retry-queue` so WhatsApp retries call `dispatch-communication`, not `send-whatsapp` directly.
   - Reconstruct the dispatcher payload from the original `communication_logs` row, including:
     - branch, recipient, channel/category
     - template id
     - member id
     - body/subject
     - original attachment from `delivery_metadata.attachment`
   - Generate a fresh retry dedupe key so the retry does not collide with the failed log.

5. **Preserve attachments in future retry queue rows**
   - Update the enqueue trigger to copy `communication_logs.delivery_metadata` into `communication_retry_queue.metadata`.
   - This makes future retries attachment-safe for WhatsApp and email.

6. **Clean up current broken Yogita retry rows**
   - For the two pending rows currently failing with the missing-fields error, either:
     - cancel the stale no-template row, and
     - retry the attachment row through the corrected dispatcher path; or
     - mark both stale rows cancelled after confirming a fresh document send succeeds.

7. **Run curl tests for both channels**
   - Test WhatsApp by invoking `dispatch-communication` with a PDF attachment to `919928910901` and confirm:
     - `whatsapp_messages.message_type = document`
     - `media_url` is present
     - provider returns a WhatsApp message id
   - Test Email with the same PDF and confirm the email path still sends with a PDF attachment.

## Expected Result

- Workout and diet plan WhatsApp messages will arrive as a native attached PDF document, not just a link.
- Retry queue will stop showing `send-whatsapp 400` missing-field errors.
- Future failed PDF sends will retain enough metadata to retry correctly.