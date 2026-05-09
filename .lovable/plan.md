# Fix WhatsApp Plan Send + End-to-End Test

## Root cause (audit findings)

Three bugs combined to break the workout plan send to Ryan:

1. **Wrong template picked.** My previous fix made `findTemplate` *prefer* templates with `header_type='document'`. For the `workout_plan_ready` event the doc-header template `workout_plan_ready_doc` was picked. Its body uses `{{member_name}}` and `{{plan_title}}` — but `sendPlanToMember` only passes `plan_name`. Dispatcher's `templateComponents()` returns `null` when a `{{var}}` is missing → error **`missing_template_variables`** (the toast you saw).

2. **The doc-header template is not Meta-approved with a HEADER component.** `whatsapp_templates.components` for `workout_plan_ready_doc` contains only a `BODY` block — no HEADER. Project memory already encodes this rule: *"Document events MUST use `header_type='none'` + `{{document_link}}` body var — Meta rejects DOCUMENT headers without an uploaded handle."* So even if vars were correct, attaching the PDF as a HEADER document would be rejected by Meta on send. The correct global template for this event is `workout_plan_ready_link` (`header_type='none'`, body `Hi {{member_name}}, your new workout plan *{{plan_name}}* from {{trainer_name}} is ready. Download it here: {{document_link}}`).

3. **Email → Hostinger SMTP timeout (`421 4.4.2 timeout exceeded` on port 465).** External provider/network issue from the edge runtime. Code is fine; provider is dropping the connection.

## What to change

### A. `src/lib/templates/dynamicAttachment.ts` — fix template ranking
Re-order `findTemplate` so it follows the project standard:

1. Branch-scoped `header_type='none'` (text/link template) — preferred.
2. Branch-scoped `header_type ∈ {document,image,video}` (only safe when Meta approved a HEADER, which we cannot tell from our row alone — secondary).
3. Global `header_type='none'`.
4. Global with header.

This makes the system pick `workout_plan_ready_link` (global, `header_type=none`, all vars satisfied by `sendPlanToMember`) and avoid the broken doc-header template.

### B. `src/utils/sendPlanToMember.ts` — broaden variable payload
Pass both `plan_name` and `plan_title` (alias) plus already-sent `member_name`, `trainer_name`, `valid_until`, `document_link`. This makes the call resilient to either naming convention so legacy/branch-scoped templates also resolve.

### C. Mark broken branch-scoped row inactive (data fix)
Set `templates.is_active=false` for `custom_workout_plan_ready_pdf` (branch `INCLINE`, `header_type='document'` but Meta-side has no HEADER approval) so it can never be selected. Optional but recommended.

### D. Email — give the user a working choice
The Hostinger SMTP error is not solvable in code. Propose three options to the user (chat reply after plan approval):
- Switch SMTP port from **465** → **587** (STARTTLS) in Settings → Integrations → Email.
- Switch provider to **Brevo** (connector available, free tier).
- Switch to **Lovable Emails** (built-in, no API keys needed).

Default recommendation: **587 first** (zero-cost change). If still failing, move to Brevo/Lovable Emails.

## End-to-end test plan

After A–C are deployed:
1. From `/fitness/member-plans`, open Ryan Lekhari → Workout *4 week Muscle Gain for Beginners* → **Share** → send to **WhatsApp + Email**.
2. Verify **WhatsApp** to `919887601200`:
   - Toast "Sent" appears.
   - `communication_logs` row has `channel='whatsapp'`, `status='sent'`, `template_id` populated, no `missing_template_variables`.
   - Recipient receives a message with PDF link rendered from `{{document_link}}`.
3. Verify **Email** to `rajat.lekhari@hotmail.com`:
   - If user keeps Hostinger 465 → expect timeout (external).
   - After flipping to port 587 (or new provider) → toast "Sent", `communication_logs.status='sent'`, mail arrives with PDF attachment.
4. Confirm dispatcher logs show no `missing_template_variables` and no `131047`.

## Technical notes (for the reviewer)

- `dispatch-communication` v1.8 is correct; no edge change needed.
- `orderedTemplateKeys()` derives `{{vars}}` from local `templates.content`, so the local row's content placeholders are the contract — the matching `whatsapp_templates.components[].text` on Meta's side just needs the same number of `{{n}}` slots in the same order. `workout_plan_ready_link` already matches.
- The previous `header_type=document` preference was added to attach PDFs natively; it's incompatible with our project rule and Meta's approval state. Reverted to text+link as the canonical document delivery path.
- No DB schema change required. The `templates.is_active=false` flip is a single `UPDATE`.
