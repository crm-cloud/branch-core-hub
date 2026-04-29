# Audit & Refactor: Benefit Types vs Facilities

## What I found

Your architecture is **already correct in the schema** — but the data and UI are not using it correctly.

**Schema (good):**
- `benefit_types` = the *category* (Ice Bath, Sauna). No gender column (was dropped Feb 2026).
- `facilities` = physical *rooms* with `gender_access` (`male` / `female` / `unisex`), `capacity`, `available_days`, `under_maintenance`.
- `book_facility_slot` RPC enforces gender at booking time using `facilities.gender_access` vs `profiles.gender`. Working correctly.
- `MemberClassBooking`, `BookBenefitSlot`, `ConciergeBookingDrawer`, `MemberProfileDrawer` all already filter by `facility.gender_access`.

**Data (broken — this is the real problem):**
Current `benefit_types` in the DB:
- `Ice Bath Male` (`ice_bath_m`) → 1 male facility
- `Ice Bath Female` (`ice_bath_f`) → 1 female facility
- `Sauna Therapy Male` (`sauna_therapy_m`) → 1 male facility
- `Sauna Therapy Female` (`sauna_therapy_female`) → 1 female facility
- `Steam room` (no facility yet)
- `Body Composition & Posture Scan` (not a bookable facility)

So the operator created **duplicate categories per gender**, defeating the design. A male and a female ice bath should be **two facilities of one benefit type "Ice Bath"** — not two benefit types.

**UI (the cause):**
- `BenefitTypesManager` does not surface that gender lives on facilities, so users invent `_m`/`_f` codes.
- `FacilitiesManager` placeholder text literally says *"Ice Bath - Male Room"* — encouraging gendered names and reinforcing the wrong mental model.
- No grouped view showing "Ice Bath → 2 rooms (1 male, 1 female)".
- Delete on a benefit type with linked facilities/plans throws raw FK error instead of guarding.

## The right model (recommendation)

```text
Benefit Type: "Ice Bath"  (category, gender-agnostic)
  ├── Facility: "Ice Bath Room A"    gender_access=male,   capacity=2
  └── Facility: "Ice Bath Room B"    gender_access=female, capacity=2

Benefit Type: "Sauna"
  ├── Facility: "Sauna - Men's Wing" gender_access=male
  └── Facility: "Sauna - Women's Wing" gender_access=female
  └── Facility: "Couples Sauna"       gender_access=unisex
```

Members holding "Ice Bath × 8 sessions" can book **either** room their gender allows — one balance, one pass, no double-counting.

## Plan

### 1. Data migration (one-shot, reversible-by-backup)

Write a SQL migration that:
- Picks one canonical type per duplicate set (keeps `Ice Bath Male` → renames to `Ice Bath`, code `ice_bath`; same for sauna). Picks the older row to preserve history.
- Repoints linked rows of the duplicate to the canonical id:
  - `facilities.benefit_type_id`
  - `member_benefits.benefit_type_id`
  - `plan_benefits.benefit_type_id` (and any `*_template_*` tables — verified at write time)
  - `benefit_packages.benefit_type_id`
  - `benefit_usage_log.benefit_type_id`
- Soft-deletes the duplicate type (`is_active=false`, suffix code with `_deprecated_<ts>`) instead of hard-delete, so any cached id still resolves.
- Logs the merge into `audit_log` so it's visible in Audit Logs.

### 2. UI/UX overhaul — `BenefitTypesManager`

- Add a banner explaining: *"A benefit type is the category (Ice Bath). Gender, capacity and room belong to Facilities."* with link to Facilities tab.
- Replace flat card list with **grouped cards**: each benefit type expands to show its linked facilities inline (name, gender badge, capacity, status), with quick "Add Facility" CTA inside the card.
- Add a **"Used in" footer** per type: # plans, # active member benefits, # facilities. Clicking opens a side sheet with the dependency list.
- **Delete guard**: if facilities or plans reference the type, block delete and offer "Deactivate" instead. If only inactive references, allow delete with confirm.
- Code field: auto-generate, lock once any dependency exists.
- Drawer copy refresh: example placeholder `"Ice Bath"`, not `"Ice Bath - Male Room"`.

### 3. UI/UX overhaul — `FacilitiesManager`

- Rename column heading from generic to **"Rooms & Equipment"** (clearer for staff).
- Group rows by `benefit_type` with a header row showing the type icon + total capacity across rooms.
- Filter chips: All / Unisex / Male / Female / Under Maintenance / Inactive.
- Drawer placeholder changes from `"Ice Bath - Male Room"` to `"Room A"` or `"Men's Wing"` to discourage embedding gender in the name (gender is its own field already).
- Inline gender badge using semantic tokens (blue/pink/neutral).
- Add a *"Why two rooms?"* helper tooltip on the Gender field.

### 4. Guardrails & validation

- DB unique index on `(branch_id, lower(name))` for `benefit_types` to prevent re-creating duplicates.
- DB check: facility name must not contain "male"/"female" alone (warning, not hard error — surfaced as a UI warning).
- Booking RPC already enforces gender — verified, no change needed.

### 5. Member-facing impact

- `MyBenefits` and `MemberClassBooking` will show **one** "Ice Bath" balance instead of two — matches what the member actually purchased.
- Booking flow already routes them to the correct gendered room via existing `gender_access` filter — no UX change needed.

## Files touched

**Migrations**
- `supabase/migrations/<ts>_consolidate_gendered_benefit_types.sql` — merge data, add unique index, audit log entry.

**Frontend**
- `src/components/settings/BenefitTypesManager.tsx` — grouped UI, dependency footer, delete guard, copy.
- `src/components/settings/FacilitiesManager.tsx` — grouping by type, filter chips, copy.
- `src/hooks/useBenefitTypes.ts` — extend to optionally return facility counts (single query with aggregate).
- New: `src/components/settings/BenefitTypeDependencySheet.tsx` — shows what references a type.

**No changes needed (already correct):**
- `book_facility_slot` RPC, `MemberClassBooking`, `BookBenefitSlot`, `ConciergeBookingDrawer`, `MemberProfileDrawer` — all read gender from facility.

## Out of scope

- Changing `benefit_type` enum on `member_benefits` (legacy column, custom types use `'other'` + `benefit_type_id` UUID — already documented in `mem://architecture/benefit-uniqueness-constraints`).
- Touching scan/posture types — they're not facility-bound.

Reply **approve** to proceed, or tell me what to change.
