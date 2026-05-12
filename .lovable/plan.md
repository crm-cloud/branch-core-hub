## Goal

On `/fitness/create/ai`, fix the duplicated/scattered "Days/week" + "Duration (weeks)" fields, make Days/week always available (not only audience mode), pass `daysPerWeek` to the AI generator, and add a new **Rotation interval (days)** control so the generated plan can auto-shuffle exercises/meals every N days (e.g. 10–15) for variety.

## Problem today

- `Days/week` only appears inside the **audience targeting** card (workout only).
- `Duration (weeks)` appears in the main "Plan Setup" area.
- For member-mode workouts, there's **no** Days/week input — AI guesses session count.
- `daysPerWeek` is stuffed into a free-text `preferences` string, never sent as a structured option to the edge function.
- No way to tell the AI "rotate the same routine every 12 days so members don't repeat the exact same session".

## Plan

### 1. Consolidate Days/week + Duration into one "Schedule & Rotation" row (CreateAI.tsx)

Replace the current scattered layout with a single 3-column row, always visible (both member + audience modes, workout only — diet keeps Calorie Target):

```
[ Days / week ]   [ Duration (weeks) ]   [ Rotate plan every (days) ]
   1–7              1–24                    off / 7 / 10 / 14 / 21
```

- Move `Days/week` out of the audience card. In audience mode keep the same state var (`audDaysPerWeek`) but in member mode introduce `daysPerWeek` (default 4) so member workouts also send it.
- Add new state `rotationIntervalDays` (default `0` = off). Dropdown options: Off, 7, 10, 14, 21, 30 + custom number.
- For diet plans, hide Days/week + Rotation, keep Duration + Calorie Target as today.

### 2. Wire new fields through to the AI generator

Update `handleGenerate` payload (`generate.mutateAsync`):

```ts
options: {
  durationWeeks,
  daysPerWeek,            // NEW — structured field
  rotationIntervalDays,   // NEW — 0 = no rotation
  caloriesTarget,
  availableMeals,
  availableEquipment,
  previousPlanContext,
}
```

Stop relying on the free-text `preferences: "${audDaysPerWeek} days/week"` hack.

### 3. Edge function — `supabase/functions/generate-fitness-plan/index.ts`

- Extend `GeneratePlanRequest` with `daysPerWeek?: number` and `rotationIntervalDays?: number`.
- Update the workout system/user prompt:
  - Hard-instruct: "Generate exactly **{daysPerWeek}** training days per week × **{durationWeeks}** weeks. Label rest days explicitly."
  - If `rotationIntervalDays > 0`:
    - Generate **N variant blocks** where `N = ceil(durationWeeks * 7 / rotationIntervalDays)` (cap at 4 to keep token cost sane).
    - Each variant must hit the same muscle groups / movement patterns but **swap exercises** (e.g. Barbell Bench → Dumbbell Press, Back Squat → Goblet Squat) so members don't repeat identical sessions.
    - Return them in a new `rotation` array on the plan: `rotation: [{ variantIndex, exercises: [...] }, ...]` plus a `rotationIntervalDays` field so the dashboard can pick the active variant by `floor(daysSinceStart / rotationIntervalDays) % rotation.length`.
- For diet plans, ignore rotation entirely.

### 4. Plan draft + preview

- `src/lib/planDraft.ts` — extend `PlanDraft` with `daysPerWeek?: number` and `rotationIntervalDays?: number`; persist on save.
- `src/pages/fitness/PreviewPlan.tsx` — show a small "Rotates every X days · Y variants" badge near plan name when rotation is active. (No layout overhaul; just a `<Badge>` line.)
- `src/components/fitness/AssignPlanDrawer.tsx` — already reads `getPlanDurationWeeks`; no change needed.

### 5. Audience save path

In the `audience: { ... }` object saved to draft, add `days_per_week: daysPerWeek` (single source) and drop the separate `audDaysPerWeek` state — both modes now share `daysPerWeek`.

## Out of scope

- No DB migration. `rotation` rides inside the existing plan JSON.
- No changes to manual plan builder or templates list UI beyond reading the new optional field.
- Member dashboard's "today's session" picker that consumes `rotation` can be a follow-up — this PR only ensures the data is generated and stored.

## Files to touch

- `src/pages/fitness/CreateAI.tsx` — UI consolidation, new state, payload.
- `supabase/functions/generate-fitness-plan/index.ts` — accept + use new fields, emit `rotation`.
- `src/lib/planDraft.ts` — extend type.
- `src/pages/fitness/PreviewPlan.tsx` — small rotation badge.

Estimated diff: ~150 lines, mostly in `CreateAI.tsx` and the edge function prompt.
