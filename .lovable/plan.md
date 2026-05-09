# Audit findings & fix plan

## Root causes

### 1. "Save Changes" works but header type/source revert to None on reopen
The Template Manager list reads from the **`v_template_with_meta_status`** view (line 181, `TemplateManager.tsx`). That view does **not** select `header_type`, `header_media_url`, `attachment_source`, `attachment_filename_template`, or `header_media_handle`.

Flow:
1. User opens editor → `openEditor(template)` reads `template.header_type` → undefined → form defaults to `'none'` / `'Pick'`.
2. User picks `Document` + `Dynamic`, hits Save → `UPDATE templates` succeeds (toast "Template updated").
3. List re-fetches from the view → still no `header_type` → user reopens → form again shows `None`.

So the value **is** persisted in the table; the editor just looks blank. The badge/coverage matrix in the list also can't tell document templates apart.

### 2. Duplicate / orphan templates causing confusion
Branch `11111111…` has duplicates seeded by older migrations (each `*_pdf` appears twice; `payment_receipt_pdf` once with `attachment_source='none'`, once with `'dynamic'`). Global `*_link` rows live alongside new `*_doc` rows. Result: dispatcher routing is non-deterministic.

### 3. Meta submission status mismatch
- `diet_plan_ready_doc` → `meta_template_status='APPROVED'` ✓
- `workout_plan_ready_doc` → `'PENDING'` (submitted, awaiting Meta)
- `invoice_ready_doc`, `payment_receipt_doc`, `pos_receipt_doc`, `scan_report_doc` → still `'draft'` (never submitted to Meta).

Until Meta approves each, dispatcher v1.8.0 falls back to the `*_link` companion (storage URL in body) — which is what the user is seeing.

### 4. Console 400: `member_benefit_credits?branch_id=…&remaining=gt.0`
`src/components/settings/BenefitSettingsComponent.tsx` line 258-262 queries:
- `.eq("branch_id", branchId)` — that table has **no `branch_id` column**.
- `.gt("remaining", 0)` — column is `credits_remaining`.

Both filters are wrong → PostgREST 400.

---

## Fixes

### A. Template editor visibility (database migration)
Recreate `v_template_with_meta_status` to also expose:
`header_type, header_media_url, header_media_handle, attachment_source, attachment_filename_template`.

This restores the dropdowns on edit, lets the list show accurate "Native PDF / Link only" badges, and unblocks the Coverage Matrix.

### B. Clean & backfill templates (database migration)
Inside the same migration:
1. **Deduplicate** `*_pdf` per `(branch_id, name)` keeping the newest row (use `ROW_NUMBER()` partition); delete the rest.
2. For each canonical document event, ensure exactly one **global** `*_doc` row exists with:
   - `header_type='document'`, `attachment_source='dynamic'`,
   - `header_media_url` pointing to a sample PDF in the `attachments` bucket (so Meta upload has a handle to convert),
   - body **without** `{{document_link}}` (header carries the file).
   Events: `workout_plan_ready`, `diet_plan_ready`, `payment_received`, `scan_report_ready`, `invoice_generated`, `pos_purchase_receipt`.
3. Mark the matching `*_link` rows `is_active=false` **only when** the corresponding `*_doc` reaches `meta_template_status='APPROVED'` (we'll do this via a tiny SQL helper that runs on every poll). For now, leave `*_link` active as fallback.
4. Reset stuck `*_doc` rows whose status is `draft` to `pending` so the next poll triggers re-submission.

### C. Resubmit to Meta (no code change, runtime action)
After migration, call `manage-whatsapp-templates` (`action=submit`) for each of the 4 `*_doc` rows still in `draft`. The function already uploads the sample PDF as a Meta `h:` handle (v2.4.0). Surface this as a single **"Submit pending document templates"** button in `TemplateManager.tsx` header (only visible when ≥1 row is `draft|pending`, owner/admin only). Clicking it loops through the rows and calls the edge fn.

### D. Fix benefit credits 400 (frontend only)
In `BenefitSettingsComponent.tsx`:
- Drop the invalid `.eq('branch_id', …)` and `.gt('remaining', …)`.
- Replace with a join via members:
  ```ts
  supabase
    .from('member_benefit_credits')
    .select('id, members!inner(branch_id)', { count: 'exact', head: true })
    .eq('members.branch_id', branchId)
    .gt('credits_remaining', 0)
    .gt('expires_at', new Date().toISOString())
  ```

### E. Optional: status badge polish (DeliveryTimeline)
Already done in last pass — no further work unless user reports issues.

---

## Files to change

| File | Change |
|---|---|
| `supabase/migrations/<new>.sql` | Recreate view with header columns, dedupe `*_pdf`, ensure 6 global `*_doc` rows, reset draft status |
| `src/components/settings/TemplateManager.tsx` | Add "Submit pending document templates" toolbar button; wire to `manage-whatsapp-templates` |
| `src/components/settings/BenefitSettingsComponent.tsx` | Fix `member_benefit_credits` query (members join + `credits_remaining`) |

## Risks
- View recreation drops dependent objects — check for `pg_depend` before drop. We'll use `CREATE OR REPLACE VIEW` (safe; column count unchanged for existing ones, only adding tail columns).
- Dedup deletes rows referenced by `whatsapp_triggers` / `communication_logs` (FKs are `ON DELETE SET NULL` / `CASCADE` respectively — already verified above). We'll repoint `whatsapp_triggers.template_id` to the surviving row before delete.
- Meta resubmission: rate-limited; we loop sequentially with 500 ms delay.

## Verification
1. Open any document template → header dropdown shows `Document`, source shows `Dynamic` (not blank).
2. List badges show "Native PDF" for approved, "Pending Meta" for pending.
3. Click "Submit pending document templates" → 4 rows transition `draft → pending` then later `→ approved`.
4. Console clean: no 400 on `member_benefit_credits`.
5. Send a test invoice → arrives as native PDF attachment in WhatsApp (not a link in body).
