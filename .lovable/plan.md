

# Category-Based Booking with Auto-Gender Filtering

## Overview

Currently, `benefit_types` (e.g., "Ice Bath") has a `gender_access` column, meaning admins must create separate benefit types like "Male Ice Bath" and "Female Ice Bath." This leads to plan confusion and booking errors.

The fix introduces a **facilities** table that represents physical rooms/spaces, each linked to a generic benefit type category and tagged with gender access. Plans stay clean ("Ice Bath Access"), and the booking system automatically filters rooms by the member's gender.

---

## Architecture Change

```text
BEFORE:
  benefit_types (Ice Bath - Male) --> benefit_slots --> benefit_bookings
  benefit_types (Ice Bath - Female) --> benefit_slots --> benefit_bookings

AFTER:
  benefit_types (Ice Bath) [GENERIC, no gender]
      |
  facilities (Ice Bath - Male Room, Ice Bath - Female Room) [has gender_access]
      |
  benefit_slots (linked to facility) --> benefit_bookings
```

---

## Database Changes

### 1. Create `facilities` table

```sql
CREATE TABLE public.facilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  benefit_type_id UUID NOT NULL REFERENCES public.benefit_types(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                    -- "Ice Bath - Male Room"
  gender_access TEXT NOT NULL DEFAULT 'unisex' CHECK (gender_access IN ('male', 'female', 'unisex')),
  capacity INTEGER NOT NULL DEFAULT 1,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.facilities ENABLE ROW LEVEL SECURITY;

-- RLS: Management can CRUD, members can read active ones matching their gender
CREATE POLICY "Management full access" ON public.facilities
  FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['owner','admin','manager']::app_role[]));

CREATE POLICY "Members read matching facilities" ON public.facilities
  FOR SELECT TO authenticated
  USING (
    is_active = true
    AND (
      gender_access = 'unisex'
      OR gender_access = (SELECT gender::text FROM public.profiles WHERE id = auth.uid())
      OR public.has_any_role(auth.uid(), ARRAY['owner','admin','manager','staff']::app_role[])
    )
  );
```

### 2. Add `facility_id` to `benefit_slots`

```sql
ALTER TABLE public.benefit_slots
  ADD COLUMN facility_id UUID REFERENCES public.facilities(id);
```

### 3. Remove `gender_access` from `benefit_types`

The `gender_access` column on `benefit_types` (added in the previous migration) will be dropped since gender now lives on facilities.

```sql
ALTER TABLE public.benefit_types DROP COLUMN IF EXISTS gender_access;
```

---

## UI Changes

### 1. Settings: New "Facilities" Management Section

**File:** `src/components/settings/BenefitSettingsComponent.tsx` (or new component)

Add a "Facilities" tab/section where admins can:
- Create facilities linked to a benefit type category (e.g., "Ice Bath - Male Room" linked to "Ice Bath")
- Set gender access (Male / Female / Unisex)
- Set capacity per facility
- Toggle active/inactive

### 2. Remove Gender from BenefitTypesManager

**File:** `src/components/settings/BenefitTypesManager.tsx`

Remove the gender access selector from the benefit type create/edit form. Benefit types should be generic categories only.

### 3. Slot Management: Link Slots to Facilities

**File:** `src/components/benefits/ManageSlotsDrawer.tsx`

When creating slots, admins select a **facility** (which already has a benefit type and gender). The slot inherits the benefit type from the facility.

### 4. Member Booking: Auto-Gender Filtering

**File:** `src/pages/BookBenefitSlot.tsx`

The booking flow changes:
1. Fetch member's gender from their profile
2. When displaying available slots, join through `facility` to get `gender_access`
3. Filter to only show slots where `facility.gender_access` matches member's gender or is 'unisex'
4. The member only sees "Ice Bath" as the category -- the system picks the correct room automatically

**File:** `src/components/benefits/BenefitSlotBookingDrawer.tsx`

Same filtering logic applied here for admin-initiated bookings.

### 5. Plan Creation: No Change Needed

Plans already link to generic `benefit_types` via `plan_benefits`. Since we are keeping `benefit_types` gender-neutral, plans remain clean: "Includes 5 Ice Bath sessions."

---

## Files to Modify

| File | Change |
|------|--------|
| Database migration | Create `facilities` table, add `facility_id` to `benefit_slots`, drop `gender_access` from `benefit_types` |
| `src/components/settings/BenefitTypesManager.tsx` | Remove gender access field from benefit type form |
| New: `src/components/settings/FacilitiesManager.tsx` | CRUD UI for facilities (name, benefit type, gender, capacity) |
| `src/components/settings/BenefitSettingsComponent.tsx` | Add facilities section/tab |
| `src/components/benefits/ManageSlotsDrawer.tsx` | Select facility when creating slots instead of bare benefit type |
| `src/pages/BookBenefitSlot.tsx` | Fetch member gender from profile, filter slots by facility gender_access |
| `src/components/benefits/BenefitSlotBookingDrawer.tsx` | Filter slots by gender via facility join |
| `src/services/benefitBookingService.ts` | Update slot queries to join facilities |

---

## Technical Details

### Member Gender Fetch (BookBenefitSlot)
```typescript
// Fetch member's profile gender
const { data: profile } = await supabase
  .from('profiles')
  .select('gender')
  .eq('id', user.id)
  .single();

// Filter slots query - join through facility
const { data } = await supabase
  .from('benefit_slots')
  .select(`*, facility:facilities(id, name, gender_access, benefit_type_id, benefit_type_info:benefit_types(name, icon))`)
  .eq('branch_id', branchId)
  .eq('slot_date', dateStr)
  .eq('is_active', true);

// Client-side filter (RLS also enforces this on facilities)
const filtered = data.filter(slot =>
  !slot.facility || slot.facility.gender_access === 'unisex' || slot.facility.gender_access === profile.gender
);
```

### FacilitiesManager Component
A simple CRUD list showing:
- Facility name
- Linked benefit type (dropdown)
- Gender access (Male/Female/Unisex badge)
- Capacity
- Active toggle
- Edit/Delete buttons

### Backward Compatibility
Existing slots without `facility_id` continue to work -- they just won't have gender filtering. New slots will be created with a facility link.

