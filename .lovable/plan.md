

# Book & Schedule: Smart Agenda Redesign

## Problem Summary

The booking page has three issues:
- **Recovery slots show empty** because the `benefit_slots` table has zero rows. Facilities (Ice Bath M/F, Sauna M/F) exist, and settings are configured (6 AM - 10 PM, 30-min slots), but no code auto-generates daily slots.
- **Date-picker friction** forces users to click through days with no content.
- **Classes, recovery, and PT are siloed** into separate tabs instead of a unified timeline.

## Solution: Unified Smart Agenda Feed

### Architecture

Replace the 3-tab layout with a single scrollable feed that merges all bookable items (classes + facility slots + PT sessions) into a chronological, day-grouped list for the next 7 days.

### File Changes

**File 1: `src/pages/MemberClassBooking.tsx`** (Full rewrite of the page)

The entire page gets replaced with the Smart Agenda layout:

**Top Bar: Quick Filter Chips**
- Filter pills: `[All]` `[Recovery]` `[Classes]` `[PT]`
- A small calendar icon button (top-right) opens a date-picker popover to jump to a specific day
- A "My Bookings" toggle/button to view only existing bookings

**Main View: The Unified Feed**
- Fetches 3 data sources for the next 7 days in parallel:
  1. `classes` table (group classes)
  2. `benefit_slots` table with facility join (recovery slots)
  3. `pt_sessions` table (PT appointments)
- Merges all items into a single array, sorted by date+time
- Groups items by day with sticky headers: "Today, Feb 14", "Tomorrow, Feb 15", etc.
- Gender filter applied automatically: queries `profiles.gender` for the user, then filters facility slots where `facility.gender_access` matches (male/unisex or female/unisex)
- Conflict filter: hides slots the user has already booked (via cross-referencing `class_bookings` and `benefit_bookings`)

**Card Design (each feed item):**
```
[10:00 AM]  Ice Bath - Male           [5 spots]  [Book]
            Recovery | 30 min
[11:00 AM]  HIIT Workout              [12 spots] [Book]
            Class | 60 min | Coach Jay
[02:00 PM]  PT Session                [Scheduled]
            With Coach Ravi | 45 min
```

- Time in bold left column
- Title + category badge (Recovery/Class/PT)
- Spots remaining or status
- "Book" button on right (or "Cancel" if already booked, or "Scheduled" badge for PT)

**Auto-generation of Recovery Slots:**
- When the Recovery data is fetched, the query checks `benefit_slots` for each day in the 7-day window
- If a day has zero slots AND `benefit_settings.is_slot_booking_enabled = true`, the system calls `generateDailySlots()` from `benefitBookingService.ts` to create them on-the-fly
- This runs per-facility: for each active facility, it generates slots using the operating hours from `benefit_settings`, linking each slot to the correct `facility_id` and `benefit_type_id`

**File 2: `src/services/benefitBookingService.ts`** (Minor update)

Update `generateDailySlots` to accept a `facility_id` parameter so each generated slot links to the correct physical facility (Ice Bath M, Sauna F, etc.). Currently the function only sets `benefit_type_id` but not `facility_id`.

Add a new helper function `ensureSlotsForDateRange`:
```typescript
export async function ensureSlotsForDateRange(
  branchId: string,
  startDate: string,
  endDate: string
): Promise<void>
```
This function:
1. Fetches all active facilities for the branch (with their `benefit_type_id`)
2. Fetches matching `benefit_settings` for each benefit type
3. For each day in the range, checks if slots already exist for each facility
4. If not, generates slots using `generateDailySlots` with the facility's settings
5. Sets `facility_id` on each generated slot

**No other files need changes.** The sidebar menu, routes, and dashboard links remain the same since the page URL stays `/my-classes`.

---

## Technical Details

### Data Fetching Strategy

Three parallel queries run on mount, covering 7 days from today:

1. **Classes query** (existing, just widen to 7 days instead of 1):
```sql
SELECT *, trainer:trainers(id, user_id), bookings:class_bookings(id, member_id, status)
FROM classes
WHERE branch_id = ? AND is_active = true
  AND scheduled_at >= today AND scheduled_at < today+7
ORDER BY scheduled_at
```

2. **Recovery slots query** (existing, widen + add facility join):
```sql
SELECT *, benefit_type_info:benefit_types(...), facility:facilities(...)
FROM benefit_slots
WHERE branch_id = ? AND is_active = true
  AND slot_date >= today AND slot_date <= today+6
ORDER BY slot_date, start_time
```
Post-filter: remove slots where `facility.gender_access` does not match user gender.

3. **PT sessions query** (existing, from PTSessionsTab):
```sql
SELECT * FROM pt_sessions
WHERE member_pt_package_id IN (user's packages)
  AND scheduled_at >= today AND status = 'scheduled'
ORDER BY scheduled_at
```

4. **Existing bookings** (to mark "already booked" items):
   - `class_bookings` where member_id = current and status = 'booked'
   - `benefit_bookings` where member_id = current and status in ('booked','confirmed')

### Merge + Group Logic

All items normalized to a common shape:
```typescript
interface AgendaItem {
  id: string;
  type: 'class' | 'recovery' | 'pt';
  datetime: Date;       // for classes/PT: scheduled_at; for slots: slot_date+start_time
  endTime?: string;
  title: string;
  subtitle: string;     // trainer name, facility name, etc.
  duration: number;
  spotsLeft?: number;
  capacity?: number;
  isBooked: boolean;
  bookingId?: string;    // if already booked, for cancel action
  rawData: any;          // original record for booking mutations
}
```

Grouped by day using `format(item.datetime, 'yyyy-MM-dd')` as key.

### Auto-Slot Generation

Triggered inside the recovery query's `queryFn`:
1. Call `ensureSlotsForDateRange(branchId, today, today+6)`
2. Then fetch the slots normally
3. This ensures slots exist before the user sees the page
4. Uses `staleTime: Infinity` on the generation call to avoid re-generating on every render

### Empty State

Since we fetch 7 days of data across 3 sources, the empty state is extremely rare. If truly empty:
- "No sessions available this week. Contact your gym to check the schedule."

---

## Summary

| File | Change |
|------|--------|
| `src/pages/MemberClassBooking.tsx` | Full rewrite: Smart Agenda feed with filter chips, 7-day merged timeline, auto-slot generation |
| `src/services/benefitBookingService.ts` | Add `facility_id` to slot generation, add `ensureSlotsForDateRange` helper |

