## Goal

Backfill the 77 equipment rows with correct `primary_category`, `muscle_groups`, and `movement_pattern` based on a careful audit of each **machine name** (ignoring brand/model), and update the AI workout generator so it never references brand or model numbers — only the clean machine name.

Currently 71/77 rows are missing `movement_pattern` and 68/77 are missing `muscle_groups`. A few existing values are also wrong (e.g. Hip Thrust tagged as `hip_adductors push` instead of `glutes hinge`).

## Part 1 — DB backfill (single migration)

Updates by `id` so duplicate-name rows are safe. Accessories (benches, racks, plate trees) intentionally keep `muscle_groups=[]` and `movement_pattern=NULL` — they don't train muscles directly. Categories will also be corrected where wrong (e.g. Lat Pulldown was `accessory` → `strength_machine`).

Audited mapping (taxonomy values from `src/lib/equipment/taxonomy.ts`):

```text
4 Stack Multi Wrist Curl        strength_machine  [forearms]                    isolation
Altnerate Bicep Curling         strength_machine  [biceps]                      pull
Alternate leg curling           strength_machine  [hamstrings]                  isolation
Alternate leg extension         strength_machine  [quads]                       isolation
BB 3D Multi Abductor            strength_machine  [hip_abductors]               isolation
BB Platinum V4 Hip Thrust       strength_machine  [glutes]                      hinge   (fix)
BB Reverse Lunge Machine        strength_machine  [glutes,quads,hamstrings]     lunge
BB Selectorized Back Extension  strength_machine  [lower_back,glutes]           hinge   (fix)
BB Selectorized Hip Abductor    strength_machine  [hip_abductors]               isolation
BB Split Squat & Deadlift       strength_machine  [glutes,quads,hamstrings]     squat
Cable Crossover                 cable             [chest]                       push
CHEST FLY & PEC DECK COMBO      strength_machine  [chest]                       isolation (fix cat)
CHEST FLY PANATTA               strength_machine  [chest]                       isolation
Chin and dip counterbalanced    strength_machine  [back_lats,chest,triceps]     pull    (fix cat)
Curve treadmills                cardio            [cardio_lower]                gait
Dips press dual system          strength_machine  [chest,triceps,shoulders]     push    (fix cat)
FRONT DORSY BAR                 strength_machine  [back_lats]                   pull    (fix cat)
Hack Squat                      strength_machine  [quads,glutes]                squat
Lat pulldown                    strength_machine  [back_lats,biceps]            pull    (fix cat)
LCD Climber                     cardio            [cardio_lower]                gait
LCD Elliptical                  cardio            [full_body]                   gait
LED Elliptical                  cardio            [full_body]                   gait
Leg extension                   strength_machine  [quads]                       isolation (fix cat)
Panatta Back 2 Deltoids         strength_machine  [shoulders]                   pull    (fix cat)
PANATTA BACK DELTOIDS           strength_machine  [shoulders]                   pull
Panatta Super Lower Chest Flight strength_machine [chest]                       push    (fix cat)
Peck back (Pec deck rear)       strength_machine  [shoulders,back_traps]        pull    (fix cat)
Power Smith Machine Dual        functional        [full_body]                   squat   (fix cat)
Pulley row                      cable             [back_lats,back_traps]        pull    (fix cat)
Roman Chair                     accessory         [lower_back,core_abs]         hinge
Single Twister                  accessory         [core_obliques]               rotation
Skiing machine                  cardio            [full_body]                   pull
Smith Machine                   functional        [full_body]                   squat   (keep)
Spinning Bike (x4)              cardio            [cardio_lower]                gait
Stair Master                    cardio            [cardio_lower]                gait
Standing Bentover Row           strength_machine  [back_lats,back_traps]        pull    (fix cat)
Standing Total Arms             strength_machine  [biceps,triceps,forearms]     isolation (fix pattern)
Super declined chest press      strength_machine  [chest,triceps]               push    (fix cat)
SUPER DELTOID PRESS             strength_machine  [shoulders,triceps]           push    (fix cat)
SUPER HORIZONTAL MULTI PRESS    strength_machine  [chest,triceps]               push    (fix cat)
Super inclined bench press      strength_machine  [chest,shoulders,triceps]     push    (fix cat)
SUPER LAT MACHINE CONVERGENT    strength_machine  [back_lats]                   pull    (fix cat)
SUPER LAT PULLDOWN CIRCULAR     strength_machine  [back_lats]                   pull    (fix cat)
SUPER LEG PRESS 45°             strength_machine  [quads,glutes,hamstrings]     squat   (fix cat)
SUPER PULLOVER MACHINE          strength_machine  [back_lats,chest]             pull    (fix cat)
SUPER ROWING CIRCULAR           strength_machine  [back_lats,back_traps]        pull    (fix cat)
Super seated calf               strength_machine  [calves]                      isolation (fix cat)
T-BAR ROW                       strength_machine  [back_lats,back_traps]        pull    (fix cat)
Total core crunch machine       strength_machine  [core_abs]                    isolation (fix cat)
Treadmill (x4)                  cardio            [cardio_lower]                gait
Vertical Knee Raise             strength_machine  [core_abs]                    isolation (fix pattern)
VERTICAL LEG PRESS              strength_machine  [quads,glutes]                squat   (fix cat)
Wind resistance rowing machine  cardio            [full_body]                   pull    (fix cat)
Functional Trainer              functional        [full_body]                   carry
```

Pure accessories (no muscle/pattern, just confirm `accessory`):
Adjustable Bench (×3), Adjustable Web Board, Dumbell Rack-3 Tier (×2), Olympic Decline/Flat/Incline Bench, Power rack, Rotating dumbbell rack (×2), Scott Bench (×2), Utility Bench, Weight Plate Tree (×2).

## Part 2 — AI prompt cleanup

`supabase/functions/generate-fitness-plan/index.ts` line ~196–205: the equipment list currently appends `— {brand} {model}` to each line, which leaks brand/model into the AI's context and into generated exercise names. 

Change:
- Drop the `brand`/`model` suffix entirely.
- Strengthen the instruction: *"Use ONLY the clean machine name in the `exercise` field — never include brand names, model codes, SKUs, or numbers like FW2035 / PT-101 / 1FW044."*
- Bump version comment to `// v1.1.0 — equipment prompt: machine name only`.

No other files need to change — the `Exercises` UI already displays the user-entered equipment name only.

## Files

- `supabase/migrations/<new>.sql` — one UPDATE per audited row, keyed by id
- `supabase/functions/generate-fitness-plan/index.ts` — strip brand/model from prompt, tighten instruction

## Out of scope

- Renaming equipment rows (names like "Altnerate Bicep Curling" with typos). Not requested; user only asked for category/movement backfill + AI naming hygiene.
- Deduplicating obvious duplicates (4× Treadmill, 3× Adjustable Bench). Likely intentional (one row per physical unit for maintenance).
