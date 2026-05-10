## Audit Result

The active fitness data model is just two tables:

- `fitness_plan_templates` — all templates (workout + diet, system + branch)
- `member_fitness_plans` — every plan assigned to a member (workout + diet, AI + manual)

Everything else listed is legacy from an earlier dual-table design. All have **0 rows** in production:

| Table | Status | Why it exists |
|---|---|---|
| `workout_plans` | DEPRECATED (already commented in migration `20260429165510`) | superseded by `member_fitness_plans` |
| `workout_templates` | DEPRECATED | superseded by `fitness_plan_templates` |
| `diet_templates` | DEPRECATED | superseded by `fitness_plan_templates` |
| `ai_plan_logs` | UNUSED | no code reads or writes it |
| `exercises` | UNUSED in real flow | only powers the dead "Shuffle Today's Workout" tab in `MyWorkout.tsx`, which always renders empty because the table has 0 rows |

`diet_plans` is in the same legacy bucket (0 rows, only legacy fallback reads), but you didn't list it — see Question 1.

## Plan

### 1. Database migration — drop deprecated tables

Drop in this order (CASCADE handles RLS policies, indexes, triggers):

```
DROP TABLE IF EXISTS public.workout_plans      CASCADE;
DROP TABLE IF EXISTS public.workout_templates  CASCADE;
DROP TABLE IF EXISTS public.diet_templates     CASCADE;
DROP TABLE IF EXISTS public.ai_plan_logs       CASCADE;
DROP TABLE IF EXISTS public.exercises          CASCADE;
```

Also tighten the constraint that still allows the legacy source string:

```
ALTER TABLE public.member_workout_completions
  DROP CONSTRAINT member_workout_completions_plan_source_check,
  ADD  CONSTRAINT member_workout_completions_plan_source_check
       CHECK (plan_source = 'member_fitness_plans');
```

### 2. Frontend cleanup

- `src/components/fitness/member/MemberPlanProgressBlock.tsx` — remove the parallel `workout_plans` (and `diet_plans` if Q1=yes) reads; keep only `member_fitness_plans`. Drop `'workout_plans'`/`'diet_plans'` from the `source` union.
- `src/services/memberPlanProgressService.ts` — narrow `WorkoutPlanSource` / `DietPlanSource` to `'member_fitness_plans'` only.
- `src/pages/MyWorkout.tsx` — remove the "Today's Shuffle" tab and its query (it can never return data after dropping `exercises`). Keep the assigned-plan view powered by `member_fitness_plans`.
- `src/services/workoutShufflerService.ts` — delete file.
- `src/pages/MyDiet.tsx` — remove the legacy `diet_plans` fallback block (only if Q1=yes).

### 3. Edge function cleanup

- `supabase/functions/backup-export/index.ts` — remove `"exercises"`, `"diet_templates"`, `"workout_templates"`, `"workout_plans"`, `"ai_plan_logs"` from the export list (and `"diet_plans"` if Q1=yes).
- `supabase/functions/backup-import/index.ts` — same removals.

### 4. Verify

- Build passes (TS will catch any leftover refs once `src/integrations/supabase/types.ts` regenerates).
- Smoke-check `/fitness/templates`, `/fitness/member-plans`, `/my-workout`, `/my-diet`.
- Run linter on the migration.

## Reversibility

Schema for every dropped table is preserved in existing migration files (`20251220144111…`, `20251221051333…`), so re-creating later is a copy-paste if a real need shows up.

## One Question Before I Execute

See the chip below.
