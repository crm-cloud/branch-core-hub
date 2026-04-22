
## Phase G — Secure Measurement Foundation + Member 3D Progress

### What’s already in the codebase
- `member_measurements` exists, but current RLS is too broad: staff/trainers can insert without proving member/branch authorization.
- Progress photos are currently stored in public `member-photos` and the UI saves public URLs directly.
- `RecordMeasurementDrawer.tsx` uploads files immediately and only removes them from local state on cancel/remove, so files can be orphaned.
- Measurement writes are direct table inserts from the client with no server-side validation/RPC.
- `MyProgress.tsx` and `MeasurementProgressView.tsx` already provide a member progress entry point that can be extended.
- React Three Fiber / Three.js are already installed and used in the project, so the stack is ready.

## Phase G1 — Lock down measurements and progress photo storage first

### Database and storage changes
1. Extend `public.member_measurements` with the new fitting fields:
   - `gender_presentation`
   - `shoulder_cm`, `neck_cm`
   - `forearm_left_cm`, `forearm_right_cm`
   - `wrist_left_cm`, `wrist_right_cm`
   - `ankle_left_cm`, `ankle_right_cm`
   - `inseam_cm`, `torso_length_cm`, `abdomen_cm`
   - future-ready nullable fields: `front_progress_photo_path`, `side_progress_photo_path`, `posture_type`, `body_shape_profile`
2. Add `updated_at` if needed for easier lifecycle handling.
3. Make progress photos private:
   - update `storage.buckets` for `member-photos` to `public = false`
   - replace broad public SELECT policy with role/member-scoped policies
4. Replace loose measurement RLS with stricter policies:
   - members can read only their own measurements
   - staff/trainers can read/write only if they are authorized for that member and branch
   - no direct broad insert/update access

### Server-side authorization model
Add security-definer helper functions in `public`:
- `can_access_member_measurements(_user_id, _member_id)` → boolean
- `can_write_member_measurements(_user_id, _member_id)` → boolean
- optionally `get_member_measurement_photo_paths(_measurement_id)` for cleanup support

Authorization rules:
- member can access self
- owner/admin can access all
- manager/staff limited to assigned branch
- trainer limited to own branch and/or assigned clients / active PT relationship
- no client-side-only branch checks

## Phase G2 — Move writes and validation into backend functions/RPC

### New secure write path
Create a security-definer RPC, e.g. `public.record_member_measurement(...)`, that:
1. verifies `auth.uid()`
2. verifies `can_write_member_measurements(auth.uid(), _member_id)`
3. validates payload ranges and required data quality
4. blocks blank rows
5. inserts only normalized values
6. stores photo paths, not public URLs
7. returns inserted row id

### Validation rules
Implement validation in DB function/trigger layer:
- trim notes / normalize blanks to `null`
- reject rows where all measurement fields are null/empty
- clamp or reject impossible values with realistic min/max ranges
- ensure symmetric fields and body-fat/height/weight ranges are sane
- validate enums such as `gender_presentation`
- use trigger/function validation, not fragile CHECKs tied to time logic

Suggested rule shape:
- hard reject impossible values
- calibration-safe numeric ranges for avatar mapping
- allow partial records, but only if at least one real body metric is present

## Phase G3 — Fix upload lifecycle so photos are never orphaned

### Upload strategy change
Refactor `RecordMeasurementDrawer.tsx` so it no longer stores public URLs.
Use a draft upload lifecycle:
1. upload to a member-scoped private path like `member_id/drafts/session-id/...`
2. keep returned storage paths in local draft state
3. on photo remove: delete object immediately from storage
4. on cancel: delete all draft paths
5. on save: pass approved paths to RPC, which either:
   - keeps draft paths as final references, or
   - moves/copies them into a final measurement-scoped folder and stores final paths

### Read strategy change
Where the member UI currently expects `photos` as URLs:
- migrate to stored private paths
- generate signed URLs at read time
- batch/sign latest measurement photos only when needed
- avoid public URL persistence in the table

## Phase G4 — Add signed URL photo reads for the progress UI

### Data access updates
Update member measurement readers (`useMemberData`, `MeasurementProgressView`, any trainer/member progress areas) so they:
1. fetch measurement rows with private path fields / photo-path arrays
2. request signed URLs client-side only for authorized users
3. cache them briefly in React Query
4. gracefully handle expired URLs by re-signing on refetch

### UI changes
In `MeasurementProgressView.tsx`:
- replace direct `<img src={storedUrl}>` usage with signed URLs
- keep current photo grid, but secure it
- support front/side future-ready dedicated photo slots when available

## Phase G5 — Build reusable 3D avatar architecture

### New reusable modules
Add a modular 3D body system:

1. `src/lib/measurements/measurementValidation.ts`
   - shared client-side mirror of server rules
   - input normalization helpers

2. `src/lib/measurements/measurementToAvatar.ts`
   - reusable measurement-to-morph-target mapper
   - normalized ranges
   - calibration multipliers
   - delta summary helpers

3. `src/components/progress3d/MemberBodyAvatarCanvas.tsx`
   - top-level viewer shell
   - fallback boundary
   - mobile/performance guards

4. `src/components/progress3d/BodyModel.tsx`
   - loads male/female GLB
   - applies morph target influences
   - TODO markers for final morph target names if assets are absent

5. `src/components/progress3d/BodyComparisonView.tsx`
   - current vs previous avatar cards
   - delta summary / callouts
   - latest update badge

6. `src/components/progress3d/BodyFallbackCard.tsx`
   - non-3D fallback if Canvas/model fails

### 3D interaction behavior
- slow default autorotation
- drag to rotate
- controlled camera limits
- reduced effects on mobile / low-end devices
- optional pause autorotation while dragging

## Phase G6 — Measurement-to-morph mapping logic

### Mapping approach
Use a calibrated influence model rather than literal geometry generation:
- choose base model by `gender_presentation` (`male`, `female`, fallback neutral behavior for `other`)
- convert measurements into normalized scores per region:
  - torso: chest, shoulder, abdomen, waist, hips
  - arms: biceps, forearms, wrists
  - legs: thighs, calves, ankles, inseam
  - global: weight, body fat, height, torso length, neck
- combine correlated inputs so one odd value does not distort the mesh
- clamp all morph influences to safe ranges
- apply smoothing/calibration constants to keep results believable and motivating

### Comparison logic
Compute:
- latest avatar state
- previous avatar state
- delta summary for key metrics:
  - waist reduced/increased
  - chest increased/decreased
  - weight changed
  - body fat changed
- visible “before / now” framing rather than raw clinical numbers only

## Phase G7 — Upgrade the member progress UI

### Page updates
In `src/pages/MyProgress.tsx`:
- keep top-level progress area
- inside the progress experience, add a premium toggle/tab group:
  - Measurements
  - Photos
  - 3D Body

### 3D Body tab contents
Show:
- current avatar
- previous avatar
- overlay delta summary
- latest update date
- motivational callouts

### Measurements / Photos split
Refactor current `MeasurementProgressView` so it can support:
- measurement summary
- secured photo gallery
- reusable data source shared by the 3D view

### Design direction
Keep existing project memory and UX rules:
- Vuexy-inspired premium cards
- no modal-based forms
- rounded-xl/2xl cards
- rich but lightweight gradients/badges
- mobile-first spacing using existing viewport standards

## Phase G8 — Fallbacks, performance, and asset-missing behavior

### Performance protections
- lazy-load 3D tab content only when opened
- lazy-load GLB assets
- memoize morph calculations
- use simpler lights/materials on mobile
- keep shadows/effects minimal
- use suspense + error boundary for model load failures

### Missing asset strategy
If male/female GLB models are not present:
- scaffold full 3D architecture now
- render a placeholder body mesh/silhouette viewer
- add explicit TODO comments for:
  - model file paths
  - morph target names
  - calibration tuning constants
- keep full mapping/util layers ready so real assets can be dropped in later

## Files to change

### Database / backend
- `supabase/migrations/<new>.sql`
  - new measurement fields
  - private photo storage policies
  - helper auth functions
  - validation trigger/function
  - secure measurement RPC
- `src/integrations/supabase/types.ts`
  - auto-regenerated from schema changes, not edited manually

### Member measurement UI/data
- `src/components/members/RecordMeasurementDrawer.tsx`
  - draft photo lifecycle
  - private path handling
  - call RPC instead of direct insert
- `src/components/members/MeasurementProgressView.tsx`
  - signed photo URLs
  - measurements/photos split support
- `src/hooks/useMemberData.ts`
  - secure measurement reads + signed photo URL hydration
- `src/pages/MyProgress.tsx`
  - new Measurements / Photos / 3D Body experience

### New 3D modules
- `src/lib/measurements/measurementValidation.ts`
- `src/lib/measurements/measurementToAvatar.ts`
- `src/components/progress3d/MemberBodyAvatarCanvas.tsx`
- `src/components/progress3d/BodyModel.tsx`
- `src/components/progress3d/BodyComparisonView.tsx`
- `src/components/progress3d/BodyFallbackCard.tsx`

### Assets
- `public/models/body-male.glb` and `public/models/body-female.glb` if available
- otherwise scaffold with placeholder + TODO markers

## Verification checklist

1. A member can open My Progress and see secure measurement data.
2. Progress photos no longer use public URLs.
3. Photo remove and drawer cancel both delete draft uploads.
4. Unauthorized trainer/staff write attempts are rejected server-side.
5. Empty measurement rows are rejected.
6. Impossible measurement values are rejected server-side.
7. The 3D Body tab loads a rotating avatar from latest measurements.
8. Male/female base selection works.
9. Latest vs previous comparison is visible and understandable.
10. If model loading fails or assets are missing, the page falls back to a static comparison card without breaking.
11. Mobile experience remains smooth and readable.

## Technical details
```text
Client form
  -> private draft upload(s)
  -> local draft paths only
  -> secure RPC record_member_measurement(...)
      -> auth check
      -> member authorization check
      -> validation
      -> insert measurement row with private photo paths
  -> member progress read
      -> RLS-authorized select
      -> signed URL generation for photo display
      -> 3D mapper -> morph target influences
      -> current vs previous avatar comparison
```
