# AI Plan Generation — Workout Inputs & Working Edit

Two fixes for the AI plan flow at `/fitness/create/ai` and `/fitness/preview/:id`.

## 1. Workout-relevant inputs (hide diet fields when type=Workout)

**File:** `src/components/fitness/create/MemberProfileCard.tsx`

- Add prop `planType: 'workout' | 'diet'`.
- When `planType === 'workout'`:
  - Hide **Dietary Preference**, **Cuisine**, and **Allergies** fields (those belong to diet).
  - Add a new **Workout Activities** multi-select (chip toggle group) with options:
    - Cardio, Warm Up, Functional Training, CrossFit, Dynamic Stretching, Mobility, Plyometrics, Strength, HIIT
  - Stored on the overrides object as `workout_activities: string[]`.
- When `planType === 'diet'`: keep existing fields, hide workout activities.

**File:** `src/pages/fitness/CreateAI.tsx`

- Pass `planType={type}` to `<MemberProfileCard />`.
- Remove the `dietRequirementsMet` gating for workout (already gated to diet — no change needed in logic, only confirm).
- Append `workout_activities` to the AI `preferences` string when type=workout, e.g. `"include: cardio, warm up, functional training, dynamic stretching"` so the AI structures each session warm-up → main → stretch.

## 2. "Edit before assign" actually loads the generated plan

**Problem:** Preview's `Edit` button routes AI drafts back to `/fitness/create/ai`, which has no draft-hydration logic — the form is blank.

**Fix:** Route AI-generated drafts to the **manual builder** preloaded with the draft content, so the user can rearrange/add/remove exercises (or meals) and resave.

**File:** `src/pages/fitness/PreviewPlan.tsx`

- Change `editPath` for `source==='ai'`:
  - workout → `/fitness/create/manual/workout?draft=<planId>`
  - diet → `/fitness/create/manual/diet?draft=<planId>`

**File:** `src/pages/fitness/CreateManualWorkout.tsx`

- Read `?draft=` searchParam. When present, call `loadDraft(planId)`, run `normalizeWorkoutPlan(draft.content)` and hydrate: `planName`, `description`, `difficulty`, `goal`, `member` (from `memberId/memberName/memberCode`), and `days` (week 1).
- On save, if `draft` param present, **overwrite the same draft** via `saveDraft({ ...existing, content: rebuiltPlan, name, description })` and `navigate(\`/fitness/preview/${planId}\`)` instead of creating a new draft.

**File:** `src/pages/fitness/CreateManualDiet.tsx`

- Mirror the same `?draft=` hydration + save-back behaviour using `normalizeDietPlan`.

## Acceptance

- For Yogita's workout AI flow: Dietary Preference / Cuisine / Allergies fields are gone; a Workout Activities chip group appears; AI prompt receives those activities.
- Clicking **Edit before assign** on the preview opens the manual workout builder fully populated with the generated weeks/days/exercises; user can drag/edit; **Save** returns to preview with the updated draft.
- Diet plans behave identically (manual diet builder loads the AI draft).
- No backend/db changes; `members.workout_activities` is plan-scoped only (not persisted to member profile in this iteration).

## Out of scope

- Saving workout activities permanently to `members` table (can add in a follow-up via a `workout_activities text[]` column + Save-to-profile checkbox).
- Drag-and-drop reordering UI polish — the existing manual builder's add/remove/reorder controls are reused as-is.
