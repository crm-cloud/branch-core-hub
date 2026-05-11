
-- Backfill equipment categories, muscle groups, and movement patterns based on machine name audit.
-- Updates by name (covers duplicate physical units identically).

-- Strength machines
UPDATE public.equipment SET primary_category='strength_machine', muscle_groups=ARRAY['forearms'], movement_pattern='isolation' WHERE name='4 Stack Multi Wrist Curl';
UPDATE public.equipment SET primary_category='strength_machine', muscle_groups=ARRAY['biceps'], movement_pattern='pull' WHERE name='Altnerate Bicep Curling';
UPDATE public.equipment SET primary_category='strength_machine', muscle_groups=ARRAY['hamstrings'], movement_pattern='isolation' WHERE name='Alternate leg curling';
UPDATE public.equipment SET primary_category='strength_machine', muscle_groups=ARRAY['quads'], movement_pattern='isolation' WHERE name='Alternate leg extension';
UPDATE public.equipment SET primary_category='strength_machine', muscle_groups=ARRAY['hip_abductors'], movement_pattern='isolation' WHERE name='BB 3D Multi Abductor';
UPDATE public.equipment SET primary_category='strength_machine', muscle_groups=ARRAY['glutes'], movement_pattern='hinge' WHERE name='BB Platinum V4 Hip Thrust - Plate Loaded';
UPDATE public.equipment SET primary_category='strength_machine', muscle_groups=ARRAY['glutes','quads','hamstrings'], movement_pattern='lunge' WHERE name='BB Reverse Lunge Machine - Plate Loaded';
UPDATE public.equipment SET primary_category='strength_machine', muscle_groups=ARRAY['lower_back','glutes'], movement_pattern='hinge' WHERE name='BB Selectorized Back Extension - Pin Loaded';
UPDATE public.equipment SET primary_category='strength_machine', muscle_groups=ARRAY['hip_abductors'], movement_pattern='isolation' WHERE name='BB Selectorized Standing Hip Abductor - Pin Loaded';
UPDATE public.equipment SET primary_category='strength_machine', muscle_groups=ARRAY['glutes','quads','hamstrings'], movement_pattern='squat' WHERE name='BB Split Squat & Deadlift - Pin Loaded';
UPDATE public.equipment SET primary_category='cable', muscle_groups=ARRAY['chest'], movement_pattern='push' WHERE name='Cable Crossover';
UPDATE public.equipment SET primary_category='strength_machine', muscle_groups=ARRAY['chest'], movement_pattern='isolation' WHERE name='CHEST FLY & PEC DECK COMBO MACHINE';
UPDATE public.equipment SET primary_category='strength_machine', muscle_groups=ARRAY['chest'], movement_pattern='isolation' WHERE name='CHEST FLY PANATTA';
UPDATE public.equipment SET primary_category='strength_machine', muscle_groups=ARRAY['back_lats','chest','triceps'], movement_pattern='pull' WHERE name='Chin and dip counterbalanced';
UPDATE public.equipment SET primary_category='cardio', muscle_groups=ARRAY['cardio_lower'], movement_pattern='gait' WHERE name='Curve treadmills';
UPDATE public.equipment SET primary_category='strength_machine', muscle_groups=ARRAY['chest','triceps','shoulders'], movement_pattern='push' WHERE name='Dips press dual system';
UPDATE public.equipment SET primary_category='strength_machine', muscle_groups=ARRAY['back_lats'], movement_pattern='pull' WHERE name='FRONT DORSY BAR';
UPDATE public.equipment SET primary_category='functional', muscle_groups=ARRAY['full_body'], movement_pattern='carry' WHERE name='Functional Trainer';
UPDATE public.equipment SET primary_category='strength_machine', muscle_groups=ARRAY['quads','glutes'], movement_pattern='squat' WHERE name='Hack Squat';
UPDATE public.equipment SET primary_category='strength_machine', muscle_groups=ARRAY['back_lats','biceps'], movement_pattern='pull' WHERE name='Lat pulldown';
UPDATE public.equipment SET primary_category='cardio', muscle_groups=ARRAY['cardio_lower'], movement_pattern='gait' WHERE name='LCD Climber';
UPDATE public.equipment SET primary_category='cardio', muscle_groups=ARRAY['full_body'], movement_pattern='gait' WHERE name='LCD Elliptical';
UPDATE public.equipment SET primary_category='cardio', muscle_groups=ARRAY['full_body'], movement_pattern='gait' WHERE name='LED Elliptical';
UPDATE public.equipment SET primary_category='strength_machine', muscle_groups=ARRAY['quads'], movement_pattern='isolation' WHERE name='Leg extension';
UPDATE public.equipment SET primary_category='strength_machine', muscle_groups=ARRAY['shoulders'], movement_pattern='pull' WHERE name='Panatta Back 2 Deltoids';
UPDATE public.equipment SET primary_category='strength_machine', muscle_groups=ARRAY['shoulders'], movement_pattern='pull' WHERE name='PANATTA BACK DELTOIDS 1FW026';
UPDATE public.equipment SET primary_category='strength_machine', muscle_groups=ARRAY['chest'], movement_pattern='push' WHERE name='Panatta Super Lower Chest Flight Machine';
UPDATE public.equipment SET primary_category='strength_machine', muscle_groups=ARRAY['shoulders','back_traps'], movement_pattern='pull' WHERE name='Peck back';
UPDATE public.equipment SET primary_category='functional', muscle_groups=ARRAY['full_body'], movement_pattern='squat' WHERE name='Power Smith Machine Dual System';
UPDATE public.equipment SET primary_category='cable', muscle_groups=ARRAY['back_lats','back_traps'], movement_pattern='pull' WHERE name='Pulley row';
UPDATE public.equipment SET primary_category='accessory', muscle_groups=ARRAY['lower_back','core_abs'], movement_pattern='hinge' WHERE name='Roman Chair';
UPDATE public.equipment SET primary_category='accessory', muscle_groups=ARRAY['core_obliques'], movement_pattern='rotation' WHERE name='Single Twister';
UPDATE public.equipment SET primary_category='cardio', muscle_groups=ARRAY['full_body'], movement_pattern='pull' WHERE name='Skiing machine';
UPDATE public.equipment SET primary_category='functional', muscle_groups=ARRAY['full_body'], movement_pattern='squat' WHERE name='Smith Machine';
UPDATE public.equipment SET primary_category='cardio', muscle_groups=ARRAY['cardio_lower'], movement_pattern='gait' WHERE name IN ('Spinning Bike','Spinning Bike ');
UPDATE public.equipment SET primary_category='cardio', muscle_groups=ARRAY['cardio_lower'], movement_pattern='gait' WHERE name='Stair Master';
UPDATE public.equipment SET primary_category='strength_machine', muscle_groups=ARRAY['back_lats','back_traps'], movement_pattern='pull' WHERE name='Standing Bentover Row';
UPDATE public.equipment SET primary_category='strength_machine', muscle_groups=ARRAY['biceps','triceps','forearms'], movement_pattern='isolation' WHERE name='Standing Total Arms';
UPDATE public.equipment SET primary_category='strength_machine', muscle_groups=ARRAY['chest','triceps'], movement_pattern='push' WHERE name='Super declined chest press';
UPDATE public.equipment SET primary_category='strength_machine', muscle_groups=ARRAY['shoulders','triceps'], movement_pattern='push' WHERE name='SUPER DELTOID PRESS';
UPDATE public.equipment SET primary_category='strength_machine', muscle_groups=ARRAY['chest','triceps'], movement_pattern='push' WHERE name='SUPER HORIZONTAL MULTI PRESS';
UPDATE public.equipment SET primary_category='strength_machine', muscle_groups=ARRAY['chest','shoulders','triceps'], movement_pattern='push' WHERE name='Super inclined bench press';
UPDATE public.equipment SET primary_category='strength_machine', muscle_groups=ARRAY['back_lats'], movement_pattern='pull' WHERE name='SUPER LAT MACHINE CONVERGENT';
UPDATE public.equipment SET primary_category='strength_machine', muscle_groups=ARRAY['back_lats'], movement_pattern='pull' WHERE name='SUPER LAT PULLDOWN CIRCULAR';
UPDATE public.equipment SET primary_category='strength_machine', muscle_groups=ARRAY['quads','glutes','hamstrings'], movement_pattern='squat' WHERE name='SUPER LEG PRESS 45°';
UPDATE public.equipment SET primary_category='strength_machine', muscle_groups=ARRAY['back_lats','chest'], movement_pattern='pull' WHERE name='SUPER PULLOVER MACHINE';
UPDATE public.equipment SET primary_category='strength_machine', muscle_groups=ARRAY['back_lats','back_traps'], movement_pattern='pull' WHERE name='SUPER ROWING CIRCULAR';
UPDATE public.equipment SET primary_category='strength_machine', muscle_groups=ARRAY['calves'], movement_pattern='isolation' WHERE name='Super seated calf';
UPDATE public.equipment SET primary_category='strength_machine', muscle_groups=ARRAY['back_lats','back_traps'], movement_pattern='pull' WHERE name='T-BAR ROW';
UPDATE public.equipment SET primary_category='strength_machine', muscle_groups=ARRAY['core_abs'], movement_pattern='isolation' WHERE name='Total core crunch machine';
UPDATE public.equipment SET primary_category='cardio', muscle_groups=ARRAY['cardio_lower'], movement_pattern='gait' WHERE name='Treadmill';
UPDATE public.equipment SET primary_category='strength_machine', muscle_groups=ARRAY['core_abs'], movement_pattern='isolation' WHERE name='Vertical Knee Raise';
UPDATE public.equipment SET primary_category='strength_machine', muscle_groups=ARRAY['quads','glutes'], movement_pattern='squat' WHERE name='VERTICAL LEG PRESS';
UPDATE public.equipment SET primary_category='cardio', muscle_groups=ARRAY['full_body'], movement_pattern='pull' WHERE name='Wind resistance rowing machine';
