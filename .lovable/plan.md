

# Gender-Locked Bookings, AI Planner Dual-Mode, and Assign Fix

## Issues Found

### 1. CRITICAL: Concierge Drawer Has No Gender Filter
`ConciergeBookingDrawer.tsx` line 106-113: The facilities query fetches ALL active facilities without checking `gender_access` against the selected member's gender. The member search RPC doesn't return gender either — need to fetch it separately.

**Fix**:
- After member is selected, fetch their gender from `profiles` table
- Filter the facilities dropdown: only show facilities where `gender_access === 'unisex'` OR `gender_access === member_gender`
- Add server-side validation in `handleBookSlot`: before booking, verify the slot's facility gender matches the member

### 2. AI Planner: Dual-Mode Toggle
Currently all biometric fields are shown always. Add a mode toggle at the top.

**Fix** in `AIFitness.tsx`:
- Add `planMode` state: `'global' | 'personalized'`
- Toggle UI at top of Generate form
- Global mode: hide Age, Gender, Height, Weight, Health Conditions fields. Show only Plan Name, Goal, Experience, Duration/Calories, Preferences
- Personalized mode: show member search first, auto-fill biometrics from their profile (`member_measurements`), allow manual override

### 3. Assign Plan Not Working
`searchMembersForAssignment` in `fitnessService.ts` line 147 filters by `m.is_active` but the `search_members` RPC returns `member_status` not `is_active`. This means `.filter((m: any) => m.is_active)` always returns empty — **no members ever appear in search results**.

**Fix**: Change filter to `m.member_status === 'active'` or remove the filter entirely (the RPC already returns all matching members).

---

## Files to Change

| File | Change |
|------|--------|
| `src/components/bookings/ConciergeBookingDrawer.tsx` | Fetch member gender after selection; filter facilities by gender_access; add gender mismatch guard in handleBookSlot |
| `src/pages/AIFitness.tsx` | Add planMode toggle (Global/Personalized); hide biometric fields in Global mode; add member search + auto-fill in Personalized mode |
| `src/services/fitnessService.ts` | Fix `searchMembersForAssignment` — change `m.is_active` to `m.member_status === 'active'` |

## Implementation Details

**Concierge Gender Filter**:
```
1. After setSelectedMember, query profiles table for gender
2. Filter facilities: facilities.filter(f => f.gender_access === 'unisex' || f.gender_access === memberGender)
3. Show gender badge on facility dropdown items
4. In handleBookSlot, verify gender match before proceeding
```

**AI Dual-Mode**:
- Global: Plan Name, Goal dropdown, Experience, Duration, Preferences only
- Personalized: Member search → auto-fills from latest `member_measurements` + `profiles(gender)` → generates with full context
- Mode toggle is a simple segmented control at the top of the form

**Assign Fix**: Single line change — `m.is_active` → `m.member_status === 'active'` (or remove filter to show all members).

