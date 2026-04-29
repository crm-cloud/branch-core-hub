## Root-Cause Audit

I dug into the schema, services, and pages. Here is what is actually broken vs. what just needs polish.

### 1. Critical bug: "No Member Plans Assigned" (count 2 vs page empty)

The KPI strip on the Diet & Workout hub correctly counts **2 plans** because assignments are written to `public.member_fitness_plans` (verified in DB — 2 rows exist). However, `src/pages/fitness/MemberPlans.tsx` queries the **wrong table** (`diet_plans`, which has 0 rows and is a legacy table). So the listing always renders the empty state.

```text
Templates "Assign" → assignPlanToMembers() → INSERT member_fitness_plans  ✅
KPI counter           → SELECT count(member_fitness_plans)                ✅
Member Plans page     → SELECT diet_plans  ❌  (wrong table, no joins, no template_id)
```

`MyDiet.tsx` already reads `member_fitness_plans` first (with a legacy `diet_plans` fallback) and `MyWorkout.tsx` reads `member_fitness_plans` — so members will see assigned plans **once we fix the listing query**. The "missing plans on member dashboard" symptom is the same bug surfaced from a different role: the hub page lies, not the member page.

Three legacy tables are still in the schema but have **0 rows** and no writer code paths: `diet_plans`, `workout_plans`, `diet_templates`, `workout_templates`. They are dead weight that confuses the team — we keep `diet_plans` read-fallback in `MyDiet.tsx` only.

### 2. "No members found" inside Assign drawer

`searchMembersForAssignment()` calls the `search_members` RPC and then filters with `m.member_status === 'active'`. The RPC returns `member_status` only when a profile/member row exists and is marked active — inactive, frozen, or members in branches outside the active scope are silently dropped. Combined with the 2-character minimum, trainers searching by partial code/name often get an empty list. We will:
- Lower minimum to 1 character.
- Stop hard-filtering on `active` (show frozen/expired with a muted badge — assignment is still valid).
- Pass `branchId` through (currently `undefined` from Templates page → all-branch search).

### 3. Templates / Member Plans / Meal Catalog buttons

- **Templates**: Saved templates already have Assign / Download PDF / Use as starter / Edit / Delete. Built-in "Default Starter Plans" cards only have **Assign** — no View, no Download, no Use-as-starter. We will add those.
- **Member Plans**: zero action buttons today. We will add **View**, **Send PDF (WhatsApp)**, **Send PDF (Email)**, **Download**, **Reassign/Edit**.
- **Meal Catalog**: has Edit + Delete but no **View** (read-only macros + photo) — we will add it as a side sheet.

### 4. WhatsApp & Email with PDF attachments

`utils/pdfGenerator.ts` already produces a styled PDF for plans (916 lines, supports both workout & diet). `utils/whatsappDocumentSender.ts` exists. What's missing:
- A `whatsappDocumentSender` call wired into Member Plans / Templates rows.
- A new edge function `send-plan-pdf` that: generates the PDF (or accepts a base64 from client), uploads to a `plan-attachments` storage bucket, then dispatches via WhatsApp document message + email attachment using existing template engine.
- Two seeded **system templates** (`plan_assigned_workout`, `plan_assigned_diet`) with `header_type='document'` and `attachment_source='dynamic'` (uses the new template attachment fields we already migrated last turn).

### 5. Duplicate / dead code to clean up

- Delete legacy reads of `diet_plans` / `workout_plans` from any non-member page (verified usage list: only `MyDiet` legacy fallback should remain).
- Two near-identical members-list queries in `Templates.tsx` shuffled-card flow and `AssignPlanDrawer` — consolidate into `searchMembersForAssignment`.
- `FitnessHubTabs` is fine; no duplicates there.

---

## Implementation Plan

### A. Fix the data layer (highest priority)

1. **`src/pages/fitness/MemberPlans.tsx`** — rewrite the query to:
   - `from('member_fitness_plans')` joined to members → profiles for name/avatar/code.
   - Pull `template_id → fitness_plan_templates(name)` and `created_by → profiles(full_name)` (trainer).
   - Filter by active branch (BranchContext) and date validity (`valid_until >= today` OR null).
   - Tabs: **Active**, **Expired**, **All**. Filter chips: **Workout / Diet / Both**.

2. **`src/services/fitnessService.ts`** — add helpers:
   - `fetchMemberAssignments(branchId, { type, status, search })`.
   - `revokeMemberAssignment(id)` (soft-delete by setting `valid_until = today`).
   - `resendPlanNotification(planId, channels)` — reuses `sendOneNotification`.

3. **`searchMembersForAssignment`** — drop the active-only filter, allow 1-char queries, return status badge so the UI can dim non-active members.

### B. PDF + WhatsApp/Email send pipeline

4. **Storage**: create `plan-attachments` bucket (private, signed URLs).
5. **Edge function `send-plan-pdf`**: input `{ member_id, plan_id, channels: ['whatsapp','email'] }`. Steps:
   - Load plan from `member_fitness_plans`.
   - Render PDF on the server using the existing HTML template (port `pdfGenerator` snippet to a Deno-compatible HTML→PDF via `puppeteer-core` is too heavy — instead generate the PDF on the **client** via `generatePlanPDF`, upload as base64, and pass the storage path to the function). This keeps the function light and reuses our tested generator.
   - Dispatch WhatsApp document via `send-whatsapp` (`message_type='document'`, `media_url=signedUrl`).
   - Dispatch email via `send-email` with attachment.
   - Log to `whatsapp_messages` + `email_logs`.

6. **Two seeded templates** in `public.templates` (idempotent migration):
   - `plan_assigned_workout` (channel: whatsapp + email), `header_type=document`, `attachment_source=dynamic`, body has `{{member_name}}`, `{{plan_name}}`, `{{trainer_name}}`, `{{valid_until}}`.
   - `plan_assigned_diet` — same shape, diet wording.

7. **AssignPlanDrawer** — add a `Send PDF on assign` toggle. When on, after `assignPlanToMembers` resolves, it loops the new `plan_id`s and calls `send-plan-pdf` per member.

### C. Member-Plans hub UI/UX overhaul (Vuexy aesthetic)

8. New layout in `MemberPlans.tsx`:

```text
┌─ KPIs (gradient hero strip) ───────────────────────────┐
│ Active Workouts │ Active Diets │ Expiring 7d │ Members │
└────────────────────────────────────────────────────────┘
┌─ Filters: [Search] [Workout|Diet|Both] [Active|Expired|All] [Trainer] ┐
└──────────────────────────────────────────────────────────────────────┘
┌─ Cards grid (rounded-2xl, soft shadow) ────────────────┐
│ Avatar  Member Name (code)        [Active badge]       │
│ Plan: 4-week Muscle Gain  ·  workout                   │
│ Trainer: Coach A · From 22 Apr → 20 May (28d left)    │
│ Linked to template: Beginner Full Body                 │
│ [View] [Download PDF] [WhatsApp] [Email] [⋯]           │
└────────────────────────────────────────────────────────┘
```

9. **Plan Viewer Sheet** (right-side, per Vuexy rule):
   - Workout: week-by-week accordion with sets/reps/rest, embedded exercise videos when present.
   - Diet: meal-by-meal cards with macros bar, Shopping List button, swap history.
   - Sticky footer: Download PDF / Send WhatsApp / Send Email / Reassign / Revoke.

### D. Templates + Meal Catalog polish

10. **Templates page**:
    - Add **View** + **Download PDF** + **Use as starter** to **Default Starter Plans** cards.
    - Animate cards (staggered fade-up on mount via `framer-motion` already used elsewhere).
    - Hero KPI strip already exists — wire `Member Assignments` to the corrected count.

11. **Meal Catalog**:
    - Add **View Meal** sheet (read-only photo, macros chart, ingredients).
    - Add filters: cuisine chip strip + dietary-type chip strip with live counts.
    - Add a "Used in N diet plans" badge per meal.

### E. Cleanup

12. Delete unused legacy reads (none found outside `MyDiet` fallback). Add `// LEGACY` comment to that one path.
13. Add a Supabase migration that **comments** the dead tables (`COMMENT ON TABLE diet_plans IS 'DEPRECATED — use member_fitness_plans'`) — we don't drop them yet to avoid breaking any historical export.
14. Update `mem://architecture/deprecated-schema-items` with the legacy fitness tables.

---

## Files to change

- `src/pages/fitness/MemberPlans.tsx` — full rewrite (query + UI).
- `src/pages/fitness/Templates.tsx` — built-in card actions + view sheet.
- `src/pages/MealCatalog.tsx` — view sheet + filters + usage badge.
- `src/services/fitnessService.ts` — new `fetchMemberAssignments`, `revokeMemberAssignment`, relax search.
- `src/components/fitness/AssignPlanDrawer.tsx` — "Send PDF on assign" toggle.
- `src/components/fitness/PlanViewerSheet.tsx` — **new**, shared by Templates + Member Plans.
- `src/components/fitness/SendPlanPdfMenu.tsx` — **new**, dropdown for WhatsApp/Email/Download.
- `supabase/functions/send-plan-pdf/index.ts` — **new** edge function.
- Migration: create `plan-attachments` bucket + RLS, seed two templates, add deprecation comments.

## Out of scope (flag for later)

- Dropping `diet_plans`/`workout_plans`/`diet_templates`/`workout_templates` — defer until next cleanup window.
- Multi-language PDF rendering — current generator is English-only.
- AI-generated PDF cover image — nice-to-have, not blocking.
