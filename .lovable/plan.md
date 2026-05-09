## Audit Findings

### 1. "Save to member profile" silently failing on AI page
`MemberProfileCard.handleSaveToProfile` writes to `members` columns including `workout_activities`, `fitness_level`, `equipment_availability`, `dietary_preference`, `cuisine_preference`, `allergies`, `health_conditions`, `fitness_goals`. The button works in code, but:
- It is hidden inside a collapsed `Collapsible` ("Edit profile data for this plan"). On the AI page in your screenshot, the user never expands it, so the button at the bottom of the screenshot is actually the floating one — and the click likely 404s on RLS or column-not-found because `workout_activities` is a recent migration and may not be present on every environment.
- No Save button is shown OUTSIDE the collapsible, so users can't see it without scrolling/expanding.
- After save, we invalidate `member-profile-prefill` but the AI generation flow does not feed the saved values back into next plan automatically — the only re-use is the next time the same form is opened.

### 2. AssignPlanDrawer opens from the bottom
`AssignPlanDrawer.tsx` uses `@/components/ui/drawer` (vaul, bottom slide). Project rule (memory: form-drawer-standard) is **right-side `Sheet` for all create/edit/multi-field flows**. This must be migrated.

### 3. "Valid Until" forced to manual date
The drawer hard-codes `addWeeks(new Date(), 4)`. The plan content already carries `durationWeeks` (workout) or an implicit 1-week diet. We should auto-compute validity from the plan and let the user override only if they want.

### 4. AI workout doesn't use branch equipment
`generate-fitness-plan` only sees a single string token from the `equipment` enum (`full_gym | home_basic | …`). The real `equipment` table (operational machines per branch) is never sent. AI invents generic exercises. We need to pass the branch's operational equipment list and instruct the model to prefer those machines.

---

## Plan

### A. Fix & elevate "Save to member profile" (AI + Manual pages)
1. In `MemberProfileCard.tsx`:
   - Move the **Save to member profile** button to the card header (always visible), in addition to the inline one.
   - Surface inline error toast with the actual Postgres message when the update fails (currently shows `err.message` but no diagnostic logging). Add `console.error` and capture via `log_error_event` for observability.
   - Guard each updated column with a feature-detect: if `workout_activities` doesn't exist on this DB, fall back to omitting it (prevents silent failure on stale schemas).
2. After successful save, also call `queryClient.invalidateQueries({ queryKey: ['member', memberId] })` and `['member-profile-prefill']` so any open Member drawer re-fetches.
3. **Use saved profile for next plan** — `CreateAI.tsx` already prefills from the same hook. Add a small "Last plan summary" strip pulling from `memberPlanProgressService` (latest workout/diet plan + adherence %) so the trainer sees context before generating. Pass that summary into the AI prompt as `previousPlanContext`.

### B. Right-side Sheet for AssignPlanDrawer + auto validity
1. Rewrite `AssignPlanDrawer.tsx` to use `Sheet` / `SheetContent side="right"` (`sm:max-w-xl`), with sticky header, scrollable body, sticky footer (Cancel + Assign), per project standard.
2. Compute default validity from plan content:
   - Workout: `durationWeeks = plan.content.durationWeeks ?? plan.content.weeks?.length ?? 4` → `addWeeks(today, durationWeeks)`.
   - Diet: 4 weeks default (configurable per gym later).
3. Replace the date `<input type="date">` with a labelled field that shows the auto value + "Auto from plan duration · Click to override" hint. Recompute when `plan` prop changes.
4. Keep all current props/handlers — call sites in `Templates.tsx` and `PreviewPlan.tsx` need no change.

### C. Branch-equipment-aware AI workout
1. New helper in `src/services/equipmentService.ts`: `fetchOperationalEquipmentLite(branchId)` returning `{ name, category, brand, model }[]` filtered by `status='operational'`.
2. In `CreateAI.tsx`, when `type === 'workout'`, fetch this list (cached by branch) and pass it to `generate.mutateAsync` under a new `options.availableEquipment` field.
3. Extend `generate-fitness-plan` edge function:
   - Accept `availableEquipment: { name, category }[]`.
   - Inject an `equipmentPrompt` block similar to existing `catalogPrompt`: "Prefer these gym machines when prescribing exercises. Use the EXACT machine name when possible. Bodyweight or stretching alternatives are allowed for warm-up / cool-down."
   - When list is non-empty, also bias the system prompt to avoid recommending equipment not on the list (with explicit fallback rule for cardio / mobility).
4. Replace the rigid `equipment` Select on `MemberProfileCard` (workout mode) with a read-only chip showing "Branch: full machine list (N machines)" plus a link "View equipment" — the actual list comes from the branch automatically. Keep the enum for diet/home members via a small "Equipment access" override toggle ("Use branch equipment / Home basic / Bodyweight only").

### D. Polish (2026 UI/UX)
- Sheet gets segmented progress header: `Members → Schedule → Notify`.
- Selected members render as removable chips above the search.
- "Notify on" buttons get color-coded active state matching brand (Email indigo, WhatsApp emerald, In-app violet).
- Validity field shows secondary badge `4 weeks · Mon Jun 8` for instant readability.
- Disabled "Assign" button shows reason on hover (no members / no channels).

---

## Technical Notes (for the implementer)

**Files to edit**
- `src/components/fitness/AssignPlanDrawer.tsx` — Drawer → Sheet, auto validity, chip UI.
- `src/components/fitness/create/MemberProfileCard.tsx` — header Save button, error logging, equipment chip.
- `src/pages/fitness/CreateAI.tsx` — fetch operational equipment, pass `availableEquipment`, pull last-plan summary.
- `src/services/equipmentService.ts` — add `fetchOperationalEquipmentLite`.
- `supabase/functions/generate-fitness-plan/index.ts` — accept `availableEquipment`, inject `equipmentPrompt`, adjust system prompt.

**No DB migration required** — `members.workout_activities` already exists from the previous task; equipment list comes from existing `equipment` table.

**Backwards compat** — `availableEquipment` is optional in the edge function; old callers continue working.

**Estimated scope** — ~250 LOC change, single PR, no schema changes.
