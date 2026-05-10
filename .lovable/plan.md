## Audit findings

### 1) Equipment categorisation is too coarse
Current `equipment.category` is a single free-text string with only 7 generic buckets: `Cardio | Strength | Free Weights | Machines | Functional | Recovery | Other` (`AddEquipmentDrawer.tsx`). The AI plan generator (`generate-fitness-plan`) receives this list verbatim via `availableEquipment`. With no muscle-group / body-part metadata, the model cannot reason "the member needs core work → use ab crunch machine" or "leg day → leg press, hack squat". It only sees a name + a vague category.

Result: AI either ignores the equipment list or maps it inconsistently. A trainer-grade plan needs to know what each machine *trains*, not just what shape it has.

### 2) Common (no-PT) plans have zero segmentation
`fitness_plan_templates` exposes only `is_common: boolean`, `difficulty`, `goal`. There is no targeting on:

- Age band (teen / 18–30 / 30–45 / 45–60 / 60+)
- Weight / BMI band
- Gender (some plans are gender-specific)
- Experience level (mapped today to `difficulty` — fine)
- Duration (weeks) or weekly frequency (days/week)
- Primary goal taxonomy (today free-text)

So one "Common" plan is shown to everyone regardless of a 22-year-old male athlete vs a 55-year-old female beginner. There is also no matcher that picks the best common plan for a member — the trainer must eyeball it.

---

## Proposed changes

### Part A — Equipment muscle-group taxonomy

**Schema** (single migration):

- Add to `equipment`:
  - `primary_category text` — broader, controlled vocab: `cardio | strength_machine | free_weight | cable | functional | bodyweight | recovery | accessory`
  - `muscle_groups text[]` — controlled vocab list, multi-select: `chest, back_lats, back_traps, shoulders, biceps, triceps, forearms, core_abs, core_obliques, lower_back, glutes, quads, hamstrings, calves, hip_adductors, hip_abductors, full_body, cardio_lower, cardio_upper`
  - `movement_pattern text` — `push | pull | squat | hinge | lunge | carry | rotation | gait | isolation | mobility` (optional)
  - GIN index on `muscle_groups` for fast filtering.
- Backfill: copy existing `category` into `primary_category` where it maps, leave `muscle_groups` empty for trainer to enrich.
- Keep legacy `category` column for back-compat; deprecate in UI.

**UI** (`AddEquipmentDrawer.tsx` + Equipment list filters):

- Replace single Category select with three controls: Primary Category (select), Muscle Groups (multi-select chips), Movement Pattern (select, optional).
- Equipment list page: add filter chips for muscle group, show coloured chips on each equipment row.
- Edit drawer prefills both new fields.

**AI hand-off** (`equipmentService.ts → fetchOperationalEquipmentLite`, `generate-fitness-plan/index.ts`):

- `EquipmentLite` gains `muscle_groups` and `movement_pattern`.
- System prompt updated to: "Prefer the listed equipment. Each item lists which muscles it trains; map each exercise to one item and respect muscle-group coverage across the week (e.g., balance push/pull, include 1–2 dedicated core sessions)."

### Part B — Common Plan segmentation + auto-matcher

**Schema** (same migration):

Add to `fitness_plan_templates`:

- `target_age_min int`, `target_age_max int` — nullable, both null = any age.
- `target_gender text` — `any | male | female` (default `any`).
- `target_weight_min_kg numeric`, `target_weight_max_kg numeric` — nullable.
- `target_bmi_min numeric`, `target_bmi_max numeric` — nullable (alternative to weight).
- `target_goal text` — controlled: `weight_loss | muscle_gain | endurance | general_fitness | flexibility | recomposition` (mirrors `ALL_GOALS` in `healthQuestions.ts`).
- `target_experience text[]` — subset of `beginner | intermediate | advanced` (defaults to all if null).
- `duration_weeks int`, `days_per_week int` — for sorting/filtering.
- Index: `(is_common, type, target_goal)` partial WHERE `is_common`.

**Matcher** — DB function `match_common_plans(p_member_id uuid, p_type text)` returning ranked rows:

```text
score = (gender match? +30)
      + (age in band? +25, else 0)
      + (weight or bmi in band? +20)
      + (goal exact? +15, partial via goal-family map +8)
      + (experience match? +10)
      + recency tiebreaker (created_at)
```

Returns top 5 candidates. RLS: same as templates table.

**UI**:

1. **Template editor (`AssignPlanDrawer` + a new `EditTemplateMetaDrawer`)** — when `Mark as Common Plan` is on, expand to show:
   - Age range slider (10–80)
   - Weight range slider (30–150 kg)
   - Gender radio
   - Goal select (uses `ALL_GOALS`)
   - Experience multi-chip
   - Duration weeks + days/week steppers

2. **Templates page (`pages/fitness/Templates.tsx`)** — Common chips already exist. When "Common" filter is on, group cards by `target_goal`, and show the audience metadata as small badges (e.g. `18–30 · ♀ · Weight Loss · 4w · 4d/wk`).

3. **Member assign flow** — new "Recommend Common Plans" tab inside `AssignPlanDrawer`: when staff opens assign for a non-PT member, call `match_common_plans` and show the top 3 with a match-score bar; one click assigns.

4. **Member portal (`MemberPlans.tsx`)** — if no active plan, show "Suggested for you" carousel powered by the matcher (read-only assign request that the trainer approves).

### Part C — Cleanup & telemetry

- Update `systemTemplates` seed (if any) with sensible audience metadata.
- Add an analytics event `common_plan_matched` to track recommendation click-through.
- Docs: extend `mem://features/...` with the new common-plan targeting model so future generations respect it.

---

## Technical details (file map)

```text
DB migration (single file):
  - ALTER equipment ADD primary_category, muscle_groups text[], movement_pattern
  - ALTER fitness_plan_templates ADD target_age_min/max, target_gender,
    target_weight_min/max_kg, target_bmi_min/max, target_goal,
    target_experience text[], duration_weeks, days_per_week
  - CREATE FUNCTION match_common_plans(uuid, text)
  - GIN idx on equipment.muscle_groups
  - Partial idx on common templates

Frontend:
  src/services/equipmentService.ts          (extend Equipment, EquipmentLite)
  src/components/equipment/AddEquipmentDrawer.tsx
  src/pages/EquipmentMaintenance.tsx        (filter chips, badges)
  src/services/fitnessService.ts            (add fetchMatchedCommonPlans)
  src/components/fitness/AssignPlanDrawer.tsx (audience metadata fields)
  src/components/fitness/CommonPlanRecommendationsPanel.tsx (new)
  src/pages/fitness/Templates.tsx            (audience badges + group by goal)
  src/pages/MemberPlans.tsx                  (Suggested for you)
  src/lib/registration/healthQuestions.ts    (export GOAL_FAMILY map)

Edge:
  supabase/functions/generate-fitness-plan/index.ts
    - System prompt: include muscle_groups per equipment item
    - Type: EquipmentLite + muscle_groups + movement_pattern
    - Validate AI output: each exercise references an equipment item OR is bodyweight
```

## Out of scope (call out)
- We will NOT auto-assign common plans without staff approval (safety).
- We will NOT change PT-led plan flows.
- We will NOT migrate legacy free-text `category` data destructively — keep column, mark deprecated.
