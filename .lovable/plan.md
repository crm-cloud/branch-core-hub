
## Goal

1. Let staff generate **Common (no-PT) plans** without picking a member — driven by audience (age, gender, goal, experience, optional weight/BMI).
2. Collapse `CreateManualWorkout` + `CreateManualDiet` into a single **Manual Builder** with a workout/diet toggle.
3. Remove leftover/duplicate fitness files to eliminate confusion.

---

## Part A — Common Plan flow in `CreateAI`

Add an **Audience tab** at the top of `CreateAI.tsx`, replacing the current single-mode form with two modes:

```
[ Member-specific ]   [ Common (no PT) ]
```

### Member-specific mode
Unchanged — current member picker + profile card on the right.

### Common (no PT) mode
- Hide the member picker and right-side member profile card.
- Show an **Audience card** in the right column instead, with required fields:
  - Plan Name *
  - Type * (Workout / Diet — same toggle)
  - Primary Goal * (existing enum: weight_loss / muscle_gain / endurance / general_fitness / flexibility / recomposition)
  - Duration (weeks) * + Days/week *
  - Age band * (min/max)
  - Gender * (any / male / female)
  - Experience * (multi: beginner / intermediate / advanced)
- Optional: Weight band (kg), BMI band, Cuisine + Dietary type (diet only), Equipment hint, Special notes.
- "Generate Plan" button calls the same `generate-fitness-plan` edge function but builds a synthetic `memberInfo` from the audience (mid-band age/weight, goal, experience). No member-history / previous-plan context.

### After generation
Routes to the existing `PreviewPlan` page. The draft carries `audience` + `is_common: true`. The "Save as template" button on Preview now persists `is_common = true` plus all targeting fields (`target_age_min/max`, `target_gender`, `target_goal`, `target_experience`, `duration_weeks`, `days_per_week`, optional weight/BMI bands) so the new template immediately appears under **Plan Templates → Common (no PT)** and is matched by `match_common_plans` RPC. "Assign to member" stays available but is optional.

### CreateModePicker
Update the "AI-Generated Plan" card to mention both modes and add a secondary CTA "Generate Common Plan" that deep-links to `/fitness/create/ai?mode=common`.

---

## Part B — Merge manual builders

Create `src/pages/fitness/CreateManual.tsx` that hosts a `Tabs` for Workout / Diet and renders the existing per-type editor sections (lifted from `CreateManualWorkout.tsx` and `CreateManualDiet.tsx` into two child components inside `src/components/fitness/create/manual/`):
- `ManualWorkoutEditor.tsx`
- `ManualDietEditor.tsx`

Single page handles `?template=`, `?draft=`, `?edit=1`, `?mode=common`. URL param `?type=workout|diet` selects the initial tab.

Routing changes in `src/App.tsx`:
- New: `/fitness/create/manual` → `CreateManual` (with `?type=workout|diet`)
- Old paths `/fitness/create/manual/workout` and `/fitness/create/manual/diet` → 301-style `<Navigate>` to the new route preserving query params (so existing template "Edit" buttons keep working).

Update all internal links (`Templates.tsx`, `PreviewPlan.tsx`, `CreateModePicker.tsx`) to the new unified path.

Delete after migration:
- `src/pages/fitness/CreateManualWorkout.tsx`
- `src/pages/fitness/CreateManualDiet.tsx`

---

## Part C — Cleanup of dead/duplicate files

Audit and remove (after grep confirms no references):
- `src/lib/planDraft.ts` — keep (still used).
- Confirm `src/services/workoutShufflerService.ts` already gone (was deleted earlier).
- Verify `MyWorkout.tsx` / `MyDiet.tsx` / `MemberPlans.tsx` member-side pages are still wired — keep.
- Look for stale `templates`-related helpers, ghost imports, or unused `ai_plan_logs`-era references and remove.

A short cleanup pass at the end: `rg` for any imports pointing to removed files and fix.

---

## Part D — Service / DB

`createPlanTemplate` already accepts `is_common`. Extend it to also accept the audience-targeting fields so Preview's "Save as template" can persist them in one call (no extra `updateTemplateTargeting` round-trip when coming from the Common flow).

No DB migration needed — columns exist from the prior round.

---

## Files touched

**New**
- `src/pages/fitness/CreateManual.tsx`
- `src/components/fitness/create/manual/ManualWorkoutEditor.tsx`
- `src/components/fitness/create/manual/ManualDietEditor.tsx`
- `src/components/fitness/create/AudienceCard.tsx` (right-column form for Common mode)

**Edited**
- `src/pages/fitness/CreateAI.tsx` — add mode toggle + audience flow
- `src/pages/fitness/CreateModePicker.tsx` — add "Generate Common Plan" CTA
- `src/pages/fitness/PreviewPlan.tsx` — pass audience + is_common when saving template
- `src/pages/fitness/Templates.tsx` — link Edit/Use buttons to `/fitness/create/manual`
- `src/lib/planDraft.ts` — add optional `audience` + `isCommon` fields
- `src/services/fitnessService.ts` — extend `createPlanTemplate` with targeting fields
- `src/App.tsx` — new route + redirects

**Deleted**
- `src/pages/fitness/CreateManualWorkout.tsx`
- `src/pages/fitness/CreateManualDiet.tsx`
- any unreferenced helpers found during cleanup pass

---

## Out of scope
- No DB schema changes (audience columns already exist).
- No changes to `generate-fitness-plan` edge function logic — only the client payload differs.
- Member-side pages (`MyWorkout`, `MyDiet`) untouched.
