## Part 1 — Fix "Test Connection" failure for GPT-5 / OpenAI new models

### Root cause
GPT-5 (and the gpt-5.x family) on OpenAI's API rejects `max_tokens` and requires `max_completion_tokens`. Two places send `max_tokens` blindly:

1. `supabase/functions/test-ai-provider/index.ts` (line 108) — hard-coded `max_tokens: 10` in the test ping.
2. `supabase/functions/_shared/ai-dispatcher.ts` (line 157) — forwards `opts.max_tokens` for every provider.

Both fail the moment the chosen model is `openai/gpt-5*` going directly to OpenAI. (Lovable AI Gateway tolerates either, which is why Lovable AI provider passes.)

### Fix
Add a small helper `tokenLimitParam(provider, model)` that picks the right key:
- `max_completion_tokens` when `provider === "openai"` AND model matches `/^gpt-(5|5\.\d|o\d)/i`
- `max_tokens` otherwise

Apply in both files. Also strip `temperature` for the same reasoning models (GPT-5 only allows default temperature) — safer to omit it when not explicitly required.

### Files touched
- `supabase/functions/test-ai-provider/index.ts` — use helper; deploy.
- `supabase/functions/_shared/ai-dispatcher.ts` — use helper in `executeCall`; auto-redeploys with each consumer.

No DB / UI changes. Verify by re-clicking "Test Connection" on the openai/gpt-5 provider row.

---

## Part 2 — Manual Diet/Workout plans via uploaded PDF templates

### Goal
Trainers/managers already have polished printed plans (PDFs). They want to:
1. Upload a PDF once as a **named template** (e.g. "Beginner Fat-Loss Diet — 1500kcal").
2. Re-use it: assign that template to any member, who then sees/downloads the PDF in their portal and gets it via WhatsApp/email — exactly like AI/manual plans today.

### Schema additions (single migration)

Add three nullable columns to `fitness_plan_templates`:
- `source_kind text default 'structured' check (source_kind in ('structured','pdf'))`
- `pdf_url text`
- `pdf_filename text`
- `pdf_size_bytes int`

Add the same to `member_fitness_plans` so an assigned plan carries the PDF reference (no JSON to render):
- `source_kind`, `pdf_url`, `pdf_filename`, `pdf_size_bytes`

Storage: reuse existing public `attachments` bucket under prefix `fitness-templates/{branch_id}/{uuid}.pdf` (max 16 MB, mime `application/pdf` only — validated client-side).

### UI changes

**Templates page (`src/pages/fitness/Templates.tsx`)**
- Add "Source" filter chip: All · Structured · PDF.
- New button next to "Create Template": **"Upload PDF Template"** → opens right-side Sheet `UploadPdfTemplateDrawer`:
  - Fields: Name, Type (Diet/Workout), Goal, Difficulty, Description, PDF file (drag-drop).
  - On save: upload PDF to bucket, insert row with `source_kind='pdf'`.
- Template card shows a "PDF" badge when `source_kind='pdf'` plus a "Preview PDF" link.

**Create Mode Picker (`CreateModePicker.tsx`)**
- Add a third tile: **"From PDF Template"** → routes to a new `AssignPdfTemplate` step that lists `source_kind='pdf'` templates filtered by Diet/Workout, lets the trainer pick member(s), date range, then creates `member_fitness_plans` rows with the PDF reference (no structured days).

**Preview / Member view**
- `PreviewPlan.tsx` and member-side `MyDiet.tsx` / `MyWorkout.tsx`: when `source_kind='pdf'`, render an inline PDF embed + Download button + "Share via WhatsApp/Email" buttons (uses existing `sendPlanToMember` util — extend it to accept a direct `pdf_url` instead of generating a PDF from JSON).

**Assignment send flow**
- `utils/sendPlanToMember.ts`: branch on `source_kind`. For `pdf`, skip the HTML→PDF generation step and pass the existing `pdf_url` straight to `dispatch-communication` as the document attachment.

### Out of scope (explicitly)
- No PDF text extraction / OCR / AI parsing into structured plans (separate future feature).
- No per-day editing of PDF templates — they are immutable distributables; to revise, upload a new version.

### Files touched
- `supabase/migrations/<new>.sql` — column adds.
- `src/services/fitnessService.ts` — accept `source_kind`/`pdf_*` in template + plan CRUD; new `uploadTemplatePdf()` helper.
- `src/pages/fitness/Templates.tsx` — filter chip, Upload PDF button, badge.
- `src/components/fitness/UploadPdfTemplateDrawer.tsx` — new Sheet.
- `src/pages/fitness/CreateModePicker.tsx` — third tile.
- `src/pages/fitness/AssignPdfTemplate.tsx` — new screen (route added in `App.tsx`).
- `src/pages/fitness/PreviewPlan.tsx`, `src/pages/MyDiet.tsx`, `src/pages/MyWorkout.tsx` — PDF render branch.
- `src/utils/sendPlanToMember.ts` — direct-PDF branch.

### Verification
- Upload sample PDF as template → appears with PDF badge.
- Assign to test member → member portal shows embed + download.
- Send via WhatsApp → member receives the original PDF (not a regenerated one).
- Existing structured templates/plans continue to work unchanged (`source_kind` defaults to `'structured'`).
